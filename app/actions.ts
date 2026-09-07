"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminSession } from "@/lib/auth";
import { createLiveEventComment, createOrderComment, deleteLiveEventComment, deleteOrderComment } from "@/lib/comments";
import { createLiveEvent, deleteLiveEvent, getLiveEvent, updateLiveEventSongCount } from "@/lib/liveEvents";
import { createOrder, deleteOrder, getOrder, getOrderByEditToken, moveOrderInLiveEvent, updateOrderByEditToken, updateOrderById, updateOrderStatus } from "@/lib/orders";
import { MAX_EQUIPMENT_COUNT, MAX_MEMBER_COUNT, MAX_SONG_COUNT, orderFromFormData, validateOrderFields } from "@/lib/orderSchema";
import type { OrderActionState } from "@/app/order-action-state";
import type { OrderStatus } from "@/types/order";

function adminReturnPath(value: FormDataEntryValue | null, fallback: string) {
  const path = String(value || "");
  return path.startsWith("/admin") && !path.startsWith("//") ? path : fallback;
}

async function parsedOrder(formData: FormData) {
  const liveEventId = String(formData.get("live_event_id") || "");
  const liveEvent = await getLiveEvent(liveEventId);
  const order = orderFromFormData(formData, liveEvent?.songCount || 1);
  if (liveEvent) {
    order.liveEventName = liveEvent.name;
    order.liveEventSongCount = liveEvent.songCount;
  }
  const fieldErrors = validateOrderFields(order);
  if (!liveEvent) fieldErrors.live_event_id = "選択したライブは存在しません。もう一度選択してください。";
  if (Number(formData.get("member_count")) > MAX_MEMBER_COUNT) fieldErrors.member_count = `メンバーは${MAX_MEMBER_COUNT}人までです。`;
  if (Number(formData.get("equipment_count")) > MAX_EQUIPMENT_COUNT) fieldErrors.equipment_count = `持ち込み機材は${MAX_EQUIPMENT_COUNT}件までです。`;
  if (Number(formData.get("song_count")) > MAX_SONG_COUNT || (liveEvent && Number(formData.get("song_count")) > liveEvent.songCount)) fieldErrors.song_count = `曲数はこのライブの上限（${liveEvent?.songCount || 1}曲）以内にしてください。`;
  return { order, fieldErrors };
}

export async function submitOrder(_previousState: OrderActionState, formData: FormData): Promise<OrderActionState> {
  const { order, fieldErrors } = await parsedOrder(formData);
  if (Object.keys(fieldErrors).length) return { fieldErrors, formError: "入力内容を確認してください。" };
  try {
    await createOrder(order);
  } catch {
    return { fieldErrors: {}, formError: "送信できませんでした。入力内容を残したまま、もう一度お試しください。" };
  }
  revalidatePath("/admin");
  redirect(`/thanks?token=${encodeURIComponent(order.editToken)}`);
}

export async function updateSubmittedOrder(_previousState: OrderActionState, formData: FormData): Promise<OrderActionState> {
  const editToken = String(formData.get("edit_token") || "");
  const existingOrder = await getOrderByEditToken(editToken);
  if (!editToken || !existingOrder) return { fieldErrors: {}, formError: "編集URLを確認できませんでした。" };
  const { order, fieldErrors } = await parsedOrder(formData);
  if (Object.keys(fieldErrors).length) return { fieldErrors, formError: "入力内容を確認してください。" };
  try {
    await updateOrderByEditToken(editToken, order);
  } catch {
    return { fieldErrors: {}, formError: "更新できませんでした。入力内容を残したまま、もう一度お試しください。" };
  }
  revalidatePath("/admin");
  revalidatePath(`/orders/${editToken}`);
  redirect(`/orders/${encodeURIComponent(editToken)}?updated=1`);
}

export async function updateAdminOrder(_previousState: OrderActionState, formData: FormData): Promise<OrderActionState> {
  await requireAdminSession();
  const id = String(formData.get("order_id") || "");
  const existingOrder = await getOrder(id);
  if (!id || !existingOrder) return { fieldErrors: {}, formError: "提出内容が見つかりません。" };
  const { order, fieldErrors } = await parsedOrder(formData);
  if (Object.keys(fieldErrors).length) return { fieldErrors, formError: "入力内容を確認してください。" };
  try {
    await updateOrderById(id, order);
  } catch {
    return { fieldErrors: {}, formError: "更新できませんでした。もう一度お試しください。" };
  }
  revalidatePath("/admin");
  revalidatePath(`/admin/orders/${id}`);
  redirect(`/admin/orders/${encodeURIComponent(id)}?updated=1`);
}

export async function changeStatus(formData: FormData) {
  await requireAdminSession();
  const id = String(formData.get("id") || "");
  const status = String(formData.get("status") || "new") as OrderStatus;
  if (id && ["new", "reviewing", "done"].includes(status)) {
    await updateOrderStatus(id, status);
    revalidatePath("/admin"); revalidatePath(`/admin/orders/${id}`);
  }
}

export async function moveLiveOrder(formData: FormData) {
  await requireAdminSession();
  const liveEventId = String(formData.get("live_event_id") || "");
  const orderId = String(formData.get("order_id") || "");
  const direction = String(formData.get("direction") || "");
  if (liveEventId && orderId && (direction === "up" || direction === "down")) {
    await moveOrderInLiveEvent(liveEventId, orderId, direction);
    revalidatePath("/admin"); revalidatePath("/admin/live-orders");
  }
}

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
  revalidatePath("/admin/live-orders"); redirect(path);
}

export async function addOrderComment(formData: FormData) {
  await requireAdminSession();
  const orderId = String(formData.get("order_id") || "");
  const authorName = String(formData.get("author_name") || "");
  const body = String(formData.get("body") || "");
  const path = orderId ? `/admin/orders/${encodeURIComponent(orderId)}` : "/admin";
  if (validComment(authorName, body)) await createOrderComment(orderId, authorName, body);
  revalidatePath(path); revalidatePath("/admin/live-orders"); redirect(path);
}

export async function removeLiveEventComment(formData: FormData) {
  await requireAdminSession();
  await deleteLiveEventComment(String(formData.get("comment_id") || ""));
  const path = adminReturnPath(formData.get("return_path"), "/admin/live-orders");
  revalidatePath("/admin/live-orders"); redirect(path);
}

export async function removeOrderComment(formData: FormData) {
  await requireAdminSession();
  await deleteOrderComment(String(formData.get("comment_id") || ""));
  const path = adminReturnPath(formData.get("return_path"), "/admin");
  revalidatePath(path); revalidatePath("/admin/live-orders"); redirect(path);
}

export async function removeOrder(formData: FormData) {
  await requireAdminSession();
  const id = String(formData.get("id") || "");
  if (id) { await deleteOrder(id); revalidatePath("/admin"); redirect("/admin"); }
}

export async function addLiveEvent(formData: FormData) {
  await requireAdminSession();
  const name = String(formData.get("name") || "").slice(0, 160);
  const songCount = Math.min(30, Math.max(1, Number(formData.get("song_count") || 0)));
  await createLiveEvent(name, songCount); revalidatePath("/"); revalidatePath("/admin");
}

export async function changeLiveEventSongCount(formData: FormData) {
  await requireAdminSession();
  const id = String(formData.get("id") || "");
  const songCount = Math.min(30, Math.max(1, Number(formData.get("song_count") || 0)));
  if (id) { await updateLiveEventSongCount(id, songCount); revalidatePath("/"); revalidatePath("/admin"); }
}

export async function removeLiveEvent(formData: FormData) {
  await requireAdminSession();
  const id = String(formData.get("id") || "");
  if (id) { await deleteLiveEvent(id); revalidatePath("/"); revalidatePath("/admin"); }
}
