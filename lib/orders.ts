import { createSupabaseAdminClient } from "@/lib/supabase/server";
import type { Equipment, Member, OrderStatus, OrderSummary, PAOrder, Song } from "@/types/order";

type OrderRow = {
  id: string;
  edit_token: string;
  live_event_id: string;
  live_event_name: string | null;
  live_event_song_count: number | null;
  band_name: string;
  contact_name: string;
  microphone_count: number | null;
  uses_backing_track: boolean | null;
  general_request: string | null;
  status: OrderStatus;
  created_at: string;
  updated_at: string;
};

type MemberRow = {
  id: string;
  order_id: string;
  name: string | null;
  instrument: string | null;
  position: number | null;
};

type SongRow = {
  id: string;
  order_id: string;
  song_order: number;
  title: string | null;
  duration: string | null;
  mood: string | null;
  start_trigger: string | null;
  pa_request: string | null;
  has_mc: boolean | null;
  mc_person: string | null;
};

type EquipmentRow = {
  id: string;
  order_id: string;
  name: string | null;
  instrument: string | null;
  position: number | null;
};

function memberFromRow(row: MemberRow): Member {
  return {
    id: row.id,
    name: row.name || "",
    instrument: row.instrument || "",
  };
}

function songFromRow(row: SongRow): Song {
  return {
    id: row.id,
    order: row.song_order,
    title: row.title || "",
    duration: row.duration || "",
    mood: row.mood || "",
    startTrigger: row.start_trigger || "",
    paRequest: row.pa_request || "",
    mc: {
      hasMc: row.has_mc || false,
      person: row.mc_person || "",
    },
  };
}

function equipmentFromRow(row: EquipmentRow): Equipment {
  return {
    id: row.id,
    name: row.name || "",
    instrument: row.instrument || "",
  };
}

function orderFromRows(
  order: OrderRow,
  members: MemberRow[] = [],
  songs: SongRow[] = [],
  equipment: EquipmentRow[] = [],
): PAOrder {
  return {
    id: order.id,
    editToken: order.edit_token,
    liveEventId: order.live_event_id,
    liveEventName: order.live_event_name || "",
    liveEventSongCount: order.live_event_song_count || songs.length,
    bandName: order.band_name,
    contactName: order.contact_name,
    microphoneCount: order.microphone_count || 0,
    usesBackingTrack: order.uses_backing_track || false,
    members: members.sort((a, b) => (a.position || 0) - (b.position || 0)).map(memberFromRow),
    songs: songs.sort((a, b) => a.song_order - b.song_order).map(songFromRow),
    equipment: equipment.sort((a, b) => (a.position || 0) - (b.position || 0)).map(equipmentFromRow),
    generalRequest: order.general_request || "",
    status: order.status,
    createdAt: order.created_at,
    updatedAt: order.updated_at,
  };
}

function summaryFromOrder(order: PAOrder): OrderSummary {
  return {
    id: order.id,
    editToken: order.editToken,
    liveEventId: order.liveEventId,
    liveEventName: order.liveEventName,
    liveEventSongCount: order.liveEventSongCount,
    bandName: order.bandName,
    contactName: order.contactName,
    songCount: order.songs.length,
    usesBackingTrack: order.usesBackingTrack,
    status: order.status,
    createdAt: order.createdAt,
  };
}

function orderInsert(order: PAOrder) {
  return {
    edit_token: order.editToken,
    live_event_id: order.liveEventId,
    live_event_name: order.liveEventName,
    live_event_song_count: order.liveEventSongCount,
    band_name: order.bandName,
    contact_name: order.contactName,
    microphone_count: order.microphoneCount,
    uses_backing_track: order.usesBackingTrack,
    general_request: order.generalRequest,
    status: order.status,
  };
}

function orderUpdate(order: PAOrder) {
  return {
    live_event_id: order.liveEventId,
    live_event_name: order.liveEventName,
    live_event_song_count: order.liveEventSongCount,
    band_name: order.bandName,
    contact_name: order.contactName,
    microphone_count: order.microphoneCount,
    uses_backing_track: order.usesBackingTrack,
    general_request: order.generalRequest,
    updated_at: new Date().toISOString(),
  };
}

async function replaceRelatedRows(orderId: string, order: PAOrder) {
  const supabase = createSupabaseAdminClient();

  const deleteResults = await Promise.all([
    supabase.from("members").delete().eq("order_id", orderId),
    supabase.from("songs").delete().eq("order_id", orderId),
    supabase.from("equipment").delete().eq("order_id", orderId),
  ]);

  const deleteError = deleteResults.find((result) => result.error)?.error;
  if (deleteError) {
    throw new Error(`Failed to replace order details: ${deleteError.message}`);
  }

  const inserts = [];

  if (order.members.length > 0) {
    inserts.push(
      supabase.from("members").insert(
        order.members.map((member, index) => ({
          order_id: orderId,
          name: member.name,
          instrument: member.instrument,
          position: index,
        })),
      ),
    );
  }

  if (order.songs.length > 0) {
    inserts.push(
      supabase.from("songs").insert(
        order.songs.map((song) => ({
          order_id: orderId,
          song_order: song.order,
          title: song.title,
          duration: song.duration,
          mood: song.mood,
          start_trigger: song.startTrigger,
          pa_request: song.paRequest,
          has_mc: song.mc.hasMc,
          mc_person: song.mc.person,
        })),
      ),
    );
  }

  if (order.equipment.length > 0) {
    inserts.push(
      supabase.from("equipment").insert(
        order.equipment.map((item, index) => ({
          order_id: orderId,
          name: item.name,
          instrument: item.instrument,
          position: index,
        })),
      ),
    );
  }

  const insertResults = await Promise.all(inserts);
  const insertError = insertResults.find((result) => result.error)?.error;
  if (insertError) {
    throw new Error(`Failed to save order details: ${insertError.message}`);
  }
}

async function getRelatedRows(orderIds: string[]) {
  const supabase = createSupabaseAdminClient();

  if (orderIds.length === 0) {
    return { members: [], songs: [], equipment: [] };
  }

  const [membersResult, songsResult, equipmentResult] = await Promise.all([
    supabase.from("members").select("*").in("order_id", orderIds),
    supabase.from("songs").select("*").in("order_id", orderIds),
    supabase.from("equipment").select("*").in("order_id", orderIds),
  ]);

  const error = membersResult.error || songsResult.error || equipmentResult.error;
  if (error) {
    throw new Error(`Failed to fetch order details: ${error.message}`);
  }

  return {
    members: (membersResult.data || []) as MemberRow[],
    songs: (songsResult.data || []) as SongRow[],
    equipment: (equipmentResult.data || []) as EquipmentRow[],
  };
}

async function getHydratedOrder(filter: { id?: string; editToken?: string }) {
  const supabase = createSupabaseAdminClient();
  let query = supabase.from("orders").select("*");

  if (filter.id) {
    query = query.eq("id", filter.id);
  }

  if (filter.editToken) {
    query = query.eq("edit_token", filter.editToken);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch order: ${error.message}`);
  }

  if (!data) return null;

  const order = data as OrderRow;
  const related = await getRelatedRows([order.id]);

  return orderFromRows(
    order,
    related.members.filter((row) => row.order_id === order.id),
    related.songs.filter((row) => row.order_id === order.id),
    related.equipment.filter((row) => row.order_id === order.id),
  );
}

export async function createOrder(order: PAOrder) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.from("orders").insert(orderInsert(order)).select("*").single();

  if (error) {
    throw new Error(`Failed to create order: ${error.message}`);
  }

  const createdOrder = data as OrderRow;
  await replaceRelatedRows(createdOrder.id, order);

  return getOrder(createdOrder.id);
}

export async function listOrderSummaries(): Promise<OrderSummary[]> {
  const orders = await listOrders();
  return orders.map(summaryFromOrder);
}

export async function getOrder(id: string) {
  return getHydratedOrder({ id });
}

export async function getOrderByEditToken(editToken: string) {
  return getHydratedOrder({ editToken });
}

export async function updateOrderByEditToken(editToken: string, nextOrder: PAOrder) {
  const existingOrder = await getOrderByEditToken(editToken);
  if (!existingOrder) return null;

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("orders")
    .update(orderUpdate(nextOrder))
    .eq("edit_token", editToken)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to update order: ${error.message}`);
  }

  const updatedOrder = data as OrderRow;
  await replaceRelatedRows(updatedOrder.id, nextOrder);

  return getOrder(updatedOrder.id);
}

export async function updateOrderById(id: string, nextOrder: PAOrder) {
  const existingOrder = await getOrder(id);
  if (!existingOrder) return null;

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("orders")
    .update(orderUpdate(nextOrder))
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to update order: ${error.message}`);
  }

  const updatedOrder = data as OrderRow;
  await replaceRelatedRows(updatedOrder.id, nextOrder);

  return getOrder(updatedOrder.id);
}

export async function updateOrderStatus(id: string, status: OrderStatus) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("orders").update({ status, updated_at: new Date().toISOString() }).eq("id", id);

  if (error) {
    throw new Error(`Failed to update order status: ${error.message}`);
  }
}

export async function deleteOrder(id: string) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("orders").delete().eq("id", id);

  if (error) {
    throw new Error(`Failed to delete order: ${error.message}`);
  }
}

export async function listOrders() {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.from("orders").select("*").order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch orders: ${error.message}`);
  }

  const orders = (data || []) as OrderRow[];
  const related = await getRelatedRows(orders.map((order) => order.id));

  return orders.map((order) =>
    orderFromRows(
      order,
      related.members.filter((row) => row.order_id === order.id),
      related.songs.filter((row) => row.order_id === order.id),
      related.equipment.filter((row) => row.order_id === order.id),
    ),
  );
}
