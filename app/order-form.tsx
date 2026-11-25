"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Form } from "react-aria-components";
import { submitInviteOrder, submitOrder, updateAdminOrder, updateSubmittedOrder } from "./actions";
import { initialOrderActionState } from "./order-action-state";
import { Button } from "@/components/ui/Button";
import { CheckboxField } from "@/components/ui/CheckboxField";
import { ConfirmDialog, ControlledConfirmDialog } from "@/components/ui/ConfirmDialog";
import { FieldGroup } from "@/components/ui/FieldGroup";
import { InlineStatus } from "@/components/ui/InlineStatus";
import { NumberField } from "@/components/ui/NumberField";
import { ProgressIndicator } from "@/components/ui/ProgressIndicator";
import { SelectField } from "@/components/ui/SelectField";
import { TextAreaField } from "@/components/ui/TextAreaField";
import { TextField } from "@/components/ui/TextField";
import { LEGACY_DRAFT_KEYS, draftKey, parseStoredDraft, removeDraft, type StoredDraft } from "@/lib/draft";
import {
  durationFromParts,
  emptyBackingTrack,
  formatDuration,
  formatDurationJa,
  isEquipmentFilled,
  isMemberFilled,
  makeEmptyEquipmentItem,
  makeEmptyMember,
  makeEmptyMembers,
  makeEmptySong,
  makeId,
  MAX_EQUIPMENT_COUNT,
  MAX_MEMBER_COUNT,
} from "@/lib/orderSchema";
import type { BackingTrack } from "@/contracts/v1";
import type { Equipment, LiveEvent, Member, PAOrder } from "@/types/order";

const steps = ["出演情報", "メンバー・機材", "セットリスト", "確認・提出"] as const;
const instrumentOptions = ["Vo", "Gt", "Ba", "Dr", "Key", "Cho", "Perc", "Gt.Vo", "Ba.Vo", "その他"];
const triggerOptions = ["ドラム4カウント", "ギターから", "ボーカルから", "音源から", "合図から", "その他"];
const connectionOptions = ["PCからステレオミニで卓へ", "オーディオインターフェースからDIへ", "スマートフォンからステレオミニで卓へ"];

export type OrderFormMode = "new" | "invite" | "submitter" | "admin";

type SongModel = {
  id: string;
  title: string;
  minutes: string;
  seconds: string;
  /** 旧形式で解釈できなかった演奏時間の入力（表示だけ） */
  legacyDuration: string;
  mood: string;
  startTrigger: string;
  paRequest: string;
  mc: { hasMc: boolean; person: string };
};

type FormModel = {
  liveEventId: string;
  bandName: string;
  contactName: string;
  microphoneCount: number;
  usesBackingTrack: boolean;
  backingTrack: BackingTrack;
  members: Member[];
  equipment: Equipment[];
  songs: SongModel[];
  generalRequest: string;
};

type DraftValue = { model: FormModel; step: number; baseRevision: number | null };

function emptySongModel(): SongModel {
  const song = makeEmptySong();
  return { id: song.id, title: "", minutes: "", seconds: "", legacyDuration: "", mood: "", startTrigger: "", paRequest: "", mc: { hasMc: false, person: "" } };
}

function initialModel(order: PAOrder | undefined, fixed: { liveEventId?: string; bandName?: string }): FormModel {
  return {
    liveEventId: fixed.liveEventId || order?.liveEventId || "",
    bandName: fixed.bandName || order?.bandName || "",
    contactName: order?.contactName || "",
    microphoneCount: order?.microphoneCount || 0,
    usesBackingTrack: order?.usesBackingTrack || false,
    backingTrack: order?.backingTrack || emptyBackingTrack(),
    members: order?.members.length ? order.members : makeEmptyMembers(),
    equipment: order?.equipment || [],
    songs: order?.songs.length
      ? order.songs.map((song) => ({
          id: song.id,
          title: song.title,
          minutes: song.durationSeconds === null ? "" : String(Math.floor(song.durationSeconds / 60)),
          seconds: song.durationSeconds === null ? "" : String(song.durationSeconds % 60),
          legacyDuration: song.durationSeconds === null ? song.duration : "",
          mood: song.mood,
          startTrigger: song.startTrigger,
          paRequest: song.paRequest,
          mc: song.mc,
        }))
      : [emptySongModel()],
    generalRequest: order?.generalRequest || "",
  };
}

function songSeconds(song: SongModel) {
  const value = durationFromParts(song.minutes, song.seconds);
  return typeof value === "number" ? value : null;
}

function isSongModelFilled(song: SongModel) {
  return Boolean(song.title.trim() || song.minutes.trim() || song.seconds.trim() || song.mood.trim() || song.startTrigger.trim() || song.paRequest.trim() || song.mc.hasMc);
}

/** 各ステップの必須項目（サーバーでも同じ検証を行う） */
function validate(model: FormModel, songLimit: number, mode: OrderFormMode) {
  const errors: Record<string, string> = {};
  if (mode === "new" && !model.liveEventId) errors.live_event_id = "ライブを選択してください。";
  if (!model.bandName.trim()) errors.band_name = "バンド名を入力してください。";
  if (!model.contactName.trim()) errors.contact_name = "代表者名を入力してください。";
  if (!Number.isInteger(model.microphoneCount) || model.microphoneCount < 0 || model.microphoneCount > 99) errors.microphone_count = "マイク本数は0〜99の整数で入力してください。";
  if (model.usesBackingTrack) {
    if (!model.backingTrack.operator.trim()) errors.backing_track_operator = "音源の再生担当を入力してください。";
    if (!model.backingTrack.device.trim()) errors.backing_track_device = "再生に使う端末を入力してください。";
    if (!model.backingTrack.connection.trim()) errors.backing_track_connection = "接続方法を入力してください。";
  }
  model.equipment.forEach((item, index) => {
    if (isEquipmentFilled(item) && !item.name.trim()) errors[`equipment_${index}_name`] = "機材名を入力してください。";
  });
  let filled = 0;
  model.songs.forEach((song, index) => {
    if (!isSongModelFilled(song)) return;
    filled += 1;
    if (!song.title.trim()) errors[`song_${index}_title`] = `${index + 1}曲目の曲名を入力してください。`;
    const duration = durationFromParts(song.minutes, song.seconds);
    if (duration === "invalid") errors[`song_${index}_duration_min`] = `${index + 1}曲目の演奏時間は0〜59分、0〜59秒の範囲で入力してください。`;
    else if (duration === null) errors[`song_${index}_duration_min`] = `${index + 1}曲目の演奏時間（分・秒）を入力してください。`;
  });
  if (filled === 0) errors.song_0_title = "少なくとも1曲の曲名と演奏時間を入力してください。";
  if (filled > songLimit) errors.song_count = `曲数をこのライブの上限（${songLimit}曲）以内にしてください。`;
  return errors;
}

function fieldStep(name: string) {
  if (name.startsWith("member_") || name.startsWith("equipment_") || name.startsWith("backing_track") || name === "microphone_count") return 1;
  if (name.startsWith("song_") || name === "general_request") return 2;
  return 0;
}

function move<T>(items: T[], index: number, direction: -1 | 1) {
  const target = index + direction;
  if (target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <>
      <Button type="submit" isDisabled={pending}>{pending ? "送信中…" : label}</Button>
      <span className="sr-only" aria-live="polite">{pending ? "送信中です" : ""}</span>
    </>
  );
}

function newSubmissionId() {
  return globalThis.crypto?.randomUUID ? `sub_${globalThis.crypto.randomUUID().replaceAll("-", "")}` : makeId("sub");
}

export type OrderFormProps = {
  mode?: OrderFormMode;
  /** 旧フォーム（mode=new）のライブ選択肢 */
  liveEvents?: LiveEvent[];
  /** 招待・編集・管理者モードで確定しているライブ */
  liveEvent?: LiveEvent | null;
  /** 招待から確定しているエントリー */
  entry?: { id: string; bandName: string } | null;
  order?: PAOrder | null;
  inviteToken?: string;
  /** 成功表示（created/updated） */
  saved?: "created" | "updated" | null;
};

export function OrderForm({ mode = "new", liveEvents = [], liveEvent = null, entry = null, order = null, inviteToken, saved = null }: OrderFormProps) {
  const fixed = { liveEventId: liveEvent?.id, bandName: mode === "invite" ? entry?.bandName : undefined };
  const firstModel = useRef<FormModel | null>(null);
  const [model, setModel] = useState<FormModel>(() => initialModel(order || undefined, fixed));
  if (firstModel.current === null) firstModel.current = model;
  const [step, setStep] = useState(0);
  const [openSongIds, setOpenSongIds] = useState(() => new Set([firstModel.current?.songs[0]?.id]));
  const [pendingLive, setPendingLive] = useState<{ id: string; limit: number; lost: number } | null>(null);
  const [draftCandidate, setDraftCandidate] = useState<StoredDraft<DraftValue> | null>(null);
  const [draftDecisionMade, setDraftDecisionMade] = useState(mode === "admin");
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [draftError, setDraftError] = useState(false);
  const [stepErrors, setStepErrors] = useState<Record<string, string>>({});
  const [reviewRevealed, setReviewRevealed] = useState(false);
  const [submissionId, setSubmissionId] = useState(newSubmissionId);
  const [dirty, setDirty] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const adminSubmitRef = useRef<HTMLButtonElement>(null);
  const action = mode === "admin" ? updateAdminOrder : mode === "submitter" ? updateSubmittedOrder : mode === "invite" ? submitInviteOrder : submitOrder;
  const [actionState, formAction] = useActionState(action, initialOrderActionState);
  const selectedLive = liveEvent || liveEvents.find((event) => event.id === model.liveEventId) || null;
  const songLimit = selectedLive?.songCount || order?.liveEventSongCount || 1;
  const storageKey = mode === "admin" ? null : draftKey(liveEvent?.id || null, entry?.id || order?.entryId || null);
  const isUpdate = Boolean(order);

  const totalSeconds = useMemo(() => model.songs.reduce((sum, song) => sum + (songSeconds(song) ?? 0), 0), [model.songs]);
  const filledSongs = model.songs.filter(isSongModelFilled);
  const allErrors = useMemo(() => ({ ...validate(model, songLimit, mode), ...actionState.fieldErrors }), [model, songLimit, mode, actionState.fieldErrors]);
  const fieldErrors = reviewRevealed ? allErrors : { ...stepErrors, ...actionState.fieldErrors };
  const memberOptions = model.members.filter(isMemberFilled);

  // 内容を変えたら新しい submissionId を使う。変えずに再送する場合は同じIDを使う
  useEffect(() => {
    if (model === firstModel.current) return;
    setDirty(true);
    setSubmissionId(newSubmissionId());
  }, [model]);

  // 端末内下書きの読み込み（ライブ＋エントリー単位。旧版の共通キーは削除）
  useEffect(() => {
    if (!storageKey) return;
    try {
      LEGACY_DRAFT_KEYS.forEach((key) => localStorage.removeItem(key));
      if (saved) {
        removeDraft(storageKey);
        setDraftDecisionMade(true);
        return;
      }
      const draft = parseStoredDraft<DraftValue>(localStorage.getItem(storageKey));
      if (draft?.value?.model) setDraftCandidate(draft);
      else setDraftDecisionMade(true);
    } catch {
      setDraftDecisionMade(true);
    }
  }, [storageKey, saved]);

  // 端末内への自動保存（サーバーには保存しない）
  useEffect(() => {
    if (!storageKey || !draftDecisionMade || !dirty) return;
    const timer = window.setTimeout(() => {
      try {
        const timestamp = Date.now();
        localStorage.setItem(storageKey, JSON.stringify({ savedAt: timestamp, value: { model, step, baseRevision: order?.contentRevision ?? null } }));
        setSavedAt(timestamp);
        setDraftError(false);
      } catch {
        setDraftError(true);
      }
    }, 750);
    return () => window.clearTimeout(timer);
  }, [draftDecisionMade, dirty, storageKey, model, step, order?.contentRevision]);

  useEffect(() => {
    const firstError = Object.keys(actionState.fieldErrors)[0];
    if (firstError) focusField(firstError);
    else if (actionState.formError) window.scrollTo({ top: 0, behavior: "smooth" });
  }, [actionState]);

  function focusField(name: string) {
    setStep(fieldStep(name));
    window.setTimeout(() => formRef.current?.querySelector<HTMLElement>(`[name="${name}"]`)?.focus(), 0);
  }

  function update(patch: Partial<FormModel>) {
    setModel((current) => ({ ...current, ...patch }));
  }

  function updateMember(index: number, patch: Partial<Member>) {
    setModel((current) => ({ ...current, members: current.members.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)) }));
  }

  function removeMember(index: number) {
    setModel((current) => {
      const removed = current.members[index];
      return {
        ...current,
        members: current.members.filter((_, itemIndex) => itemIndex !== index),
        equipment: current.equipment.map((item) => (item.memberId === removed?.id ? { ...item, memberId: null } : item)),
      };
    });
  }

  function updateEquipment(index: number, patch: Partial<Equipment>) {
    setModel((current) => ({ ...current, equipment: current.equipment.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)) }));
  }

  function updateSong(index: number, patch: Partial<SongModel>) {
    setModel((current) => ({ ...current, songs: current.songs.map((song, songIndex) => (songIndex === index ? { ...song, ...patch } : song)) }));
  }

  function selectLive(id: string) {
    const nextEvent = liveEvents.find((event) => event.id === id);
    if (!nextEvent) {
      update({ liveEventId: id });
      return;
    }
    const lost = model.songs.slice(nextEvent.songCount).filter(isSongModelFilled).length;
    if (lost > 0) {
      setPendingLive({ id, limit: nextEvent.songCount, lost });
      return;
    }
    setModel((current) => ({ ...current, liveEventId: id, songs: current.songs.slice(0, Math.max(1, nextEvent.songCount)) }));
  }

  /** 次のステップへ進む前に、その画面の必須項目を確認する */
  function goNext() {
    const errors = Object.fromEntries(Object.entries(validate(model, songLimit, mode)).filter(([name]) => fieldStep(name) === step));
    setStepErrors(errors);
    const firstError = Object.keys(errors)[0];
    if (firstError) {
      if (firstError.startsWith("song_")) {
        const index = Number(firstError.split("_")[1]);
        const songId = model.songs[index]?.id;
        if (songId) setOpenSongIds((current) => new Set(current).add(songId));
      }
      focusField(firstError);
      return;
    }
    if (step === 2) setReviewRevealed(true);
    setStep((current) => Math.min(3, current + 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function goTo(index: number) {
    if (index === 3) setReviewRevealed(true);
    setStep(index);
  }

  const heading = mode === "admin" ? "提出内容の管理者編集" : isUpdate ? "PAオーダーシート確認・更新" : "PAオーダーシート提出";
  const submitLabel = mode === "admin" ? "更新内容を保存" : isUpdate ? "この内容で更新する" : "この内容で提出する";
  const bandFixed = mode === "invite";
  const liveFixed = mode !== "new";
  const savedLabel = savedAt ? `この端末に保存済み ${new Date(savedAt).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}` : "入力内容はこの端末に自動保存されます";

  return (
    <Form ref={formRef} action={formAction} className="order-layout" validationBehavior="aria">
      {mode === "submitter" && order ? <input name="edit_token" type="hidden" value={order.editToken} /> : null}
      {mode === "admin" && order ? <input name="order_id" type="hidden" value={order.id} /> : null}
      {mode === "invite" && inviteToken ? <input name="invite_token" type="hidden" value={inviteToken} /> : null}
      {liveFixed ? <input name="live_event_id" type="hidden" value={selectedLive?.id || ""} /> : null}
      {bandFixed ? <input name="band_name" type="hidden" value={model.bandName} /> : null}
      <input name="expected_revision" type="hidden" value={order?.contentRevision ?? ""} />
      <input name="submission_id" type="hidden" value={submissionId} />
      <input name="member_count" type="hidden" value={model.members.length} />
      <input name="equipment_count" type="hidden" value={model.equipment.length} />
      <input name="song_count" type="hidden" value={model.songs.length} />
      {model.members.map((member, index) => <input key={member.id} name={`member_${index}_id`} type="hidden" value={member.id} />)}
      {model.equipment.map((item, index) => <input key={item.id} name={`equipment_${index}_id`} type="hidden" value={item.id} />)}
      {model.songs.map((song, index) => <input key={song.id} name={`song_${index}_id`} type="hidden" value={song.id} />)}

      <aside className="step-sidebar" aria-label="入力ステップ">
        <div className="sheet-mark">
          <span>PA ORDER SHEET</span>
          <strong>{heading}</strong>
        </div>
        <ol>
          {steps.map((label, index) => (
            <li key={label}>
              <button aria-current={step === index ? "step" : undefined} className="step-button" onClick={() => goTo(index)} type="button">
                <span>{index + 1}</span>
                <strong>{label}</strong>
              </button>
            </li>
          ))}
        </ol>
        {storageKey ? <InlineStatus tone={draftError ? "error" : "success"}>{draftError ? "この端末に自動保存できませんでした" : savedLabel}</InlineStatus> : null}
        {storageKey ? <p className="sidebar-note">自動保存はこのブラウザだけに残ります。運営には届いていません。</p> : null}
      </aside>

      <div className="form-workspace">
        <div className="mobile-progress">
          <ProgressIndicator step={step + 1} total={steps.length} label={steps[step]} />
        </div>
        <span className="sr-only" aria-live="polite">{steps[step]}ステップを表示中</span>
        {saved ? (
          <div className="success" role="status">
            {saved === "created" ? "提出しました。運営に届いています。このURLから内容の確認・修正ができます。" : "更新しました。新しい版として運営に届いています。"}
          </div>
        ) : null}
        {actionState.formError ? (
          <div className="error" role="alert">
            {actionState.formError}
          </div>
        ) : null}
        {draftCandidate && !draftDecisionMade ? (
          <div className="draft-restore" role="status">
            <div>
              <strong>この端末に保存された入力途中の内容があります</strong>
              <p>
                {new Date(draftCandidate.savedAt).toLocaleString("ja-JP")} の入力内容です。
                {order && draftCandidate.value.baseRevision !== order.contentRevision ? "その後、提出済みの内容が更新されています。復元する前に最新の内容を確認してください。" : ""}
              </p>
            </div>
            <div className="actions">
              <Button
                variant="primary"
                onPress={() => {
                  setModel({ ...initialModel(order || undefined, fixed), ...draftCandidate.value.model, ...(liveFixed ? { liveEventId: selectedLive?.id || "" } : {}), ...(bandFixed ? { bandName: model.bandName } : {}) });
                  setStep(Math.min(3, draftCandidate.value.step || 0));
                  setDraftDecisionMade(true);
                  setDraftCandidate(null);
                }}
              >
                入力途中の内容を復元
              </Button>
              <Button
                variant="text"
                onPress={() => {
                  if (storageKey) removeDraft(storageKey);
                  setDraftDecisionMade(true);
                  setDraftCandidate(null);
                }}
              >
                破棄する
              </Button>
            </div>
          </div>
        ) : null}

        <section className="step-panel" hidden={step !== 0} aria-labelledby="step-1-title">
          <header className="step-header">
            <span>STEP 01</span>
            <h1 id="step-1-title">出演情報</h1>
            <p>{liveFixed ? "出演するライブとバンドは確定しています。代表者を入力してください。" : "ライブと連絡に必要な情報を入力します。"}</p>
          </header>
          {mode === "new" || mode === "invite" ? (
            <div className="form-notes">
              <span>入力目安 8〜12分</span>
              <span>この端末に途中保存</span>
              <span>提出後も同じURLから修正可能</span>
            </div>
          ) : null}
          <div className="field-stack">
            {liveFixed ? (
              <dl className="fixed-info">
                <div>
                  <dt>ライブ</dt>
                  <dd>{selectedLive?.name || order?.liveEventName || "未設定"}</dd>
                </div>
                {bandFixed ? (
                  <div>
                    <dt>バンド名</dt>
                    <dd>{model.bandName}</dd>
                  </div>
                ) : null}
                {selectedLive?.submissionDeadlineAt ? (
                  <div>
                    <dt>提出締切</dt>
                    <dd>{new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium", timeStyle: "short", timeZone: selectedLive.timeZone }).format(new Date(selectedLive.submissionDeadlineAt))}</dd>
                  </div>
                ) : null}
              </dl>
            ) : (
              <SelectField
                label="ライブ"
                name="live_event_id"
                isRequired
                selectedKey={model.liveEventId || null}
                error={fieldErrors.live_event_id}
                onSelectionChange={(key) => selectLive(String(key || ""))}
                options={liveEvents.map((event) => ({ value: event.id, label: event.name, description: `最大 ${event.songCount}曲` }))}
              />
            )}
            <div className="grid two">
              {bandFixed ? null : (
                <TextField label="バンド名" name="band_name" isRequired value={model.bandName} error={fieldErrors.band_name} description="例：放課後セッション" onChange={(value) => update({ bandName: value })} inputProps={{ maxLength: 120, autoComplete: "organization" }} />
              )}
              <TextField label="代表者名" name="contact_name" isRequired value={model.contactName} error={fieldErrors.contact_name} description="当日、運営から連絡する人の名前" onChange={(value) => update({ contactName: value })} inputProps={{ maxLength: 80, autoComplete: "name" }} />
            </div>
          </div>
        </section>

        <section className="step-panel" hidden={step !== 1} aria-labelledby="step-2-title">
          <header className="step-header">
            <span>STEP 02</span>
            <h1 id="step-2-title">メンバー・機材</h1>
            <p>出演メンバー、マイク、持ち込み機材、音源の使用を入力します。</p>
          </header>
          <FieldGroup
            title="メンバー"
            description="名前と担当楽器を入力します。担当楽器は候補から選ぶか、直接入力できます。空欄の行は送信されません。"
            action={<Button variant="secondary" isDisabled={model.members.length >= MAX_MEMBER_COUNT} onPress={() => update({ members: [...model.members, makeEmptyMember()] })}>メンバーを追加</Button>}
          >
            <datalist id="instrument-options">{instrumentOptions.map((item) => <option value={item} key={item} />)}</datalist>
            <div className="dynamic-list">
              {model.members.map((member, index) => (
                <div className="dynamic-row" key={member.id}>
                  <span className="row-number">{index + 1}</span>
                  <TextField label="名前" name={`member_${index}_name`} optional value={member.name} error={fieldErrors[`member_${index}_name`]} onChange={(value) => updateMember(index, { name: value })} inputProps={{ maxLength: 80 }} />
                  <TextField label="担当楽器" name={`member_${index}_instrument`} optional value={member.instrument} placeholder="例：Gt.Vo" onChange={(value) => updateMember(index, { instrument: value })} inputProps={{ list: "instrument-options", maxLength: 80 }} />
                  <div className="row-actions">
                    <Button variant="text" aria-label={`${index + 1}人目のメンバーを上へ`} isDisabled={index === 0} onPress={() => update({ members: move(model.members, index, -1) })}>上へ</Button>
                    <Button variant="text" aria-label={`${index + 1}人目のメンバーを下へ`} isDisabled={index === model.members.length - 1} onPress={() => update({ members: move(model.members, index, 1) })}>下へ</Button>
                    <Button variant="text" aria-label={`${index + 1}人目のメンバーを削除`} onPress={() => removeMember(index)}>削除</Button>
                  </div>
                </div>
              ))}
            </div>
          </FieldGroup>

          <FieldGroup title="マイク" description="ボーカル・コーラス・MCで使うマイクの合計本数です。">
            <NumberField label="使用するマイクの本数" name="microphone_count" minValue={0} maxValue={99} step={1} value={model.microphoneCount} error={fieldErrors.microphone_count} onChange={(value) => update({ microphoneCount: Number.isFinite(value) ? value : 0 })} />
          </FieldGroup>

          <FieldGroup
            title="持ち込み機材"
            description="エフェクターボード、キーボード、シンセなど、自分たちで持ち込む機材だけ追加してください。なければ空欄で構いません。"
            action={<Button variant="secondary" isDisabled={model.equipment.length >= MAX_EQUIPMENT_COUNT} onPress={() => update({ equipment: [...model.equipment, makeEmptyEquipmentItem()] })}>持ち込み機材を追加</Button>}
          >
            {model.equipment.length === 0 ? (
              <p className="empty-compact">持ち込み機材はまだ追加されていません。</p>
            ) : (
              <div className="dynamic-list">
                {model.equipment.map((item, index) => (
                  <div className="dynamic-row equipment-row" key={item.id}>
                    <span className="row-number">{index + 1}</span>
                    <TextField label="機材名" name={`equipment_${index}_name`} isRequired value={item.name} error={fieldErrors[`equipment_${index}_name`]} placeholder="例：エフェクターボード" onChange={(value) => updateEquipment(index, { name: value })} inputProps={{ maxLength: 160 }} />
                    <label className="field">
                      <span className="label">
                        使用者 <span className="optional">任意</span>
                      </span>
                      <select className="select" name={`equipment_${index}_member_id`} value={item.memberId || ""} onChange={(event) => updateEquipment(index, { memberId: event.target.value || null })}>
                        <option value="">選択しない</option>
                        {memberOptions.map((member) => (
                          <option key={member.id} value={member.id}>
                            {member.name || "名前未入力"}
                            {member.instrument ? `（${member.instrument}）` : ""}
                          </option>
                        ))}
                      </select>
                    </label>
                    <TextField label="担当楽器・用途" name={`equipment_${index}_instrument`} optional value={item.instrument} placeholder="例：Gt" onChange={(value) => updateEquipment(index, { instrument: value })} inputProps={{ list: "instrument-options", maxLength: 80 }} />
                    <div className="row-actions">
                      <Button variant="text" aria-label={`${index + 1}件目の機材を上へ`} isDisabled={index === 0} onPress={() => update({ equipment: move(model.equipment, index, -1) })}>上へ</Button>
                      <Button variant="text" aria-label={`${index + 1}件目の機材を下へ`} isDisabled={index === model.equipment.length - 1} onPress={() => update({ equipment: move(model.equipment, index, 1) })}>下へ</Button>
                      <Button variant="text" aria-label={`${index + 1}件目の持ち込み機材を削除`} onPress={() => update({ equipment: model.equipment.filter((_, itemIndex) => itemIndex !== index) })}>削除</Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </FieldGroup>

          <FieldGroup title="音源・同期音源" description="同期音源、SE、クリックなどを再生する場合にチェックしてください。">
            <CheckboxField name="uses_backing_track" isSelected={model.usesBackingTrack} onChange={(value) => update({ usesBackingTrack: value })}>
              音源を使用する
            </CheckboxField>
            {model.usesBackingTrack ? (
              <div className="conditional-fields">
                <datalist id="member-name-options">{memberOptions.map((member) => <option value={member.name} key={member.id} />)}</datalist>
                <div className="grid two">
                  <TextField label="再生担当" name="backing_track_operator" isRequired value={model.backingTrack.operator} error={fieldErrors.backing_track_operator} placeholder="例：山田（Key）" onChange={(value) => update({ backingTrack: { ...model.backingTrack, operator: value } })} inputProps={{ list: "member-name-options", maxLength: 80 }} />
                  <TextField label="再生端末" name="backing_track_device" isRequired value={model.backingTrack.device} error={fieldErrors.backing_track_device} placeholder="例：ノートPC、iPhone" onChange={(value) => update({ backingTrack: { ...model.backingTrack, device: value } })} inputProps={{ maxLength: 120 }} />
                </div>
                <datalist id="connection-options">{connectionOptions.map((option) => <option value={option} key={option} />)}</datalist>
                <TextField label="接続方法" name="backing_track_connection" isRequired value={model.backingTrack.connection} error={fieldErrors.backing_track_connection} description="分からない場合は「未定」と入力してください。" onChange={(value) => update({ backingTrack: { ...model.backingTrack, connection: value } })} inputProps={{ list: "connection-options", maxLength: 120 }} />
              </div>
            ) : null}
          </FieldGroup>
        </section>

        <section className="step-panel" hidden={step !== 2} aria-labelledby="step-3-title">
          <header className="step-header">
            <span>STEP 03</span>
            <h1 id="step-3-title">セットリスト</h1>
            <p>演奏順に、曲名と演奏時間を入力します。曲調やPAへの要望は曲ごとに開いて入力できます。</p>
          </header>
          <div className="setlist-toolbar">
            <div>
              <strong>{filledSongs.length}曲入力中</strong>
              <span>このライブは最大 {songLimit}曲</span>
            </div>
            <div>
              <span>楽曲の合計（MC・転換は含みません）</span>
              <strong>{formatDuration(totalSeconds)}</strong>
            </div>
            <Button
              variant="secondary"
              isDisabled={!selectedLive || model.songs.length >= songLimit}
              onPress={() => {
                const song = emptySongModel();
                update({ songs: [...model.songs, song] });
                setOpenSongIds((current) => new Set(current).add(song.id));
              }}
            >
              曲を追加
            </Button>
          </div>
          {fieldErrors.song_count ? <p className="field-error" role="alert">{fieldErrors.song_count}</p> : null}
          <div className="song-list">
            {model.songs.map((song, index) => {
              const seconds = songSeconds(song);
              const complete = Boolean(song.title.trim()) && seconds !== null;
              const needsCheck = Boolean(song.legacyDuration) && seconds === null;
              return (
                <details
                  className="song-card"
                  key={song.id}
                  open={openSongIds.has(song.id)}
                  onToggle={(event) => {
                    const isOpen = event.currentTarget.open;
                    setOpenSongIds((current) => {
                      const next = new Set(current);
                      if (isOpen) next.add(song.id);
                      else next.delete(song.id);
                      return next;
                    });
                  }}
                >
                  <summary>
                    <span className="song-order">{String(index + 1).padStart(2, "0")}</span>
                    <span className="song-title-summary">
                      <strong>{song.title || "曲名を入力"}</strong>
                      <small>
                        {seconds !== null ? formatDurationJa(seconds) : "時間未入力"} ・ {song.mc.hasMc ? "MCあり" : "MCなし"}
                      </small>
                    </span>
                    <span className={`completion ${complete ? "complete" : "incomplete"}`}>{needsCheck ? "要確認" : complete ? "入力済み" : isSongModelFilled(song) ? "入力途中" : "未入力"}</span>
                  </summary>
                  <div className="song-fields">
                    <div className="song-controls">
                      <Button variant="text" aria-label={`${index + 1}曲目を上へ`} isDisabled={index === 0} onPress={() => update({ songs: move(model.songs, index, -1) })}>上へ</Button>
                      <Button variant="text" aria-label={`${index + 1}曲目を下へ`} isDisabled={index === model.songs.length - 1} onPress={() => update({ songs: move(model.songs, index, 1) })}>下へ</Button>
                      {model.songs.length > 1 ? <Button variant="text" aria-label={`${index + 1}曲目を削除`} onPress={() => update({ songs: model.songs.filter((_, songIndex) => songIndex !== index) })}>削除</Button> : null}
                    </div>
                    <TextField label="曲名" name={`song_${index}_title`} isRequired value={song.title} error={fieldErrors[`song_${index}_title`]} placeholder="例：はじまりの歌" onChange={(value) => updateSong(index, { title: value })} inputProps={{ maxLength: 160 }} />
                    <fieldset className="duration-field">
                      <legend>
                        演奏時間 <span className="required">必須</span>
                      </legend>
                      <p className="field-description">曲の長さだけを入力します（MC・転換は含みません）。例：4分30秒</p>
                      {needsCheck ? <p className="legacy-note">以前の入力「{song.legacyDuration}」は時間として読み取れませんでした。分と秒で入力し直してください。</p> : null}
                      <div className="duration-inputs">
                        <label>
                          <input className="input" name={`song_${index}_duration_min`} inputMode="numeric" pattern="[0-9]*" maxLength={2} aria-label={`${index + 1}曲目の演奏時間（分）`} aria-invalid={Boolean(fieldErrors[`song_${index}_duration_min`])} value={song.minutes} onChange={(event) => updateSong(index, { minutes: event.target.value.replace(/[^0-9]/g, "") })} />
                          <span>分</span>
                        </label>
                        <label>
                          <input className="input" name={`song_${index}_duration_sec`} inputMode="numeric" pattern="[0-9]*" maxLength={2} aria-label={`${index + 1}曲目の演奏時間（秒）`} value={song.seconds} onChange={(event) => updateSong(index, { seconds: event.target.value.replace(/[^0-9]/g, "") })} />
                          <span>秒</span>
                        </label>
                      </div>
                      {fieldErrors[`song_${index}_duration_min`] ? <p className="field-error">{fieldErrors[`song_${index}_duration_min`]}</p> : null}
                    </fieldset>
                    <TextField label="曲調" name={`song_${index}_mood`} optional value={song.mood} placeholder="例：静かなバラード、アップテンポ" onChange={(value) => updateSong(index, { mood: value })} inputProps={{ maxLength: 80 }} />
                    <div className="field">
                      <span className="label">
                        始まり方 <span className="optional">任意</span>
                      </span>
                      <div className="choice-chips">
                        {triggerOptions.map((option) => (
                          <Button className={song.startTrigger === option ? "selected" : ""} variant="secondary" key={option} aria-pressed={song.startTrigger === option} onPress={() => updateSong(index, { startTrigger: option })}>
                            {option}
                          </Button>
                        ))}
                      </div>
                      <TextField aria-label="始まり方を自由入力" label="自由入力" name={`song_${index}_start_trigger`} optional value={song.startTrigger} onChange={(value) => updateSong(index, { startTrigger: value })} inputProps={{ maxLength: 120 }} />
                    </div>
                    <CheckboxField name={`song_${index}_has_mc`} isSelected={song.mc.hasMc} onChange={(value) => updateSong(index, { mc: { ...song.mc, hasMc: value } })}>
                      この曲の後にMCあり
                    </CheckboxField>
                    {song.mc.hasMc ? <TextField label="MC担当" name={`song_${index}_mc_person`} optional value={song.mc.person} onChange={(value) => updateSong(index, { mc: { ...song.mc, person: value } })} inputProps={{ list: "member-name-options", maxLength: 80 }} /> : null}
                    <TextAreaField label="PAへの要望" name={`song_${index}_pa_request`} value={song.paRequest} description="例：ギターソロで少し音量を上げてください。特になければ空欄で構いません。" onChange={(value) => updateSong(index, { paRequest: value })} maxLength={1000} />
                  </div>
                </details>
              );
            })}
          </div>
          <TextAreaField label="バンド全体・全曲を通しての要望" name="general_request" value={model.generalRequest} description="照明・立ち位置・返しの音量など、全体に関わる内容。特になければ空欄で構いません。" onChange={(value) => update({ generalRequest: value })} maxLength={2000} />
        </section>

        <section className="step-panel review-panel" hidden={step !== 3} aria-labelledby="step-4-title">
          <header className="step-header">
            <span>STEP 04</span>
            <h1 id="step-4-title">確認・{isUpdate ? "更新" : "提出"}</h1>
            <p>内容を確認してください。各項目の「修正」から入力画面へ戻れます。</p>
          </header>
          {Object.keys(allErrors).length ? (
            <div className="error-summary" role="alert">
              <h2>未入力または確認が必要な項目があります</h2>
              <ul>
                {Object.entries(allErrors).map(([name, message]) => (
                  <li key={name}>
                    <button type="button" onClick={() => focusField(name)}>
                      {message}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <ReviewGroup title="出演情報" onEdit={() => setStep(0)}>
            <dl>
              <ReviewItem label="ライブ" value={selectedLive?.name || "未選択"} />
              <ReviewItem label="バンド名" value={model.bandName || "未入力"} />
              <ReviewItem label="代表者" value={model.contactName || "未入力"} />
            </dl>
          </ReviewGroup>
          <ReviewGroup title="メンバー・機材" onEdit={() => setStep(1)}>
            <h3>メンバー</h3>
            {memberOptions.length ? (
              <ul className="review-list">
                {memberOptions.map((item) => (
                  <li key={item.id}>
                    <strong>{item.name || "名前未入力"}</strong>
                    <span>{item.instrument || "担当未入力"}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p>未入力</p>
            )}
            <dl>
              <ReviewItem label="マイク本数" value={`${model.microphoneCount}本`} />
              <ReviewItem label="音源使用" value={model.usesBackingTrack ? `あり（再生担当：${model.backingTrack.operator || "未入力"}／端末：${model.backingTrack.device || "未入力"}／接続：${model.backingTrack.connection || "未入力"}）` : "なし"} />
            </dl>
            <h3>持ち込み機材</h3>
            {model.equipment.some(isEquipmentFilled) ? (
              <ul className="review-list">
                {model.equipment.filter(isEquipmentFilled).map((item) => (
                  <li key={item.id}>
                    <strong>{item.name || "機材名未入力"}</strong>
                    <span>
                      {[memberOptions.find((member) => member.id === item.memberId)?.name, item.instrument].filter(Boolean).join("・") || "使用者未指定"}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p>なし</p>
            )}
          </ReviewGroup>
          <ReviewGroup title="セットリスト・要望" onEdit={() => setStep(2)}>
            <dl>
              <ReviewItem label="曲数" value={`${filledSongs.length}曲`} />
              <ReviewItem label="楽曲の合計" value={`${formatDuration(totalSeconds)}（MC・転換は含みません）`} />
              <ReviewItem label="MC回数" value={`${filledSongs.filter((song) => song.mc.hasMc).length}回`} />
            </dl>
            <ol className="review-setlist">
              {filledSongs.map((song, index) => {
                const seconds = songSeconds(song);
                return (
                  <li key={song.id}>
                    <div>
                      <strong>
                        {index + 1}. {song.title || "曲名未入力"}
                      </strong>
                      <span>
                        {seconds !== null ? formatDurationJa(seconds) : "時間未入力"}
                        {song.mc.hasMc ? ` ・ MC ${song.mc.person || "担当未入力"}` : ""}
                      </span>
                    </div>
                    {song.paRequest ? (
                      <p>
                        <b>PA要望：</b>
                        {song.paRequest}
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ol>
            {model.generalRequest ? (
              <p className="review-request">
                <b>全体要望：</b>
                {model.generalRequest}
              </p>
            ) : null}
          </ReviewGroup>
          <div className="submit-area">
            <p>
              {mode === "admin"
                ? "保存すると提出内容の新しい版になり、確認済みの版との差分が表示されます。"
                : isUpdate
                  ? "「更新する」を押すと新しい版として運営に届き、運営の画面に「更新あり」と表示されます。"
                  : "「提出する」を押すと運営に届きます。提出後もこのURLから内容を確認・修正できます。"}
            </p>
            {mode === "admin" ? (
              <>
                <button ref={adminSubmitRef} hidden type="submit" />
                <ConfirmDialog title="提出内容を更新しますか？" confirmLabel="更新する" trigger={<Button>{submitLabel}</Button>} onConfirm={() => adminSubmitRef.current?.click()}>
                  保存すると提出内容の新しい版（版{(order?.contentRevision || 0) + 1}）になります。
                </ConfirmDialog>
              </>
            ) : (
              <SubmitButton label={submitLabel} />
            )}
          </div>
        </section>

        <nav className="step-footer" aria-label="ステップ移動">
          {step > 0 ? <Button variant="secondary" onPress={() => setStep((current) => current - 1)}>戻る</Button> : <span />}
          {step < 3 ? <Button onPress={goNext}>次へ</Button> : null}
        </nav>
      </div>

      <ControlledConfirmDialog
        isOpen={Boolean(pendingLive)}
        onOpenChange={(open) => {
          if (!open) setPendingLive(null);
        }}
        title="ライブを変更しますか？"
        confirmLabel="変更する"
        danger
        onConfirm={() => {
          if (!pendingLive) return;
          setModel((current) => ({ ...current, liveEventId: pendingLive.id, songs: current.songs.slice(0, pendingLive.limit) }));
          setPendingLive(null);
        }}
      >
        <p>入力済みの曲が上限を超えるため、末尾の{pendingLive?.lost || 0}曲が失われます。</p>
      </ControlledConfirmDialog>
    </Form>
  );
}

function ReviewGroup({ title, onEdit, children }: { title: string; onEdit: () => void; children: React.ReactNode }) {
  return (
    <section className="review-group">
      <header>
        <h2>{title}</h2>
        <Button variant="text" onPress={onEdit}>
          修正
        </Button>
      </header>
      {children}
    </section>
  );
}

function ReviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
