"use client";

import { useActionState, useRef } from "react";
import { useFormStatus } from "react-dom";
import { addLiveEvent, removeLiveEvent, updateLiveEventAction, type LiveEventActionState } from "@/app/actions";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import type { LiveEvent } from "@/types/order";

export type LiveEventView = LiveEvent & { deadlineLocal: string };

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button className="button primary" disabled={pending} type="submit">
      {pending ? "保存中…" : label}
    </button>
  );
}

function Feedback({ state }: { state: LiveEventActionState }) {
  if (state.error) return <p className="error" role="alert">{state.error}</p>;
  if (state.message) return <p className="success" role="status">{state.message}</p>;
  return null;
}

function EventFields({ event }: { event?: LiveEventView }) {
  return (
    <>
      <label className="field">
        <span>ライブ名</span>
        <input className="input" maxLength={160} name="name" defaultValue={event?.name} placeholder="例：2026 冬ライブ" required />
      </label>
      <div className="grid two">
        <label className="field">
          <span>開催日</span>
          <input className="input" type="date" name="event_date" defaultValue={event?.eventDate || ""} />
          <small className="field-description">NodeCGでタイムテーブルを確定する前に設定してください。</small>
        </label>
        <label className="field">
          <span>タイムゾーン</span>
          <input className="input" name="time_zone" defaultValue={event?.timeZone || "Asia/Tokyo"} required />
        </label>
      </div>
      <div className="grid two">
        <label className="field">
          <span>提出締切（会場の時刻）</span>
          <input className="input" type="datetime-local" name="submission_deadline_local" defaultValue={event?.deadlineLocal || ""} />
          <small className="field-description">締切後は閲覧のみ。空欄なら締切なし。</small>
        </label>
        <label className="field">
          <span>最大曲数</span>
          <input className="input" defaultValue={event?.songCount ?? 8} max={30} min={1} name="song_count" required type="number" />
        </label>
      </div>
      <label className="checkbox-inline">
        <input type="checkbox" name="submissions_open" defaultChecked={event ? event.submissionsOpen : true} />
        受付中（外すと演者は更新できません）
      </label>
      <label className="checkbox-inline">
        <input type="checkbox" name="invite_required" defaultChecked={event ? event.inviteRequired : true} />
        招待URLからのみ提出を受け付ける
      </label>
    </>
  );
}

function CreateForm() {
  const [state, action] = useActionState<LiveEventActionState, FormData>(addLiveEvent, {});
  return (
    <form className="panel live-event-form" action={action}>
      <h2>ライブを追加</h2>
      <EventFields />
      <Submit label="ライブを追加" />
      <Feedback state={state} />
    </form>
  );
}

function EditForm({ event, canDelete }: { event: LiveEventView; canDelete: boolean }) {
  const [state, action] = useActionState<LiveEventActionState, FormData>(updateLiveEventAction, {});
  const [deleteState, deleteAction] = useActionState<LiveEventActionState, FormData>(removeLiveEvent, {});
  const deleteRef = useRef<HTMLButtonElement>(null);
  return (
    <details className="panel live-event-item">
      <summary>
        <strong>{event.name}</strong>
        <span>
          {event.eventDate || "開催日未設定"} ・ {event.submissionsOpen ? "受付中" : "受付停止"} ・ {event.inviteRequired ? "招待制" : "公開フォーム"} ・ 最大{event.songCount}曲
        </span>
      </summary>
      <form action={action} className="grid">
        <input type="hidden" name="id" value={event.id} />
        <input type="hidden" name="expected_revision" value={event.revision} />
        <EventFields event={event} />
        <div className="actions">
          <Submit label="保存" />
        </div>
        <Feedback state={state} />
      </form>
      <form action={deleteAction}>
        <input type="hidden" name="id" value={event.id} />
        <button ref={deleteRef} hidden type="submit" />
        <ConfirmDialog danger title="ライブを削除しますか？" confirmLabel="削除する" onConfirm={() => deleteRef.current?.click()} trigger={<Button variant="danger" isDisabled={!canDelete}>削除</Button>}>
          <p>「{event.name}」を削除します。出演エントリーや提出があるライブは削除できません。</p>
        </ConfirmDialog>
        <Feedback state={deleteState} />
      </form>
    </details>
  );
}

export function LiveEventSettings({ liveEvents }: { liveEvents: LiveEventView[] }) {
  return (
    <div className="admin-live-grid">
      <CreateForm />
      <div className="live-event-list">
        {liveEvents.map((event) => (
          <EditForm key={`${event.id}-${event.revision}`} event={event} canDelete={liveEvents.length > 1} />
        ))}
      </div>
    </div>
  );
}
