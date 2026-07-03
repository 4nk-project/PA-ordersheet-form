import { assertD1Result, getD1Database, type D1DatabaseBinding } from "@/lib/d1/server";
import type { Equipment, Member, OrderStatus, OrderSummary, PAOrder, Song } from "@/types/order";

type OrderRow = {
  band_name: string;
  contact_name: string;
  created_at: string;
  edit_token: string;
  general_request: string | null;
  id: string;
  live_event_id: string;
  live_event_name: string | null;
  live_event_song_count: number | null;
  microphone_count: number | null;
  performance_order: number | null;
  status: OrderStatus;
  updated_at: string;
  uses_backing_track: number | null;
};

type OrderSummaryRow = OrderRow & {
  song_count: number;
};

type MemberRow = {
  id: string;
  instrument: string | null;
  name: string | null;
  order_id: string;
  position: number | null;
};

type SongRow = {
  duration: string | null;
  has_mc: number | null;
  id: string;
  mc_person: string | null;
  mood: string | null;
  order_id: string;
  pa_request: string | null;
  song_order: number;
  start_trigger: string | null;
  title: string | null;
};

type EquipmentRow = {
  id: string;
  instrument: string | null;
  name: string | null;
  order_id: string;
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
      hasMc: Boolean(row.has_mc),
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
    performanceOrder: order.performance_order,
    bandName: order.band_name,
    contactName: order.contact_name,
    microphoneCount: order.microphone_count || 0,
    usesBackingTrack: Boolean(order.uses_backing_track),
    members: members.sort((a, b) => (a.position || 0) - (b.position || 0)).map(memberFromRow),
    songs: songs.sort((a, b) => a.song_order - b.song_order).map(songFromRow),
    equipment: equipment.sort((a, b) => (a.position || 0) - (b.position || 0)).map(equipmentFromRow),
    generalRequest: order.general_request || "",
    status: order.status,
    createdAt: order.created_at,
    updatedAt: order.updated_at,
  };
}

function summaryFromRow(order: OrderSummaryRow): OrderSummary {
  return {
    id: order.id,
    editToken: order.edit_token,
    liveEventId: order.live_event_id,
    liveEventName: order.live_event_name || "",
    liveEventSongCount: order.live_event_song_count || order.song_count,
    performanceOrder: order.performance_order,
    bandName: order.band_name,
    contactName: order.contact_name,
    songCount: order.song_count,
    usesBackingTrack: Boolean(order.uses_backing_track),
    status: order.status,
    createdAt: order.created_at,
  };
}

function orderInsertValues(order: PAOrder) {
  return [
    order.id,
    order.editToken,
    order.liveEventId,
    order.liveEventName,
    order.liveEventSongCount,
    order.performanceOrder,
    order.bandName,
    order.contactName,
    order.microphoneCount,
    order.usesBackingTrack ? 1 : 0,
    order.generalRequest,
    order.status,
    order.createdAt,
    order.updatedAt,
  ];
}

function orderUpdateValues(order: PAOrder) {
  return [
    order.liveEventId,
    order.liveEventName,
    order.liveEventSongCount,
    order.performanceOrder,
    order.bandName,
    order.contactName,
    order.microphoneCount,
    order.usesBackingTrack ? 1 : 0,
    order.generalRequest,
    new Date().toISOString(),
  ];
}

function relatedInsertStatements(db: D1DatabaseBinding, orderId: string, order: PAOrder) {
  return [
    ...order.members.map((member, index) =>
      db
        .prepare("insert into members (id, order_id, name, instrument, position) values (?, ?, ?, ?, ?)")
        .bind(`${orderId}_${member.id}`, orderId, member.name, member.instrument, index),
    ),
    ...order.songs.map((song) =>
      db
        .prepare(
          "insert into songs (id, order_id, song_order, title, duration, mood, start_trigger, pa_request, has_mc, mc_person) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(
          `${orderId}_${song.id}`,
          orderId,
          song.order,
          song.title,
          song.duration,
          song.mood,
          song.startTrigger,
          song.paRequest,
          song.mc.hasMc ? 1 : 0,
          song.mc.person,
        ),
    ),
    ...order.equipment.map((item, index) =>
      db
        .prepare("insert into equipment (id, order_id, name, instrument, position) values (?, ?, ?, ?, ?)")
        .bind(`${orderId}_${item.id}`, orderId, item.name, item.instrument, index),
    ),
  ];
}

async function replaceRelatedRows(orderId: string, order: PAOrder) {
  const db = getD1Database();
  const results = await db.batch([
    db.prepare("delete from members where order_id = ?").bind(orderId),
    db.prepare("delete from songs where order_id = ?").bind(orderId),
    db.prepare("delete from equipment where order_id = ?").bind(orderId),
    ...relatedInsertStatements(db, orderId, order),
  ]);

  results.forEach((result) => assertD1Result(result, "Failed to replace order details"));
}

async function getRelatedRows(orderIds: string[]) {
  const db = getD1Database();

  if (orderIds.length === 0) {
    return { members: [], songs: [], equipment: [] };
  }

  const placeholders = orderIds.map(() => "?").join(", ");
  const [membersResult, songsResult, equipmentResult] = await Promise.all([
    db.prepare(`select * from members where order_id in (${placeholders})`).bind(...orderIds).all<MemberRow>(),
    db.prepare(`select * from songs where order_id in (${placeholders})`).bind(...orderIds).all<SongRow>(),
    db.prepare(`select * from equipment where order_id in (${placeholders})`).bind(...orderIds).all<EquipmentRow>(),
  ]);

  assertD1Result(membersResult, "Failed to fetch members");
  assertD1Result(songsResult, "Failed to fetch songs");
  assertD1Result(equipmentResult, "Failed to fetch equipment");

  return {
    members: membersResult.results || [],
    songs: songsResult.results || [],
    equipment: equipmentResult.results || [],
  };
}

async function getHydratedOrder(filter: { editToken?: string; id?: string }) {
  const db = getD1Database();
  const row = filter.id
    ? await db.prepare("select * from orders where id = ?").bind(filter.id).first<OrderRow>()
    : await db.prepare("select * from orders where edit_token = ?").bind(filter.editToken || "").first<OrderRow>();

  if (!row) return null;

  const related = await getRelatedRows([row.id]);

  return orderFromRows(
    row,
    related.members.filter((member) => member.order_id === row.id),
    related.songs.filter((song) => song.order_id === row.id),
    related.equipment.filter((item) => item.order_id === row.id),
  );
}

export async function createOrder(order: PAOrder) {
  const db = getD1Database();
  const performanceOrder = order.performanceOrder ?? (await getNextPerformanceOrder(order.liveEventId));
  const nextOrder = { ...order, performanceOrder };
  const results = await db.batch([
    db
      .prepare(
        "insert into orders (id, edit_token, live_event_id, live_event_name, live_event_song_count, performance_order, band_name, contact_name, microphone_count, uses_backing_track, general_request, status, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(...orderInsertValues(nextOrder)),
    ...relatedInsertStatements(db, order.id, nextOrder),
  ]);

  results.forEach((result) => assertD1Result(result, "Failed to create order"));

  return getOrder(order.id);
}

export async function listOrderSummaries(): Promise<OrderSummary[]> {
  const db = getD1Database();
  const result = await db
    .prepare(
      "select orders.*, (select count(*) from songs where songs.order_id = orders.id) as song_count from orders order by created_at desc",
    )
    .all<OrderSummaryRow>();
  assertD1Result(result, "Failed to fetch order summaries");

  return (result.results || []).map(summaryFromRow);
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

  const performanceOrder =
    existingOrder.liveEventId === nextOrder.liveEventId
      ? existingOrder.performanceOrder
      : await getNextPerformanceOrder(nextOrder.liveEventId);
  const orderWithPerformanceOrder = { ...nextOrder, performanceOrder };
  const db = getD1Database();
  const result = await db
    .prepare(
      "update orders set live_event_id = ?, live_event_name = ?, live_event_song_count = ?, performance_order = ?, band_name = ?, contact_name = ?, microphone_count = ?, uses_backing_track = ?, general_request = ?, updated_at = ? where edit_token = ?",
    )
    .bind(...orderUpdateValues(orderWithPerformanceOrder), editToken)
    .run();
  assertD1Result(result, "Failed to update order");

  await replaceRelatedRows(existingOrder.id, orderWithPerformanceOrder);
  if (existingOrder.liveEventId && existingOrder.liveEventId !== orderWithPerformanceOrder.liveEventId) {
    await normalizePerformanceOrders(existingOrder.liveEventId);
  }

  return getOrder(existingOrder.id);
}

export async function updateOrderById(id: string, nextOrder: PAOrder) {
  const existingOrder = await getOrder(id);
  if (!existingOrder) return null;

  const performanceOrder =
    existingOrder.liveEventId === nextOrder.liveEventId
      ? existingOrder.performanceOrder
      : await getNextPerformanceOrder(nextOrder.liveEventId);
  const orderWithPerformanceOrder = { ...nextOrder, performanceOrder };
  const db = getD1Database();
  const result = await db
    .prepare(
      "update orders set live_event_id = ?, live_event_name = ?, live_event_song_count = ?, performance_order = ?, band_name = ?, contact_name = ?, microphone_count = ?, uses_backing_track = ?, general_request = ?, updated_at = ? where id = ?",
    )
    .bind(...orderUpdateValues(orderWithPerformanceOrder), id)
    .run();
  assertD1Result(result, "Failed to update order");

  await replaceRelatedRows(id, orderWithPerformanceOrder);
  if (existingOrder.liveEventId && existingOrder.liveEventId !== orderWithPerformanceOrder.liveEventId) {
    await normalizePerformanceOrders(existingOrder.liveEventId);
  }

  return getOrder(id);
}

export async function updateOrderStatus(id: string, status: OrderStatus) {
  const db = getD1Database();
  const result = await db
    .prepare("update orders set status = ?, updated_at = ? where id = ?")
    .bind(status, new Date().toISOString(), id)
    .run();
  assertD1Result(result, "Failed to update order status");
}

export async function deleteOrder(id: string) {
  const db = getD1Database();
  const existingOrder = await getOrder(id);
  const results = await db.batch([
    db.prepare("delete from members where order_id = ?").bind(id),
    db.prepare("delete from songs where order_id = ?").bind(id),
    db.prepare("delete from equipment where order_id = ?").bind(id),
    db.prepare("delete from orders where id = ?").bind(id),
  ]);

  results.forEach((result) => assertD1Result(result, "Failed to delete order"));
  if (existingOrder?.liveEventId) {
    await normalizePerformanceOrders(existingOrder.liveEventId);
  }
}

export async function listOrders() {
  const db = getD1Database();
  const result = await db.prepare("select * from orders order by created_at desc").all<OrderRow>();
  assertD1Result(result, "Failed to fetch orders");

  const orders = result.results || [];
  const related = await getRelatedRows(orders.map((order) => order.id));

  return orders.map((order) =>
    orderFromRows(
      order,
      related.members.filter((member) => member.order_id === order.id),
      related.songs.filter((song) => song.order_id === order.id),
      related.equipment.filter((item) => item.order_id === order.id),
    ),
  );
}

async function getNextPerformanceOrder(liveEventId: string) {
  if (!liveEventId) return null;

  const db = getD1Database();
  const row = await db
    .prepare("select max(performance_order) as max_order from orders where live_event_id = ?")
    .bind(liveEventId)
    .first<{ max_order: number | null }>();

  return (row?.max_order || 0) + 1;
}

async function getOrderedRowsByLiveEvent(liveEventId: string) {
  const db = getD1Database();
  const result = await db
    .prepare(
      "select orders.*, (select count(*) from songs where songs.order_id = orders.id) as song_count from orders where live_event_id = ? order by coalesce(performance_order, 999999), created_at asc",
    )
    .bind(liveEventId)
    .all<OrderSummaryRow>();
  assertD1Result(result, "Failed to fetch live event orders");

  return result.results || [];
}

async function normalizePerformanceOrders(liveEventId: string) {
  if (!liveEventId) return;

  const db = getD1Database();
  const rows = await getOrderedRowsByLiveEvent(liveEventId);
  if (rows.length === 0) return;

  const now = new Date().toISOString();
  const results = await db.batch(
    rows.map((order, index) =>
      db
        .prepare("update orders set performance_order = ?, updated_at = ? where id = ?")
        .bind(index + 1, now, order.id),
    ),
  );

  results.forEach((result) => assertD1Result(result, "Failed to normalize performance orders"));
}

export async function listOrdersByLiveEvent(liveEventId: string) {
  if (!liveEventId) return [];

  await normalizePerformanceOrders(liveEventId);

  const rows = await getOrderedRowsByLiveEvent(liveEventId);
  const related = await getRelatedRows(rows.map((order) => order.id));

  return rows.map((order) =>
    orderFromRows(
      order,
      related.members.filter((member) => member.order_id === order.id),
      related.songs.filter((song) => song.order_id === order.id),
      related.equipment.filter((item) => item.order_id === order.id),
    ),
  );
}

export async function moveOrderInLiveEvent(liveEventId: string, orderId: string, direction: "up" | "down") {
  if (!liveEventId || !orderId) return;

  const rows = await getOrderedRowsByLiveEvent(liveEventId);
  const currentIndex = rows.findIndex((order) => order.id === orderId);
  const nextIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;

  if (currentIndex < 0 || nextIndex < 0 || nextIndex >= rows.length) return;

  const nextRows = [...rows];
  const [movedOrder] = nextRows.splice(currentIndex, 1);
  nextRows.splice(nextIndex, 0, movedOrder);

  const db = getD1Database();
  const now = new Date().toISOString();
  const results = await db.batch(
    nextRows.map((order, index) =>
      db
        .prepare("update orders set performance_order = ?, updated_at = ? where id = ? and live_event_id = ?")
        .bind(index + 1, now, order.id, liveEventId),
    ),
  );

  results.forEach((result) => assertD1Result(result, "Failed to update performance order"));
}
