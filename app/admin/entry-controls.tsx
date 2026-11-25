"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  changeStatus,
  createEntryAction,
  issueInviteAction,
  patchEntryAction,
  reviewAction,
  revokeInviteAction,
  type EntryActionState,
  type ReviewActionState,
} from "@/app/actions";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

function Pending({ label, pendingLabel = "処理中…", variant = "primary" }: { label: string; pendingLabel?: string; variant?: string }) {
  const { pending } = useFormStatus();
  return (
    <button className={`button ${variant}`} disabled={pending} type="submit">
      {pending ? pendingLabel : label}
    </button>
  );
}

function Feedback({ state }: { state: { message?: string; error?: string } }) {
  if (state.error) return <p className="error" role="alert">{state.error}</p>;
  if (state.message) return <p className="success" role="status">{state.message}</p>;
  return null;
}

/** 版を指定して確認済みにする。表示中の版と現在の版が違えばサーバーが拒否する */
export function ReviewForm({ orderId, revision, returnPath, alreadyReviewed }: { orderId: string; revision: number; returnPath: string; alreadyReviewed: boolean }) {
  const [state, action] = useActionState<ReviewActionState, FormData>(reviewAction, {});
  return (
    <form action={action} className="review-form">
      <input type="hidden" name="order_id" value={orderId} />
      <input type="hidden" name="expected_revision" value={revision} />
      <input type="hidden" name="return_path" value={returnPath} />
      {alreadyReviewed ? <p className="success">版{revision}は確認済みです。</p> : <Pending label={`版${revision}を確認済みにする`} pendingLabel="確認中…" />}
      <Feedback state={state} />
    </form>
  );
}

export function StatusButtons({ orderId, status, returnPath }: { orderId: string; status: "new" | "reviewing" | "done"; returnPath: string }) {
  return (
    <form action={changeStatus} className="inline-form">
      <input type="hidden" name="id" value={orderId} />
      <input type="hidden" name="return_path" value={returnPath} />
      <input type="hidden" name="status" value={status === "reviewing" ? "new" : "reviewing"} />
      <Pending variant="secondary" label={status === "reviewing" ? "「未確認」に戻す" : "「確認中」にする"} />
    </form>
  );
}

function CopyableUrl({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const [fullUrl, setFullUrl] = useState(url);
  useEffect(() => setFullUrl(url.startsWith("/") ? `${window.location.origin}${url}` : url), [url]);
  return (
    <div className="share-link" role="status">
      <span>招待URL（この画面を閉じると再表示できません）</span>
      <input className="input" readOnly value={fullUrl} onFocus={(event) => event.currentTarget.select()} aria-label="招待URL" />
      <Button
        variant="secondary"
        onPress={async () => {
          try {
            await navigator.clipboard.writeText(fullUrl);
            setCopied(true);
          } catch {
            setCopied(false);
          }
        }}
      >
        URLをコピー
      </Button>
      <span aria-live="polite">{copied ? "コピーしました" : ""}</span>
    </div>
  );
}

export function InvitePanel({ entryId, invite, cancelled }: { entryId: string; invite: { id: string; expiresAt: string; revokedAt: string | null; label: string; active: boolean } | null; cancelled: boolean }) {
  const [issueState, issue] = useActionState<EntryActionState, FormData>(issueInviteAction, {});
  const [revokeState, revoke] = useActionState<EntryActionState, FormData>(revokeInviteAction, {});
  const revokeRef = useRef<HTMLButtonElement>(null);
  return (
    <div className="invite-panel">
      <p>
        状態：<strong>{invite?.label || "招待未発行"}</strong>
        {invite ? `（有効期限 ${new Date(invite.expiresAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}）` : ""}
      </p>
      <p className="field-description">招待URLは発行した直後にだけ表示されます。紛失した場合は再発行してください（以前のURLは使えなくなります）。URLを知っている人は誰でも回答できるため、バンドの代表者だけに渡してください。</p>
      {cancelled ? (
        <p className="notice-inline">取消済みのエントリーには招待を発行できません。</p>
      ) : (
        <form action={issue} className="inline-form">
          <input type="hidden" name="entry_id" value={entryId} />
          <input type="hidden" name="reissue" value={invite?.active ? "1" : "0"} />
          <label className="field compact-field">
            <span>有効日数</span>
            <input className="input compact-input" type="number" name="days" min={1} max={180} defaultValue={30} />
          </label>
          <Pending label={invite?.active ? "再発行する" : "招待URLを発行"} />
        </form>
      )}
      {issueState.inviteUrl ? <CopyableUrl url={issueState.inviteUrl} /> : null}
      <Feedback state={issueState} />
      {invite?.active ? (
        <form action={revoke}>
          <input type="hidden" name="entry_id" value={entryId} />
          <input type="hidden" name="invite_id" value={invite.id} />
          <button ref={revokeRef} hidden type="submit" />
          <ConfirmDialog danger title="招待URLを失効させますか？" confirmLabel="失効させる" onConfirm={() => revokeRef.current?.click()} trigger={<Button variant="danger">招待URLを失効</Button>}>
            <p>このURLからは閲覧・提出できなくなります。提出済みの内容は残ります。</p>
          </ConfirmDialog>
        </form>
      ) : null}
      <Feedback state={revokeState} />
    </div>
  );
}

export function EntrySettingsForm({ entryId, revision, bandName, initialOrder, cancelled }: { entryId: string; revision: number; bandName: string; initialOrder: number | null; cancelled: boolean }) {
  const [state, action] = useActionState<EntryActionState, FormData>(patchEntryAction, {});
  const cancelRef = useRef<HTMLButtonElement>(null);
  return (
    <div className="entry-settings">
      <form action={action} className="grid">
        <input type="hidden" name="entry_id" value={entryId} />
        <input type="hidden" name="expected_revision" value={revision} />
        <input type="hidden" name="operation" value="save" />
        <div className="grid two">
          <label className="field">
            <span>バンド名</span>
            <input className="input" name="band_name" defaultValue={bandName} maxLength={120} required />
          </label>
          <label className="field">
            <span>初期出演順</span>
            <input className="input" name="initial_performance_order" type="number" min={1} defaultValue={initialOrder ?? ""} />
          </label>
        </div>
        <p className="field-description">NodeCGで当日用タイムテーブルを作成した後は、ここで出演順を変えてもNodeCG側の並びは自動では変わりません。</p>
        <div className="actions">
          <Pending label="保存" variant="secondary" />
        </div>
      </form>
      <form action={action}>
        <input type="hidden" name="entry_id" value={entryId} />
        <input type="hidden" name="expected_revision" value={revision} />
        <input type="hidden" name="operation" value={cancelled ? "restore" : "cancel"} />
        <button ref={cancelRef} hidden type="submit" />
        {cancelled ? (
          <Pending label="出演の取消を解除" variant="secondary" />
        ) : (
          <ConfirmDialog danger title="出演を取り消しますか？" confirmLabel="取り消す" onConfirm={() => cancelRef.current?.click()} trigger={<Button variant="danger">出演を取り消す</Button>}>
            <p>招待URLから提出・更新できなくなります。提出済みの内容と履歴は残ります。</p>
          </ConfirmDialog>
        )}
      </form>
      <Feedback state={state} />
    </div>
  );
}

export function CreateEntryForm({ liveEventId }: { liveEventId: string }) {
  const [state, action] = useActionState<EntryActionState, FormData>(createEntryAction, {});
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.message) formRef.current?.reset();
  }, [state]);
  return (
    <form ref={formRef} action={action} className="create-entry-form">
      <input type="hidden" name="live_event_id" value={liveEventId} />
      <label className="field">
        <span>バンド名</span>
        <input className="input" name="band_name" maxLength={120} required placeholder="例：放課後セッション" />
      </label>
      <label className="field compact-field">
        <span>初期出演順（任意）</span>
        <input className="input compact-input" name="initial_performance_order" type="number" min={1} />
      </label>
      <Pending label="出演エントリーを追加" />
      <Feedback state={state} />
    </form>
  );
}
