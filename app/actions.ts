"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminSession } from "@/lib/auth";
import { createLiveEventComment, createOrderComment, deleteLiveEventComment, deleteOrderComment } from "@/lib/comments";
import { createEntry, getEntry, invitePath, issueInvite, moveEntry, patchEntry, resolveInvite, revokeInvite } from "@/lib/entries";
import { createLiveEvent, deleteLiveEvent, getLiveEvent, patchLiveEvent, submissionWindow } from "@/lib/liveEvents";
import { deleteOrder, getOrder, getOrderByEditToken, getOrderByEntryId, reviewOrder, saveOrder, updateOrderStatus, type SaveOrderResult } from "@/lib/orders";
import { parseOrderForm } from "@/lib/orderSchema";
import { getRuntimeEnv } from "@/lib/d1/server";
import { isValidTimeZone } from "@/contracts/v1";
import { zonedLocalToIso } from "@/lib/time";
import type { OrderActionState } from "@/app/order-action-state";
import type { LiveEvent } from "@/types/order";

const SAVE_FAILED = "送信できませんでした。入力内容はそのままです。通信状況を確認して、もう一度「送信」を押してください。";
const CONFLICT = "別の端末または運営が先に内容を更新しました。入力中の内容はこの端末に残っています。ページを再読み込みして最新の内容を確認してから、もう一度更新してください。";

function adminReturnPath(value: FormDataEntryValue | null, fallback: string) {
  const path = String(value || "");
  return path.startsWith("/admin") && !path.startsWith("//") ? path : fallback;
}

function invalid(fieldErrors: Record<string, string>): OrderActionState {
  return { fieldErrors, formError: "入力内容を確認してください。" };
}

function resultToState(result: Exclude<SaveOrderResult, { ok: true }>): OrderActionState {
  switch (result.code) {
    case "revision_conflict":
      return { fieldErrors: {}, formError: CONFLICT, conflictRevision: result.currentRevision };
    case "entry_taken":
      return { fieldErrors: {}, formError: "このバンドの提出はすでに作成されています。ページを再読み込みして内容を確認してください。" };
    case "submission_mismatch":
      return { fieldErrors: {}, formError: "送信内容を確認できませんでした。ページを再読み込みしてから、もう一度送信してください。" };
    default:
      return { fieldErrors: {}, formError: "提出内容が見つかりません。運営に連絡してください。" };
  }
}

/* -------------------------------------------------------------------------- */
/* 演者                                                                         */
/* -------------------------------------------------------------------------- */

/** 旧来の公開フォームからの新規提出。招待必須のライブ・受付終了のライブは拒否する */
export async function submitOrder(_previousState: OrderActionState, formData: FormData): Promise<OrderActionState> {
  const liveEvent = await getLiveEvent(String(formData.get("live_event_id") || ""));
  if (!liveEvent) return invalid({ live_event_id: "選択したライブは存在しません。もう一度選択してください。" });
  if (liveEvent.inviteRequired) return { fieldErrors: {}, formError: "このライブは運営から配布された招待URLからのみ提出できます。運営に連絡してください。" };
  const window = submissionWindow(liveEvent);
  if (!window.open) return { fieldErrors: {}, formError: window.message };
  const { input, errors } = parseOrderForm(formData, { songLimit: liveEvent.songCount });
  if (Object.keys(errors).length) return invalid(errors);
  let result: SaveOrderResult;
  try {
    result = await saveOrder({ kind: "create", liveEvent, entryId: null, content: input.content, actor: "submitter", submissionId: input.submissionId });
  } catch {
    return { fieldErrors: {}, formError: SAVE_FAILED };
  }
  if (!result.ok) return resultToState(result);
  revalidatePath("/admin");
  redirect(`/thanks?token=${encodeURIComponent(result.editToken)}`);
}

/** 旧来の編集URLからの更新。ライブは変更できず、締切・受付停止も招待経由と同じく適用する */
export async function updateSubmittedOrder(_previousState: OrderActionState, formData: FormData): Promise<OrderActionState> {
  const editToken = String(formData.get("edit_token") || "");
  const existingOrder = editToken ? await getOrderByEditToken(editToken) : null;
  if (!existingOrder) return { fieldErrors: {}, formError: "編集URLを確認できませんでした。" };
  const liveEvent = await getLiveEvent(existingOrder.liveEventId);
  if (!liveEvent) return { fieldErrors: {}, formError: "ライブが見つかりません。運営に連絡してください。" };
  const window = submissionWindow(liveEvent);
  if (!window.open) return { fieldErrors: {}, formError: window.message };
  const entry = existingOrder.entryId ? await getEntry(existingOrder.entryId) : null;
  if (entry?.cancelledAt) return { fieldErrors: {}, formError: "この出演は取り消されています。運営に連絡してください。" };
  const { input, errors } = parseOrderForm(formData, { songLimit: liveEvent.songCount });
  if (Object.keys(errors).length) return invalid(errors);
  let result: SaveOrderResult;
  try {
    result = await saveOrder({ kind: "update", orderId: existingOrder.id, liveEvent, expectedRevision: input.expectedRevision ?? -1, content: input.content, actor: "submitter", submissionId: input.submissionId });
  } catch {
    return { fieldErrors: {}, formError: SAVE_FAILED };
  }
  if (!result.ok) return resultToState(result);
  revalidatePath("/admin");
  redirect(`/orders/${encodeURIComponent(editToken)}?updated=1`);
}

/** 招待URLからの提出・更新。ライブとバンドは招待から確定し、フォームの値は信用しない */
export async function submitInviteOrder(_previousState: OrderActionState, formData: FormData): Promise<OrderActionState> {
  const token = String(formData.get("invite_token") || "");
  const invite = await resolveInvite(token);
  if (invite.status === "not_found") return { fieldErrors: {}, formError: "招待URLを確認できませんでした。運営に連絡してください。" };
  if (invite.status === "revoked") return { fieldErrors: {}, formError: "この招待URLは無効になりました。新しいURLを運営に確認してください。" };
  if (invite.status === "expired") return { fieldErrors: {}, formError: "この招待URLは有効期限が切れています。運営に連絡してください。" };
  if (invite.status === "cancelled") return { fieldErrors: {}, formError: "この出演は取り消されています。運営に連絡してください。" };
  const window = submissionWindow(invite.event);
  if (!window.open) return { fieldErrors: {}, formError: window.message };
  const { input, errors } = parseOrderForm(formData, { songLimit: invite.event.songCount, bandName: invite.entry.bandName });
  if (Object.keys(errors).length) return invalid(errors);
  const existing = await getOrderByEntryId(invite.entry.id);
  let result: SaveOrderResult;
  try {
    result = existing
      ? await saveOrder({ kind: "update", orderId: existing.id, liveEvent: invite.event, expectedRevision: input.expectedRevision ?? -1, content: input.content, actor: "submitter", submissionId: input.submissionId })
      : await saveOrder({ kind: "create", liveEvent: invite.event, entryId: invite.entry.id, content: input.content, actor: "submitter", submissionId: input.submissionId });
  } catch {
    return { fieldErrors: {}, formError: SAVE_FAILED };
  }
  if (!result.ok) return resultToState(result);
  revalidatePath("/admin");
  redirect(`${invitePath(token)}?saved=${existing ? "updated" : "created"}`);
}

/* -------------------------------------------------------------------------- */
/* 運営：提出内容                                                                */
/* -------------------------------------------------------------------------- */

export async function updateAdminOrder(_previousState: OrderActionState, formData: FormData): Promise<OrderActionState> {
  await requireAdminSession();
  const id = String(formData.get("order_id") || "");
  const existingOrder = await getOrder(id);
  if (!id || !existingOrder) return { fieldErrors: {}, formError: "提出内容が見つかりません。" };
  const liveEvent = (await getLiveEvent(existingOrder.liveEventId)) ?? legacyEvent(existingOrder.liveEventName, existingOrder.liveEventSongCount);
  const { input, errors } = parseOrderForm(formData, { songLimit: liveEvent.songCount });
  if (Object.keys(errors).length) return invalid(errors);
  let result: SaveOrderResult;
  try {
    result = await saveOrder({ kind: "update", orderId: id, liveEvent, expectedRevision: input.expectedRevision ?? -1, content: input.content, actor: "admin", submissionId: input.submissionId });
  } catch {
    return { fieldErrors: {}, formError: "更新できませんでした。もう一度お試しください。" };
  }
  if (!result.ok) return resultToState(result);
  revalidatePath("/admin");
  redirect(existingOrder.entryId ? `/admin/entries/${encodeURIComponent(existingOrder.entryId)}?updated=1` : `/admin/orders/${encodeURIComponent(id)}?updated=1`);
}

function legacyEvent(name: string, songCount: number): LiveEvent {
  const now = new Date().toISOString();
  return { id: "", name, songCount: Math.max(1, songCount || 8), createdAt: now, eventDate: null, timeZone: "Asia/Tokyo", submissionDeadlineAt: null, submissionsOpen: true, inviteRequired: false, revision: 1, updatedAt: now };
}

/** 確認作業の状態（未確認・確認中）。確認済みは版を指定する reviewAction で行う */
export async function changeStatus(formData: FormData) {
  await requireAdminSession();
  const id = String(formData.get("id") || "");
  const status = String(formData.get("status") || "");
  if (id && (status === "new" || status === "reviewing")) {
    await updateOrderStatus(id, status);
    revalidatePath("/admin");
    revalidatePath(adminReturnPath(formData.get("return_path"), "/admin"));
  }
}

export type ReviewActionState = { message?: string; error?: string };

export async function reviewAction(_previousState: ReviewActionState, formData: FormData): Promise<ReviewActionState> {
  await requireAdminSession();
  const orderId = String(formData.get("order_id") || "");
  const expectedRevision = Number(formData.get("expected_revision"));
  if (!orderId || !Number.isInteger(expectedRevision)) return { error: "確認対象を特定できませんでした。" };
  const result = await reviewOrder(orderId, expectedRevision);
  revalidatePath("/admin");
  revalidatePath(adminReturnPath(formData.get("return_path"), "/admin"));
  if (result.ok) return { message: `版${result.reviewedRevision}を確認済みにしました。` };
  if (result.code === "not_found") return { error: "提出が見つかりません。" };
  return { error: `確認中に新しい提出（版${result.currentRevision}）が届きました。差分を確認してから、もう一度確認済みにしてください。` };
}

export type BulkReviewState = { results: { label: string; ok: boolean; message: string }[] };

/** 一括確認。表示時点の版を固定し、途中で更新された提出は除外して個別に結果を返す */
export async function bulkReviewAction(_previousState: BulkReviewState, formData: FormData): Promise<BulkReviewState> {
  await requireAdminSession();
  const targets = formData.getAll("target").map(String).slice(0, 200);
  const results: BulkReviewState["results"] = [];
  for (const target of targets) {
    const [orderId, revisionText, ...labelParts] = target.split("|");
    const label = labelParts.join("|") || orderId;
    const revision = Number(revisionText);
    if (!orderId || !Number.isInteger(revision)) {
      results.push({ label, ok: false, message: "対象を特定できませんでした。" });
      continue;
    }
    const result = await reviewOrder(orderId, revision);
    if (result.ok) results.push({ label, ok: true, message: `版${revision}を確認済みにしました。` });
    else if (result.code === "not_found") results.push({ label, ok: false, message: "提出が見つかりません。" });
    else results.push({ label, ok: false, message: `表示後に版${result.currentRevision}へ更新されたため除外しました。差分を確認してください。` });
  }
  revalidatePath("/admin");
  return { results };
}

export async function removeOrder(formData: FormData) {
  await requireAdminSession();
  const id = String(formData.get("id") || "");
  if (id) {
    await deleteOrder(id);
    revalidatePath("/admin");
    redirect(adminReturnPath(formData.get("return_path"), "/admin"));
  }
}

/* -------------------------------------------------------------------------- */
/* 運営：出演エントリー・招待                                                       */
/* -------------------------------------------------------------------------- */

export type EntryActionState = { error?: string; message?: string; inviteUrl?: string; inviteExpiresAt?: string };

function inviteBaseUrl() {
  return getRuntimeEnv("PA_PUBLIC_BASE_URL")?.replace(/\/+$/, "") || "";
}

export async function createEntryAction(_previousState: EntryActionState, formData: FormData): Promise<EntryActionState> {
  await requireAdminSession();
  const liveEventId = String(formData.get("live_event_id") || "");
  const bandName = String(formData.get("band_name") || "").trim();
  const orderText = String(formData.get("initial_performance_order") || "").trim();
  const initialOrder = orderText ? Number(orderText) : null;
  if (!bandName || bandName.length > 120) return { error: "バンド名を120文字以内で入力してください。" };
  if (initialOrder !== null && (!Number.isInteger(initialOrder) || initialOrder < 1)) return { error: "出演順は1以上の整数で入力してください。" };
  const entry = await createEntry(liveEventId, bandName, initialOrder);
  if (!entry) return { error: "ライブが見つかりません。" };
  revalidatePath("/admin");
  return { message: `「${entry.bandName}」を追加しました。続けて招待URLを発行してください。` };
}

export async function patchEntryAction(_previousState: EntryActionState, formData: FormData): Promise<EntryActionState> {
  await requireAdminSession();
  const entryId = String(formData.get("entry_id") || "");
  const expectedRevision = Number(formData.get("expected_revision"));
  const operation = String(formData.get("operation") || "save");
  const patch: Parameters<typeof patchEntry>[2] = {};
  if (operation === "cancel") patch.cancelled = true;
  else if (operation === "restore") patch.cancelled = false;
  else {
    const bandName = String(formData.get("band_name") || "").trim();
    if (!bandName || bandName.length > 120) return { error: "バンド名を120文字以内で入力してください。" };
    const orderText = String(formData.get("initial_performance_order") || "").trim();
    const initialOrder = orderText ? Number(orderText) : null;
    if (initialOrder !== null && (!Number.isInteger(initialOrder) || initialOrder < 1)) return { error: "出演順は1以上の整数で入力してください。" };
    patch.bandName = bandName;
    patch.initialPerformanceOrder = initialOrder;
  }
  const result = await patchEntry(entryId, expectedRevision, patch);
  revalidatePath("/admin");
  revalidatePath(`/admin/entries/${entryId}`);
  if (result === null) return { error: "出演エントリーが見つかりません。" };
  if (result === "conflict") return { error: "他の画面・NodeCGから先に変更されました。再読み込みしてください。" };
  return { message: operation === "cancel" ? "出演を取り消しました。" : operation === "restore" ? "出演の取消を解除しました。" : "保存しました。" };
}

export async function issueInviteAction(_previousState: EntryActionState, formData: FormData): Promise<EntryActionState> {
  await requireAdminSession();
  const entryId = String(formData.get("entry_id") || "");
  const days = Math.min(180, Math.max(1, Number(formData.get("days") || 30)));
  const reissue = formData.get("reissue") === "1";
  const result = await issueInvite(entryId, new Date(Date.now() + days * 86400_000).toISOString(), reissue);
  revalidatePath("/admin");
  revalidatePath(`/admin/entries/${entryId}`);
  if (!result.ok) return { error: result.message };
  // 招待URLはこの応答でだけ表示する。DBには平文トークンを保存しない
  return { message: reissue ? "招待URLを再発行しました。以前のURLは使えなくなりました。" : "招待URLを発行しました。", inviteUrl: `${inviteBaseUrl()}${invitePath(result.token)}`, inviteExpiresAt: result.expiresAt };
}

export async function revokeInviteAction(_previousState: EntryActionState, formData: FormData): Promise<EntryActionState> {
  await requireAdminSession();
  const entryId = String(formData.get("entry_id") || "");
  const inviteId = String(formData.get("invite_id") || "");
  const result = await revokeInvite(entryId, inviteId);
  revalidatePath("/admin");
  revalidatePath(`/admin/entries/${entryId}`);
  return result.ok ? { message: "招待URLを失効させました。" } : { error: "招待が見つかりません。" };
}

export async function moveLiveOrder(formData: FormData) {
  await requireAdminSession();
  const liveEventId = String(formData.get("live_event_id") || "");
  const entryId = String(formData.get("entry_id") || "");
  const direction = String(formData.get("direction") || "");
  if (liveEventId && entryId && (direction === "up" || direction === "down")) {
    await moveEntry(liveEventId, entryId, direction);
    revalidatePath("/admin");
    revalidatePath("/admin/live-orders");
  }
}

/* -------------------------------------------------------------------------- */
/* 運営：コメント                                                                 */
/* -------------------------------------------------------------------------- */

function validComment(authorName: string, body: string) {
  return authorName.trim().length > 0 && authorName.length <= 80 && body.trim().length > 0 && body.length <= 2000;
}

export async function addLiveEventComment(formData: FormData) {
  await requireAdminSession();
  const liveEventId = String(formData.get("live_event_id") || "");
  const authorName = String(formData.get("author_name") || "");
  const body = String(formData.get("body") || "");
  const path = liveEventId ? `/admin/live-orders?live_event_id=${encodeURIComponent(liveEventId)}` : "/admin/live-orders";
  if (validComment(authorName, body)) await createLiveEventComment(liveEventId, authorName, body);
  revalidatePath("/admin/live-orders");
  redirect(path);
}

export async function addOrderComment(formData: FormData) {
  await requireAdminSession();
  const orderId = String(formData.get("order_id") || "");
  const authorName = String(formData.get("author_name") || "");
  const body = String(formData.get("body") || "");
  const path = adminReturnPath(formData.get("return_path"), orderId ? `/admin/orders/${encodeURIComponent(orderId)}` : "/admin");
  if (validComment(authorName, body)) await createOrderComment(orderId, authorName, body);
  revalidatePath(path);
  revalidatePath("/admin/live-orders");
  redirect(path);
}

export async function removeLiveEventComment(formData: FormData) {
  await requireAdminSession();
  await deleteLiveEventComment(String(formData.get("comment_id") || ""));
  const path = adminReturnPath(formData.get("return_path"), "/admin/live-orders");
  revalidatePath("/admin/live-orders");
  redirect(path);
}

export async function removeOrderComment(formData: FormData) {
  await requireAdminSession();
  await deleteOrderComment(String(formData.get("comment_id") || ""));
  const path = adminReturnPath(formData.get("return_path"), "/admin");
  revalidatePath(path);
  revalidatePath("/admin/live-orders");
  redirect(path);
}

/* -------------------------------------------------------------------------- */
/* 運営：ライブ設定                                                               */
/* -------------------------------------------------------------------------- */

export type LiveEventActionState = { error?: string; message?: string };

function liveEventFields(formData: FormData) {
  const timeZone = String(formData.get("time_zone") || "Asia/Tokyo").trim();
  const deadlineLocal = String(formData.get("submission_deadline_local") || "").trim();
  const eventDate = String(formData.get("event_date") || "").trim();
  const errors: string[] = [];
  if (!isValidTimeZone(timeZone)) errors.push("タイムゾーンが不正です。");
  if (eventDate && !/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) errors.push("開催日が不正です。");
  const deadline = deadlineLocal ? zonedLocalToIso(deadlineLocal, isValidTimeZone(timeZone) ? timeZone : "Asia/Tokyo") : null;
  if (deadlineLocal && !deadline) errors.push("提出締切の日時が不正です。");
  const name = String(formData.get("name") || "").trim().slice(0, 160);
  if (!name) errors.push("ライブ名を入力してください。");
  return {
    errors,
    value: {
      name,
      songCount: Math.min(30, Math.max(1, Number(formData.get("song_count") || 8))),
      eventDate: eventDate || null,
      timeZone,
      submissionDeadlineAt: deadline,
      submissionsOpen: formData.get("submissions_open") === "on",
      inviteRequired: formData.get("invite_required") === "on",
    },
  };
}

export async function addLiveEvent(_previousState: LiveEventActionState, formData: FormData): Promise<LiveEventActionState> {
  await requireAdminSession();
  const { errors, value } = liveEventFields(formData);
  if (errors.length) return { error: errors.join(" ") };
  await createLiveEvent(value);
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/settings/live-events");
  return { message: `「${value.name}」を追加しました。` };
}

export async function updateLiveEventAction(_previousState: LiveEventActionState, formData: FormData): Promise<LiveEventActionState> {
  await requireAdminSession();
  const id = String(formData.get("id") || "");
  const expectedRevision = Number(formData.get("expected_revision"));
  const { errors, value } = liveEventFields(formData);
  if (errors.length) return { error: errors.join(" ") };
  const result = await patchLiveEvent(id, expectedRevision, value);
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/settings/live-events");
  if (result === null) return { error: "ライブが見つかりません。" };
  if (result === "conflict") return { error: "他の画面・NodeCGから先に変更されました。再読み込みしてください。" };
  return { message: "保存しました。" };
}

export async function removeLiveEvent(_previousState: LiveEventActionState, formData: FormData): Promise<LiveEventActionState> {
  await requireAdminSession();
  const id = String(formData.get("id") || "");
  if (!id) return { error: "ライブを特定できませんでした。" };
  const result = await deleteLiveEvent(id);
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/settings/live-events");
  return result.ok ? { message: "削除しました。" } : { error: result.message };
}
