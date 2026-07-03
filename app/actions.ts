"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isAdminSession } from "@/lib/auth";
import { createLiveEventComment, createOrderComment, deleteLiveEventComment, deleteOrderComment } from "@/lib/comments";
import { createLiveEvent, deleteLiveEvent, getLiveEvent, updateLiveEventSongCount } from "@/lib/liveEvents";
import {
  createOrder,
  deleteOrder,
  getOrder,
  getOrderByEditToken,
  moveOrderInLiveEvent,
  updateOrderByEditToken,
  updateOrderById,
  updateOrderStatus,
} from "@/lib/orders";
import { orderFromFormData, validateOrder } from "@/lib/orderSchema";
import type { OrderStatus } from "@/types/order";

function adminReturnPath(value: FormDataEntryValue | null, fallback: string) {
  const path = String(value || "");
  return path.startsWith("/admin") ? path : fallback;
}

export async function submitOrder(formData: FormData) {
  const liveEventId = String(formData.get("live_event_id") || "");
  const liveEvent = await getLiveEvent(liveEventId);
  const order = orderFromFormData(formData, liveEvent?.songCount);
  if (liveEvent) {
    order.liveEventName = liveEvent.name;
    order.liveEventSongCount = liveEvent.songCount;
  }

  const errors = validateOrder(order);

  if (errors.length > 0) {
    redirect(`/?error=${encodeURIComponent(errors.join(" "))}`);
  }

  await createOrder(order);
  revalidatePath("/admin");
  redirect(`/thanks?token=${encodeURIComponent(order.editToken)}`);
}

export async function updateSubmittedOrder(formData: FormData) {
  const editToken = String(formData.get("edit_token") || "");
  const existingOrder = await getOrderByEditToken(editToken);

  if (!editToken || !existingOrder) {
    redirect("/");
  }

  const liveEventId = String(formData.get("live_event_id") || "");
  const liveEvent = await getLiveEvent(liveEventId);
  const order = orderFromFormData(formData, liveEvent?.songCount);
  if (liveEvent) {
    order.liveEventName = liveEvent.name;
    order.liveEventSongCount = liveEvent.songCount;
  }

  const errors = validateOrder(order);

  if (errors.length > 0) {
    redirect(`/orders/${encodeURIComponent(editToken)}?error=${encodeURIComponent(errors.join(" "))}`);
  }

  await updateOrderByEditToken(editToken, order);
  revalidatePath("/admin");
  revalidatePath(`/orders/${editToken}`);
  redirect(`/orders/${encodeURIComponent(editToken)}?updated=1`);
}

export async function updateAdminOrder(formData: FormData) {
  const id = String(formData.get("order_id") || "");
  const existingOrder = await getOrder(id);

  if (!id || !existingOrder) {
    redirect("/admin");
  }

  const liveEventId = String(formData.get("live_event_id") || "");
  const liveEvent = await getLiveEvent(liveEventId);
  const order = orderFromFormData(formData, liveEvent?.songCount);
  if (liveEvent) {
    order.liveEventName = liveEvent.name;
    order.liveEventSongCount = liveEvent.songCount;
  }

  const errors = validateOrder(order);

  if (errors.length > 0) {
    redirect(`/admin/orders/${encodeURIComponent(id)}/edit?error=${encodeURIComponent(errors.join(" "))}`);
  }

  await updateOrderById(id, order);
  revalidatePath("/admin");
  revalidatePath(`/admin/orders/${id}`);
  revalidatePath(`/admin/orders/${id}/edit`);
  redirect(`/admin/orders/${encodeURIComponent(id)}?updated=1`);
}

export async function changeStatus(formData: FormData) {
  const id = String(formData.get("id") || "");
  const status = String(formData.get("status") || "new") as OrderStatus;

  if (id && ["new", "reviewing", "done"].includes(status)) {
    await updateOrderStatus(id, status);
    revalidatePath("/admin");
    revalidatePath(`/admin/orders/${id}`);
  }
}

export async function moveLiveOrder(formData: FormData) {
  const liveEventId = String(formData.get("live_event_id") || "");
  const orderId = String(formData.get("order_id") || "");
  const direction = String(formData.get("direction") || "");

  if (liveEventId && orderId && (direction === "up" || direction === "down")) {
    await moveOrderInLiveEvent(liveEventId, orderId, direction);
    revalidatePath("/admin");
    revalidatePath("/admin/live-orders");
  }
}

export async function addLiveEventComment(formData: FormData) {
  if (!(await isAdminSession())) {
    redirect("/admin/login");
  }

  const liveEventId = String(formData.get("live_event_id") || "");
  const authorName = String(formData.get("author_name") || "");
  const body = String(formData.get("body") || "");
  const path = liveEventId ? `/admin/live-orders?live_event_id=${encodeURIComponent(liveEventId)}` : "/admin/live-orders";

  await createLiveEventComment(liveEventId, authorName, body);
  revalidatePath("/admin/live-orders");
  redirect(path);
}

export async function addOrderComment(formData: FormData) {
  if (!(await isAdminSession())) {
    redirect("/admin/login");
  }

  const orderId = String(formData.get("order_id") || "");
  const authorName = String(formData.get("author_name") || "");
  const body = String(formData.get("body") || "");
  const path = orderId ? `/admin/orders/${encodeURIComponent(orderId)}` : "/admin";

  await createOrderComment(orderId, authorName, body);
  revalidatePath(path);
  revalidatePath("/admin/live-orders");
  redirect(path);
}

export async function removeLiveEventComment(formData: FormData) {
  if (!(await isAdminSession())) {
    redirect("/admin/login");
  }

  const id = String(formData.get("comment_id") || "");
  const path = adminReturnPath(formData.get("return_path"), "/admin/live-orders");

  await deleteLiveEventComment(id);
  revalidatePath("/admin/live-orders");
  redirect(path);
}

export async function removeOrderComment(formData: FormData) {
  if (!(await isAdminSession())) {
    redirect("/admin/login");
  }

  const id = String(formData.get("comment_id") || "");
  const path = adminReturnPath(formData.get("return_path"), "/admin");

  await deleteOrderComment(id);
  revalidatePath(path);
  revalidatePath("/admin/live-orders");
  redirect(path);
}

export async function removeOrder(formData: FormData) {
  const id = String(formData.get("id") || "");
  if (id) {
    await deleteOrder(id);
    revalidatePath("/admin");
    redirect("/admin");
  }
}

export async function addLiveEvent(formData: FormData) {
  const name = String(formData.get("name") || "");
  const songCount = Number(formData.get("song_count") || 0);
  await createLiveEvent(name, songCount);
  revalidatePath("/");
  revalidatePath("/admin");
}

export async function changeLiveEventSongCount(formData: FormData) {
  const id = String(formData.get("id") || "");
  const songCount = Number(formData.get("song_count") || 0);
  if (id) {
    await updateLiveEventSongCount(id, songCount);
    revalidatePath("/");
    revalidatePath("/admin");
  }
}

export async function removeLiveEvent(formData: FormData) {
  const id = String(formData.get("id") || "");
  if (id) {
    await deleteLiveEvent(id);
    revalidatePath("/");
    revalidatePath("/admin");
  }
}
