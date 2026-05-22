"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createLiveEvent, deleteLiveEvent, getLiveEvent, updateLiveEventSongCount } from "@/lib/liveEvents";
import { createOrder, deleteOrder, updateOrderStatus } from "@/lib/orders";
import { orderFromFormData, validateOrder } from "@/lib/orderSchema";
import type { OrderStatus } from "@/types/order";

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
  redirect("/thanks");
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
