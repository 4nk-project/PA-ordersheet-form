"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Form } from "react-aria-components";
import { submitOrder, updateAdminOrder, updateSubmittedOrder } from "./actions";
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
import { ORDER_DRAFT_KEY, parseStoredDraft, type StoredDraft } from "@/lib/draft";
import { formatDuration, makeEmptyEquipment, makeEmptyMembers, makeEmptySongs, makeId, MAX_EQUIPMENT_COUNT, MAX_MEMBER_COUNT, totalDurationSeconds } from "@/lib/orderSchema";
import type { Equipment, LiveEvent, Member, PAOrder, Song } from "@/types/order";

const steps = ["基本情報", "メンバー・機材", "セットリスト", "確認・提出"] as const;
const instrumentOptions = ["Vo", "Gt", "Ba", "Dr", "Key", "Cho", "Perc", "その他"];
const triggerOptions = ["ドラム4カウント", "ギターから", "ボーカルから", "音源から", "合図から", "その他"];

type FormModel = {
  liveEventId: string;
  bandName: string;
  contactName: string;
  microphoneCount: number;
  usesBackingTrack: boolean;
  members: Member[];
  equipment: Equipment[];
  songs: Song[];
  generalRequest: string;
};

type DraftValue = { model: FormModel; step: number };

function initialModel(order?: PAOrder): FormModel {
  return {
    liveEventId: order?.liveEventId || "",
    bandName: order?.bandName || "",
    contactName: order?.contactName || "",
    microphoneCount: order?.microphoneCount || 0,
    usesBackingTrack: order?.usesBackingTrack || false,
    members: order?.members.length ? order.members : makeEmptyMembers(),
    equipment: order?.equipment.length ? order.equipment : makeEmptyEquipment(),
    songs: order?.songs.length ? order.songs : makeEmptySongs(1),
    generalRequest: order?.generalRequest || "",
  };
}

function hasSongValue(song: Song) {
  return Boolean(song.title || song.duration || song.mood || song.startTrigger || song.paRequest || song.mc.hasMc || song.mc.person);
}

function fieldStep(name: string) {
  if (name.startsWith("member_") || name.startsWith("equipment_")) return 1;
  if (name.startsWith("song_")) return 2;
  if (name === "general_request") return 2;
  return 0;
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <><Button type="submit" isDisabled={pending}>{pending ? "送信中…" : label}</Button><span className="sr-only" aria-live="polite">{pending ? "送信中です" : ""}</span></>;
}

export function OrderForm({ liveEvents, mode = "new", order, updated }: { liveEvents: LiveEvent[]; mode?: "new" | "submitter" | "admin"; order?: PAOrder; updated?: boolean }) {
  const [model, setModel] = useState<FormModel>(() => initialModel(order));
  const [step, setStep] = useState(0);
  const [openSongIds, setOpenSongIds] = useState(() => new Set([initialModel(order).songs[0]?.id]));
  const [pendingLive, setPendingLive] = useState<{ id: string; limit: number; lost: number } | null>(null);
  const [draftCandidate, setDraftCandidate] = useState<StoredDraft<DraftValue> | null>(null);
  const [draftDecisionMade, setDraftDecisionMade] = useState(mode !== "new");
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [draftError, setDraftError] = useState(false);
  const [validationRevealed, setValidationRevealed] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const adminSubmitRef = useRef<HTMLButtonElement>(null);
  const action = mode === "admin" ? updateAdminOrder : mode === "submitter" ? updateSubmittedOrder : submitOrder;
  const [actionState, formAction] = useActionState(action, initialOrderActionState);
  const selectedLive = liveEvents.find((event) => event.id === model.liveEventId);
  const songLimit = selectedLive?.songCount || order?.liveEventSongCount || 1;
  const totalSeconds = useMemo(() => totalDurationSeconds(model.songs), [model.songs]);

  const clientErrors = useMemo(() => {
    const errors: Record<string, string> = {};
    if (!model.liveEventId) errors.live_event_id = "ライブを選択してください。";
    if (!model.bandName.trim()) errors.band_name = "バンド名を入力してください。";
    if (!model.contactName.trim()) errors.contact_name = "代表者名を入力してください。";
    if (!model.songs[0]?.title.trim()) errors.song_0_title = "1曲目の曲名を入力してください。";
    if (!Number.isInteger(model.microphoneCount) || model.microphoneCount < 0) errors.microphone_count = "0以上の整数で入力してください。";
    if (model.songs.length > songLimit) errors.song_count = `曲数を${songLimit}曲以内にしてください。`;
    return errors;
  }, [model, songLimit]);
  const allErrors = { ...clientErrors, ...actionState.fieldErrors };
  const fieldErrors = validationRevealed ? allErrors : actionState.fieldErrors;

  useEffect(() => {
    if (mode !== "new") return;
    const draft = parseStoredDraft<DraftValue>(localStorage.getItem(ORDER_DRAFT_KEY));
    if (draft) setDraftCandidate(draft);
    else setDraftDecisionMade(true);
  }, [mode]);

  useEffect(() => {
    if (mode !== "new" || !draftDecisionMade) return;
    const timer = window.setTimeout(() => {
      try {
        const timestamp = Date.now();
        localStorage.setItem(ORDER_DRAFT_KEY, JSON.stringify({ savedAt: timestamp, value: { model, step } }));
        setSavedAt(timestamp); setDraftError(false);
      } catch {
        setDraftError(true);
      }
    }, 750);
    return () => window.clearTimeout(timer);
  }, [draftDecisionMade, mode, model, step]);

  useEffect(() => {
    const firstError = Object.keys(actionState.fieldErrors)[0];
    if (!firstError) return;
    focusField(firstError);
  }, [actionState]);

  function focusField(name: string) {
    setValidationRevealed(true);
    setStep(fieldStep(name));
    window.setTimeout(() => formRef.current?.querySelector<HTMLElement>(`[name="${name}"]`)?.focus(), 0);
  }

  function updateMember(index: number, key: "name" | "instrument", value: string) {
    setModel((current) => ({ ...current, members: current.members.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item) }));
  }

  function updateEquipment(index: number, key: "name" | "instrument", value: string) {
    setModel((current) => ({ ...current, equipment: current.equipment.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item) }));
  }

  function updateSong(index: number, patch: Partial<Song>) {
    setModel((current) => ({ ...current, songs: current.songs.map((song, songIndex) => songIndex === index ? { ...song, ...patch } : song) }));
  }

  function moveSong(index: number, direction: -1 | 1) {
    setModel((current) => {
      const next = [...current.songs];
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return { ...current, songs: next.map((song, songIndex) => ({ ...song, order: songIndex + 1 })) };
    });
  }

  function selectLive(id: string) {
    const nextEvent = liveEvents.find((event) => event.id === id);
    if (!nextEvent) { setModel((current) => ({ ...current, liveEventId: id })); return; }
    const lost = model.songs.slice(nextEvent.songCount).filter(hasSongValue).length;
    if (lost > 0) { setPendingLive({ id, limit: nextEvent.songCount, lost }); return; }
    setModel((current) => ({ ...current, liveEventId: id, songs: current.songs.slice(0, nextEvent.songCount) }));
  }

  function goToReview() {
    setValidationRevealed(true);
    setStep(3);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const stepHeading = mode === "admin" ? "提出内容の管理者編集" : mode === "submitter" ? "PAオーダーシート確認・編集" : "PAオーダーシート提出";

  return (
    <Form ref={formRef} action={formAction} className="order-layout" validationBehavior="aria">
      {order && mode !== "admin" ? <input name="edit_token" type="hidden" value={order.editToken} /> : null}
      {order && mode === "admin" ? <input name="order_id" type="hidden" value={order.id} /> : null}
      <input name="live_event_name" type="hidden" value={selectedLive?.name || ""} />
      <input name="member_count" type="hidden" value={model.members.length} />
      <input name="equipment_count" type="hidden" value={model.equipment.length} />
      <input name="song_count" type="hidden" value={model.songs.length} />

      <aside className="step-sidebar" aria-label="入力ステップ">
        <div className="sheet-mark"><span>PA ORDER SHEET</span><strong>{stepHeading}</strong></div>
        <ol>{steps.map((label, index) => <li key={label}><button aria-current={step === index ? "step" : undefined} className="step-button" onClick={() => { if (index === 3) setValidationRevealed(true); setStep(index); }} type="button"><span>{index + 1}</span><strong>{label}</strong></button></li>)}</ol>
        {mode === "new" ? <InlineStatus tone={draftError ? "error" : "success"}>{draftError ? "この端末に自動保存できませんでした" : savedAt ? `この端末に保存済み ${new Date(savedAt).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}` : "入力内容はこの端末に自動保存されます"}</InlineStatus> : null}
      </aside>

      <div className="form-workspace">
        <div className="mobile-progress"><ProgressIndicator step={step + 1} total={steps.length} label={steps[step]} /></div><span className="sr-only" aria-live="polite">{steps[step]}ステップを表示中</span>
        {updated ? <div className="success">提出内容を更新しました。</div> : null}
        {actionState.formError ? <div className="error" role="alert">{actionState.formError}</div> : null}
        {draftCandidate && !draftDecisionMade ? <div className="draft-restore" role="status"><div><strong>保存された下書きがあります</strong><p>{new Date(draftCandidate.savedAt).toLocaleString("ja-JP")} の入力内容です。</p></div><div className="actions"><Button variant="primary" onPress={() => { setModel(draftCandidate.value.model); setStep(Math.min(3, draftCandidate.value.step)); setDraftDecisionMade(true); setDraftCandidate(null); }}>下書きを復元</Button><Button variant="text" onPress={() => { localStorage.removeItem(ORDER_DRAFT_KEY); setDraftDecisionMade(true); setDraftCandidate(null); }}>下書きを破棄</Button></div></div> : null}

        <section className="step-panel" hidden={step !== 0} aria-labelledby="step-1-title">
          <header className="step-header"><span>STEP 01</span><h1 id="step-1-title">基本情報</h1><p>まず、ライブと連絡に必要な情報を入力します。</p></header>
          {mode === "new" ? <div className="form-notes"><span>入力目安 8〜12分</span><span>途中保存あり</span><span>提出後も編集可能</span></div> : null}
          <div className="field-stack">
            <SelectField label="ライブ" name="live_event_id" isRequired selectedKey={model.liveEventId || null} error={fieldErrors.live_event_id} onSelectionChange={(key) => selectLive(String(key || ""))} options={liveEvents.map((event) => ({ value: event.id, label: event.name, description: `最大 ${event.songCount}曲` }))} />
            <div className="grid two">
              <TextField label="バンド名" name="band_name" isRequired value={model.bandName} error={fieldErrors.band_name} onChange={(value) => setModel((current) => ({ ...current, bandName: value }))} inputProps={{ maxLength: 120, autoComplete: "organization" }} />
              <TextField label="代表者名" name="contact_name" isRequired value={model.contactName} error={fieldErrors.contact_name} onChange={(value) => setModel((current) => ({ ...current, contactName: value }))} inputProps={{ maxLength: 80, autoComplete: "name" }} />
            </div>
            <NumberField label="使用するマイクの本数" name="microphone_count" minValue={0} step={1} value={model.microphoneCount} error={fieldErrors.microphone_count} onChange={(value) => setModel((current) => ({ ...current, microphoneCount: value }))} />
            <CheckboxField name="uses_backing_track" isSelected={model.usesBackingTrack} onChange={(value) => setModel((current) => ({ ...current, usesBackingTrack: value }))}>音源・同期音源を使用する</CheckboxField>
            {model.usesBackingTrack ? <div className="conditional-note"><strong>音源・同期音源について</strong><p>再生端末・接続方法・再生担当などの詳細は、現行データとの互換性を保つため今回のフォームでは全体要望へ記入してください。</p></div> : null}
          </div>
        </section>

        <section className="step-panel" hidden={step !== 1} aria-labelledby="step-2-title">
          <header className="step-header"><span>STEP 02</span><h1 id="step-2-title">メンバー・機材</h1><p>必要な人数・機材だけ追加してください。</p></header>
          <FieldGroup title="メンバー" description="名前と担当楽器を入力します。候補以外も直接入力できます。" action={<Button variant="secondary" isDisabled={model.members.length >= MAX_MEMBER_COUNT} onPress={() => setModel((current) => ({ ...current, members: [...current.members, { id: makeId("member"), name: "", instrument: "" }] }))}>メンバーを追加</Button>}>
            <datalist id="instrument-options">{instrumentOptions.map((item) => <option value={item} key={item} />)}</datalist>
            <div className="dynamic-list">{model.members.map((member, index) => <div className="dynamic-row" key={member.id}><span className="row-number">{index + 1}</span><TextField label="名前" name={`member_${index}_name`} optional value={member.name} onChange={(value) => updateMember(index, "name", value)} inputProps={{ maxLength: 80 }} /><TextField label="担当楽器" name={`member_${index}_instrument`} optional value={member.instrument} onChange={(value) => updateMember(index, "instrument", value)} inputProps={{ list: "instrument-options", maxLength: 80 }} /><Button variant="text" aria-label={`${index + 1}人目のメンバーを削除`} onPress={() => setModel((current) => ({ ...current, members: current.members.filter((_, itemIndex) => itemIndex !== index) }))}>削除</Button></div>)}</div>
          </FieldGroup>
          <FieldGroup title="持ち込み機材" description="持ち込みがある場合だけ追加してください。" action={<Button variant="secondary" isDisabled={model.equipment.length >= MAX_EQUIPMENT_COUNT} onPress={() => setModel((current) => ({ ...current, equipment: [...current.equipment, { id: makeId("equipment"), name: "", instrument: "" }] }))}>持ち込み機材を追加</Button>}>
            {model.equipment.length === 0 ? <p className="empty-compact">持ち込み機材はまだ追加されていません。</p> : <div className="dynamic-list">{model.equipment.map((item, index) => <div className="dynamic-row" key={item.id}><span className="row-number">{index + 1}</span><TextField label="機材名" name={`equipment_${index}_name`} optional value={item.name} onChange={(value) => updateEquipment(index, "name", value)} inputProps={{ maxLength: 160 }} /><TextField label="使用者・担当楽器" name={`equipment_${index}_instrument`} optional value={item.instrument} onChange={(value) => updateEquipment(index, "instrument", value)} inputProps={{ maxLength: 80 }} /><Button variant="text" aria-label={`${index + 1}件目の持ち込み機材を削除`} onPress={() => setModel((current) => ({ ...current, equipment: current.equipment.filter((_, itemIndex) => itemIndex !== index) }))}>削除</Button></div>)}</div>}
          </FieldGroup>
        </section>

        <section className="step-panel" hidden={step !== 2} aria-labelledby="step-3-title">
          <header className="step-header"><span>STEP 03</span><h1 id="step-3-title">セットリスト</h1><p>曲順とPAに伝えたい内容を入力します。</p></header>
          <div className="setlist-toolbar"><div><strong>{model.songs.length}曲入力中</strong><span>あと {Math.max(0, songLimit - model.songs.length)}曲追加できます</span></div><div><span>合計演奏時間</span><strong>{formatDuration(totalSeconds)}</strong></div><Button variant="secondary" isDisabled={!selectedLive || model.songs.length >= songLimit} onPress={() => { const song = { ...makeEmptySongs(1)[0], id: makeId("song"), order: model.songs.length + 1 }; setModel((current) => ({ ...current, songs: [...current.songs, song] })); setOpenSongIds((current) => new Set(current).add(song.id)); }}>曲を追加</Button></div>
          {fieldErrors.song_count ? <p className="field-error" role="alert">{fieldErrors.song_count}</p> : null}
          <div className="song-list">{model.songs.map((song, index) => {
            const complete = Boolean(song.title.trim());
            return <details className="song-card" key={song.id} open={openSongIds.has(song.id)} onToggle={(event) => setOpenSongIds((current) => { const next = new Set(current); event.currentTarget.open ? next.add(song.id) : next.delete(song.id); return next; })}>
              <summary><span className="song-order">{String(index + 1).padStart(2, "0")}</span><span className="song-title-summary"><strong>{song.title || "曲名を入力"}</strong><small>{song.duration || "時間未入力"} ・ {song.mc.hasMc ? "MCあり" : "MCなし"}</small></span><span className={`completion ${complete ? "complete" : "incomplete"}`}>{complete ? "入力済み" : "未入力"}</span></summary>
              <div className="song-fields">
                <div className="song-controls"><Button variant="text" isDisabled={index === 0} onPress={() => moveSong(index, -1)}>上へ</Button><Button variant="text" isDisabled={index === model.songs.length - 1} onPress={() => moveSong(index, 1)}>下へ</Button>{model.songs.length > 1 ? <Button variant="text" aria-label={`${index + 1}曲目を削除`} onPress={() => setModel((current) => ({ ...current, songs: current.songs.filter((_, songIndex) => songIndex !== index).map((item, orderIndex) => ({ ...item, order: orderIndex + 1 })) }))}>削除</Button> : null}</div>
                <div className="grid two"><TextField label="曲名" name={`song_${index}_title`} isRequired={index === 0} optional={index !== 0} value={song.title} error={fieldErrors[`song_${index}_title`]} onChange={(value) => updateSong(index, { title: value })} inputProps={{ maxLength: 160 }} /><TextField label="演奏時間" name={`song_${index}_duration`} optional value={song.duration} description="分:秒（例 4:30）" onChange={(value) => updateSong(index, { duration: value })} inputProps={{ maxLength: 16, inputMode: "numeric" }} /></div>
                <TextField label="曲調" name={`song_${index}_mood`} optional value={song.mood} placeholder="例：静かなバラード、アップテンポ" onChange={(value) => updateSong(index, { mood: value })} inputProps={{ maxLength: 80 }} />
                <div className="field"><span className="label">始まりのきっかけ <span className="optional">任意</span></span><div className="choice-chips">{triggerOptions.map((option) => <Button className={song.startTrigger === option ? "selected" : ""} variant="secondary" key={option} onPress={() => updateSong(index, { startTrigger: option })}>{option}</Button>)}</div><TextField aria-label="始まりのきっかけを自由入力" label="自由入力" name={`song_${index}_start_trigger`} optional value={song.startTrigger} onChange={(value) => updateSong(index, { startTrigger: value })} inputProps={{ maxLength: 120 }} /></div>
                <CheckboxField name={`song_${index}_has_mc`} isSelected={song.mc.hasMc} onChange={(value) => updateSong(index, { mc: { ...song.mc, hasMc: value } })}>この曲の後にMCあり</CheckboxField>
                {song.mc.hasMc ? <TextField label="MC担当" name={`song_${index}_mc_person`} optional value={song.mc.person} onChange={(value) => updateSong(index, { mc: { ...song.mc, person: value } })} inputProps={{ maxLength: 80 }} /> : null}
                <TextAreaField label="PAへの要望" name={`song_${index}_pa_request`} value={song.paRequest} description="例：ギターソロで少し音量を上げてください。指定がなければ空欄で構いません。" onChange={(value) => updateSong(index, { paRequest: value })} maxLength={1000} />
              </div>
            </details>;
          })}</div>
          <TextAreaField label="バンド全体・全曲を通しての要望" name="general_request" value={model.generalRequest} description="音源の再生方法など、全体に関わる内容はこちらへ。指定がなければ空欄で構いません。" onChange={(value) => setModel((current) => ({ ...current, generalRequest: value }))} maxLength={2000} />
        </section>

        <section className="step-panel review-panel" hidden={step !== 3} aria-labelledby="step-4-title">
          <header className="step-header"><span>STEP 04</span><h1 id="step-4-title">確認・提出</h1><p>入力内容を確認して提出してください。</p></header>
          {Object.keys(allErrors).length ? <div className="error-summary" role="alert"><h2>未入力または確認が必要な項目があります</h2><ul>{Object.entries(allErrors).map(([name, message]) => <li key={name}><button type="button" onClick={() => focusField(name)}>{message}</button></li>)}</ul></div> : null}
          <ReviewGroup title="基本情報" onEdit={() => setStep(0)}><dl><ReviewItem label="ライブ" value={selectedLive?.name || "未選択"} /><ReviewItem label="バンド名" value={model.bandName || "未入力"} /><ReviewItem label="代表者" value={model.contactName || "未入力"} /><ReviewItem label="マイク本数" value={`${model.microphoneCount}本`} /><ReviewItem label="音源使用" value={model.usesBackingTrack ? "あり" : "なし"} /></dl></ReviewGroup>
          <ReviewGroup title="メンバー・持ち込み機材" onEdit={() => setStep(1)}><h3>メンバー</h3>{model.members.some((item) => item.name || item.instrument) ? <ul className="review-list">{model.members.filter((item) => item.name || item.instrument).map((item) => <li key={item.id}><strong>{item.name || "名前未入力"}</strong><span>{item.instrument || "担当未入力"}</span></li>)}</ul> : <p>未入力</p>}<h3>持ち込み機材</h3>{model.equipment.some((item) => item.name || item.instrument) ? <ul className="review-list">{model.equipment.filter((item) => item.name || item.instrument).map((item) => <li key={item.id}><strong>{item.name || "機材名未入力"}</strong><span>{item.instrument || "使用者未入力"}</span></li>)}</ul> : <p>なし</p>}</ReviewGroup>
          <ReviewGroup title="セットリスト・要望" onEdit={() => setStep(2)}><dl><ReviewItem label="曲数" value={`${model.songs.filter(hasSongValue).length}曲`} /><ReviewItem label="合計演奏時間" value={formatDuration(totalSeconds)} /><ReviewItem label="MC回数" value={`${model.songs.filter((song) => song.mc.hasMc).length}回`} /></dl><ol className="review-setlist">{model.songs.filter(hasSongValue).map((song, index) => <li key={song.id}><div><strong>{index + 1}. {song.title || "曲名未入力"}</strong><span>{song.duration || "時間未入力"}{song.mc.hasMc ? ` ・ MC ${song.mc.person || "担当未入力"}` : ""}</span></div>{song.paRequest ? <p><b>PA要望：</b>{song.paRequest}</p> : null}</li>)}</ol>{model.generalRequest ? <p className="review-request"><b>全体要望：</b>{model.generalRequest}</p> : null}</ReviewGroup>
          <div className="submit-area"><p>「提出する」を押すと管理者へ送信されます。提出後に表示される編集URLを必ず保存してください。</p>{mode === "admin" ? <><button ref={adminSubmitRef} hidden type="submit" /><ConfirmDialog title="提出内容を更新しますか？" confirmLabel="更新する" trigger={<Button>更新内容を保存</Button>} onConfirm={() => adminSubmitRef.current?.click()}>保存すると提出内容が上書きされます。</ConfirmDialog></> : <SubmitButton label={order ? "更新する" : "この内容で提出する"} />}<span className="submit-live" aria-live="polite"></span></div>
        </section>

        <nav className="step-footer" aria-label="ステップ移動">{step > 0 ? <Button variant="secondary" onPress={() => setStep((current) => current - 1)}>戻る</Button> : <span />}{step < 3 ? <Button onPress={() => step === 2 ? goToReview() : setStep((current) => current + 1)}>次へ</Button> : null}</nav>
      </div>

      <ControlledConfirmDialog isOpen={Boolean(pendingLive)} onOpenChange={(open) => { if (!open) setPendingLive(null); }} title="ライブを変更しますか？" confirmLabel="変更する" danger onConfirm={() => { if (!pendingLive) return; setModel((current) => ({ ...current, liveEventId: pendingLive.id, songs: current.songs.slice(0, pendingLive.limit) })); setPendingLive(null); }}><p>入力済みの曲が上限を超えるため、末尾の{pendingLive?.lost || 0}曲が失われます。</p></ControlledConfirmDialog>
    </Form>
  );
}

function ReviewGroup({ title, onEdit, children }: { title: string; onEdit: () => void; children: React.ReactNode }) {
  return <section className="review-group"><header><h2>{title}</h2><Button variant="text" onPress={onEdit}>編集</Button></header>{children}</section>;
}

function ReviewItem({ label, value }: { label: string; value: string }) {
  return <div><dt>{label}</dt><dd>{value}</dd></div>;
}
