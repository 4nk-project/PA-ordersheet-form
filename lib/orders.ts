import { assertD1Result, getD1Database, type D1DatabaseBinding, type D1PreparedStatement } from "@/lib/d1/server";
import { randomId, sha256Hex, stableStringify } from "@/lib/crypto";
import { formatDuration, makeEditToken, parseLegacyDuration } from "@/lib/orderSchema";
import { nowIso, toIsoUtc } from "@/lib/time";
import { OrderContentSchema, type OrderContent } from "@/contracts/v1";
import { pickOrderContent } from "@/contracts/v1/diff";
import type { Equipment, LiveEvent, Member, OrderRevision, OrderStatus, OrderSummary, PAOrder, Song } from "@/types/order";

type OrderRow = {
  admin_updated_at: string | null;
  backing_track_connection: string | null;
  backing_track_device: string | null;
  backing_track_operator: string | null;
  band_name: string;
  contact_name: string;
  content_revision: number | null;
  created_at: string;
  edit_token: string;
  entry_id: string | null;
  general_request: string | null;
  id: string;
  live_event_id: string;
  live_event_name: string | null;
  live_event_song_count: number | null;
  microphone_count: number | null;
  performance_order: number | null;
  reviewed_at: string | null;
  reviewed_revision: number | null;
  status: OrderStatus;
  submitter_updated_at: string | null;
  updated_at: string;
  uses_backing_track: number | null;
};

type OrderSummaryRow = OrderRow & {
  has_pa_request: number;
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
  duration_seconds: number | null;
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
  member_id: string | null;
  name: string | null;
  order_id: string;
  position: number | null;
};

type RevisionRow = {
  actor: OrderRevision["actor"];
  admin_updated_at: string | null;
  content_json: string;
  created_at: string;
  order_id: string;
  revision: number;
  submitter_updated_at: string | null;
};

function memberFromRow(row: MemberRow): Member {
  return { id: row.id, name: row.name || "", instrument: row.instrument || "" };
}

function songFromRow(row: SongRow): Song {
  return {
    id: row.id,
    order: row.song_order,
    title: row.title || "",
    durationSeconds: row.duration_seconds ?? parseLegacyDuration(row.duration),
    duration: row.duration || "",
    mood: row.mood || "",
    startTrigger: row.start_trigger || "",
    paRequest: row.pa_request || "",
    mc: { hasMc: Boolean(row.has_mc), person: row.mc_person || "" },
  };
}

function equipmentFromRow(row: EquipmentRow): Equipment {
  return { id: row.id, name: row.name || "", instrument: row.instrument || "", memberId: row.member_id || null };
}

function orderFromRows(order: OrderRow, members: MemberRow[] = [], songs: SongRow[] = [], equipment: EquipmentRow[] = []): PAOrder {
  const createdAt = toIsoUtc(order.created_at) || order.created_at;
  const updatedAt = toIsoUtc(order.updated_at) || createdAt;
  const memberList = members.sort((a, b) => (a.position || 0) - (b.position || 0)).map(memberFromRow);
  const memberIds = new Set(memberList.map((member) => member.id));
  return {
    id: order.id,
    editToken: order.edit_token,
    entryId: order.entry_id,
    liveEventId: order.live_event_id || "",
    liveEventName: order.live_event_name || "",
    liveEventSongCount: order.live_event_song_count || songs.length,
    performanceOrder: order.performance_order,
    bandName: order.band_name,
    contactName: order.contact_name,
    microphoneCount: order.microphone_count || 0,
    usesBackingTrack: Boolean(order.uses_backing_track),
    backingTrack: {
      operator: order.backing_track_operator || "",
      device: order.backing_track_device || "",
      connection: order.backing_track_connection || "",
    },
    members: memberList,
    songs: songs.sort((a, b) => a.song_order - b.song_order).map(songFromRow),
    equipment: equipment
      .sort((a, b) => (a.position || 0) - (b.position || 0))
      .map(equipmentFromRow)
      .map((item) => ({ ...item, memberId: item.memberId && memberIds.has(item.memberId) ? item.memberId : null })),
    generalRequest: order.general_request || "",
    status: order.status,
    contentRevision: Math.max(1, Number(order.content_revision || 1)),
    reviewedRevision: order.reviewed_revision ?? null,
    reviewedAt: toIsoUtc(order.reviewed_at),
    createdAt,
    updatedAt,
    submitterUpdatedAt: toIsoUtc(order.submitter_updated_at) || updatedAt,
    adminUpdatedAt: toIsoUtc(order.admin_updated_at),
  };
}

function summaryFromRow(order: OrderSummaryRow): OrderSummary {
  const createdAt = toIsoUtc(order.created_at) || order.created_at;
  const updatedAt = toIsoUtc(order.updated_at) || createdAt;
  return {
    id: order.id,
    editToken: order.edit_token,
    entryId: order.entry_id,
    liveEventId: order.live_event_id || "",
    liveEventName: order.live_event_name || "",
    liveEventSongCount: order.live_event_song_count || order.song_count,
    performanceOrder: order.performance_order,
    bandName: order.band_name,
    contactName: order.contact_name,
    songCount: order.song_count,
    usesBackingTrack: Boolean(order.uses_backing_track),
    hasPaRequest: Boolean(order.has_pa_request),
    status: order.status,
    contentRevision: Math.max(1, Number(order.content_revision || 1)),
    reviewedRevision: order.reviewed_revision ?? null,
    createdAt,
    updatedAt,
    submitterUpdatedAt: toIsoUtc(order.submitter_updated_at) || updatedAt,
    adminUpdatedAt: toIsoUtc(order.admin_updated_at),
  };
}

/** 保存済みの提出から、版として扱う内容を取り出す */
export function orderContentOf(order: PAOrder): OrderContent {
  return pickOrderContent({
    bandName: order.bandName,
    contactName: order.contactName,
    microphoneCount: order.microphoneCount,
    usesBackingTrack: order.usesBackingTrack,
    backingTrack: order.usesBackingTrack ? order.backingTrack : null,
    members: order.members,
    equipment: order.equipment,
    songs: order.songs.map((song) => ({ ...song })),
    generalRequest: order.generalRequest,
  });
}

async function getRelatedRows(orderIds: string[]) {
  const db = getD1Database();
  if (orderIds.length === 0) return { members: [], songs: [], equipment: [] };
  const placeholders = orderIds.map(() => "?").join(", ");
  const [membersResult, songsResult, equipmentResult] = await Promise.all([
    db.prepare(`select * from members where order_id in (${placeholders})`).bind(...orderIds).all<MemberRow>(),
    db.prepare(`select * from songs where order_id in (${placeholders})`).bind(...orderIds).all<SongRow>(),
    db.prepare(`select * from equipment where order_id in (${placeholders})`).bind(...orderIds).all<EquipmentRow>(),
  ]);
  assertD1Result(membersResult, "Failed to fetch members");
  assertD1Result(songsResult, "Failed to fetch songs");
  assertD1Result(equipmentResult, "Failed to fetch equipment");
  return { members: membersResult.results || [], songs: songsResult.results || [], equipment: equipmentResult.results || [] };
}

function hydrate(rows: OrderRow[], related: Awaited<ReturnType<typeof getRelatedRows>>) {
  return rows.map((order) =>
    orderFromRows(
      order,
      related.members.filter((member) => member.order_id === order.id),
      related.songs.filter((song) => song.order_id === order.id),
      related.equipment.filter((item) => item.order_id === order.id),
    ),
  );
}

async function getHydratedOrder(column: "id" | "edit_token" | "entry_id", value: string) {
  if (!value) return null;
  const row = await getD1Database().prepare(`select * from orders where ${column} = ?`).bind(value).first<OrderRow>();
  if (!row) return null;
  return hydrate([row], await getRelatedRows([row.id]))[0];
}

export async function getOrder(id: string) {
  return getHydratedOrder("id", id);
}

export async function getOrderByEditToken(editToken: string) {
  return getHydratedOrder("edit_token", editToken);
}

export async function getOrderByEntryId(entryId: string) {
  return getHydratedOrder("entry_id", entryId);
}

export async function listOrders() {
  const result = await getD1Database().prepare("select * from orders order by created_at desc").all<OrderRow>();
  assertD1Result(result, "Failed to fetch orders");
  const orders = result.results || [];
  return hydrate(orders, await getRelatedRows(orders.map((order) => order.id)));
}

export async function listOrderSummaries(): Promise<OrderSummary[]> {
  const result = await getD1Database()
    .prepare(
      "select orders.*, (select count(*) from songs where songs.order_id = orders.id) as song_count, (case when coalesce(orders.general_request, '') != '' or exists(select 1 from songs where songs.order_id = orders.id and coalesce(songs.pa_request, '') != '') then 1 else 0 end) as has_pa_request from orders order by created_at desc",
    )
    .all<OrderSummaryRow>();
  assertD1Result(result, "Failed to fetch order summaries");
  return (result.results || []).map(summaryFromRow);
}

/** ライブ・エントリーに紐づかない旧形式の提出（ライブ未設定など） */
export async function listUnlinkedOrderSummaries() {
  return (await listOrderSummaries()).filter((order) => !order.entryId);
}

export async function listOrdersByLiveEvent(liveEventId: string) {
  if (!liveEventId) return [];
  const result = await getD1Database()
    .prepare(
      "select orders.* from orders left join event_entries on event_entries.id = orders.entry_id where orders.live_event_id = ? order by coalesce(event_entries.initial_performance_order, orders.performance_order, 999999), orders.created_at asc",
    )
    .bind(liveEventId)
    .all<OrderRow>();
  assertD1Result(result, "Failed to fetch live event orders");
  const rows = result.results || [];
  return hydrate(rows, await getRelatedRows(rows.map((order) => order.id)));
}

/* -------------------------------------------------------------------------- */
/* 版履歴                                                                      */
/* -------------------------------------------------------------------------- */

function revisionFromRow(row: RevisionRow): OrderRevision {
  return {
    orderId: row.order_id,
    revision: row.revision,
    content: OrderContentSchema.parse(JSON.parse(row.content_json)),
    actor: row.actor,
    submitterUpdatedAt: toIsoUtc(row.submitter_updated_at),
    adminUpdatedAt: toIsoUtc(row.admin_updated_at),
    createdAt: toIsoUtc(row.created_at) || row.created_at,
  };
}

export async function getOrderRevision(orderId: string, revision: number) {
  const row = await getD1Database().prepare("select * from order_revisions where order_id = ? and revision = ?").bind(orderId, revision).first<RevisionRow>();
  if (row) return revisionFromRow(row);
  // 移行前に作られた行などで履歴が欠けている場合、現在の版に限り現在の内容を返す
  const order = await getOrder(orderId);
  if (order && order.contentRevision === revision) {
    return { orderId, revision, content: orderContentOf(order), actor: "migration", submitterUpdatedAt: order.submitterUpdatedAt, adminUpdatedAt: order.adminUpdatedAt, createdAt: order.updatedAt } satisfies OrderRevision;
  }
  return null;
}

export async function listOrderRevisions(orderId: string) {
  const result = await getD1Database()
    .prepare("select order_id, revision, actor, submitter_updated_at, admin_updated_at, created_at, '{}' as content_json from order_revisions where order_id = ? order by revision desc")
    .bind(orderId)
    .all<RevisionRow>();
  assertD1Result(result, "Failed to fetch revisions");
  return (result.results || []).map((row) => ({
    revision: row.revision,
    actor: row.actor,
    createdAt: toIsoUtc(row.created_at) || row.created_at,
  }));
}

/* -------------------------------------------------------------------------- */
/* 保存（原子的なバッチ・楽観ロック・再送照合）                                    */
/* -------------------------------------------------------------------------- */

export type SaveActor = "submitter" | "admin";

export type SaveOrderRequest =
  | {
      kind: "create";
      liveEvent: LiveEvent;
      /** 招待経由なら対象エントリー。null なら旧フォームとしてエントリーも同時に作る */
      entryId: string | null;
      content: OrderContent;
      actor: SaveActor;
      submissionId: string;
    }
  | {
      kind: "update";
      orderId: string;
      liveEvent: LiveEvent;
      expectedRevision: number;
      content: OrderContent;
      actor: SaveActor;
      submissionId: string;
    };

export type SaveOrderResult =
  | { ok: true; orderId: string; entryId: string | null; editToken: string; revision: number; duplicate: boolean; unchanged: boolean }
  | { ok: false; code: "revision_conflict"; currentRevision: number }
  | { ok: false; code: "not_found" | "entry_taken" | "submission_mismatch" };

type SubmissionRecordRow = { order_id: string; entry_id: string | null; request_hash: string; result_revision: number };

/** 既存の項目IDを維持し、それ以外はサーバーで新しいIDを振る。機材の使用者も付け替える */
export function resolveContentIds(content: OrderContent, existing: OrderContent | null): OrderContent {
  const known = {
    members: new Set(existing?.members.map((item) => item.id)),
    equipment: new Set(existing?.equipment.map((item) => item.id)),
    songs: new Set(existing?.songs.map((item) => item.id)),
  };
  const memberMap = new Map<string, string>();
  const members = content.members.map((member) => {
    const id = known.members.has(member.id) ? member.id : randomId("mem");
    memberMap.set(member.id, id);
    return { ...member, id };
  });
  return pickOrderContent({
    ...content,
    backingTrack: content.usesBackingTrack ? content.backingTrack ?? { operator: "", device: "", connection: "" } : null,
    members,
    equipment: content.equipment.map((item) => ({
      ...item,
      id: known.equipment.has(item.id) ? item.id : randomId("eqp"),
      memberId: item.memberId ? memberMap.get(item.memberId) ?? null : null,
    })),
    songs: content.songs.map((song, index) => ({ ...song, id: known.songs.has(song.id) ? song.id : randomId("song"), order: index + 1 })),
  });
}

function relatedInsertStatements(db: D1DatabaseBinding, orderId: string, content: OrderContent): D1PreparedStatement[] {
  return [
    ...content.members.map((member, index) =>
      db.prepare("insert into members (id, order_id, name, instrument, position) values (?, ?, ?, ?, ?)").bind(member.id, orderId, member.name, member.instrument, index),
    ),
    ...content.songs.map((song) =>
      db
        .prepare(
          "insert into songs (id, order_id, song_order, title, duration, duration_seconds, mood, start_trigger, pa_request, has_mc, mc_person) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(
          song.id,
          orderId,
          song.order,
          song.title,
          song.durationSeconds === null ? "" : formatDuration(song.durationSeconds),
          song.durationSeconds,
          song.mood,
          song.startTrigger,
          song.paRequest,
          song.mc.hasMc ? 1 : 0,
          song.mc.person,
        ),
    ),
    ...content.equipment.map((item, index) =>
      db
        .prepare("insert into equipment (id, order_id, name, instrument, position, member_id) values (?, ?, ?, ?, ?, ?)")
        .bind(item.id, orderId, item.name, item.instrument, index, item.memberId),
    ),
  ];
}

async function findSubmission(submissionId: string) {
  if (!submissionId) return null;
  return getD1Database().prepare("select order_id, entry_id, request_hash, result_revision from submission_records where submission_id = ?").bind(submissionId).first<SubmissionRecordRow>();
}

async function requestHashOf(request: SaveOrderRequest) {
  return sha256Hex(
    stableStringify({
      kind: request.kind,
      target: request.kind === "create" ? request.entryId ?? `live:${request.liveEvent.id}` : request.orderId,
      expectedRevision: request.kind === "update" ? request.expectedRevision : null,
      actor: request.actor,
      content: request.content,
    }),
  );
}

async function replay(record: SubmissionRecordRow, requestHash: string): Promise<SaveOrderResult> {
  if (record.request_hash !== requestHash) return { ok: false, code: "submission_mismatch" };
  const order = await getOrder(record.order_id);
  if (!order) return { ok: false, code: "not_found" };
  return { ok: true, orderId: order.id, entryId: order.entryId, editToken: order.editToken, revision: record.result_revision, duplicate: true, unchanged: false };
}

/**
 * 提出の作成・更新。原本・曲・メンバー・機材・版履歴・再送記録を1つの D1 batch（トランザクション）で書き込む。
 * 楽観ロックの条件は write_guards への NOT NULL 挿入で判定し、不成立ならバッチ全体が失敗する。
 * 再送記録（submissionId）は版競合より先に照合する。
 */
export async function saveOrder(request: SaveOrderRequest): Promise<SaveOrderResult> {
  const db = getD1Database();
  const requestHash = await requestHashOf(request);
  const existingRecord = await findSubmission(request.submissionId);
  if (existingRecord) return replay(existingRecord, requestHash);

  const now = nowIso();
  const guardId = randomId("guard");
  const event = request.liveEvent;

  if (request.kind === "create") {
    const content = resolveContentIds(request.content, null);
    const orderId = randomId("ord");
    const editToken = makeEditToken();
    const statements: D1PreparedStatement[] = [];
    let entryId = request.entryId;
    if (entryId) {
      statements.push(
        db
          .prepare("insert into write_guards (id, ok) values (?, (select 1 from event_entries where id = ? and live_event_id = ? and cancelled_at is null and not exists (select 1 from orders where entry_id = ?)))")
          .bind(guardId, entryId, event.id, entryId),
      );
    } else {
      entryId = randomId("ent");
      statements.push(
        db.prepare("insert into write_guards (id, ok) values (?, 1)").bind(guardId),
        db
          .prepare(
            "insert into event_entries (id, live_event_id, band_name, initial_performance_order, cancelled_at, revision, created_at, updated_at) values (?, ?, ?, (select coalesce(max(initial_performance_order), 0) + 1 from event_entries where live_event_id = ?), NULL, 1, ?, ?)",
          )
          .bind(entryId, event.id, content.bandName, event.id, now, now),
      );
    }
    statements.push(
      db
        .prepare(
          `insert into orders (id, edit_token, live_event_id, live_event_name, live_event_song_count, performance_order, band_name, contact_name, microphone_count, uses_backing_track, general_request, status, created_at, updated_at,
            entry_id, content_revision, reviewed_revision, reviewed_at, submitter_updated_at, admin_updated_at, backing_track_operator, backing_track_device, backing_track_connection)
           values (?, ?, ?, ?, ?, (select initial_performance_order from event_entries where id = ?), ?, ?, ?, ?, ?, 'new', ?, ?, ?, 1, NULL, NULL, ?, ?, ?, ?, ?)`,
        )
        .bind(
          orderId,
          editToken,
          event.id,
          event.name,
          event.songCount,
          entryId,
          content.bandName,
          content.contactName,
          content.microphoneCount,
          content.usesBackingTrack ? 1 : 0,
          content.generalRequest,
          now,
          now,
          entryId,
          request.actor === "submitter" ? now : null,
          request.actor === "admin" ? now : null,
          content.backingTrack?.operator || "",
          content.backingTrack?.device || "",
          content.backingTrack?.connection || "",
        ),
      ...relatedInsertStatements(db, orderId, content),
      db
        .prepare("insert into order_revisions (order_id, revision, content_json, actor, submitter_updated_at, admin_updated_at, created_at) values (?, 1, ?, ?, ?, ?, ?)")
        .bind(orderId, JSON.stringify(content), request.actor, request.actor === "submitter" ? now : null, request.actor === "admin" ? now : null, now),
    );
    if (request.submissionId) {
      statements.push(
        db.prepare("insert into submission_records (submission_id, order_id, entry_id, request_hash, result_revision, created_at) values (?, ?, ?, ?, 1, ?)").bind(request.submissionId, orderId, entryId, requestHash, now),
      );
    }
    statements.push(db.prepare("delete from write_guards where id = ?").bind(guardId));

    try {
      const results = await db.batch(statements);
      results.forEach((result) => assertD1Result(result, "Failed to create order"));
    } catch (error) {
      const record = await findSubmission(request.submissionId);
      if (record) return replay(record, requestHash);
      if (request.entryId && (await getOrderByEntryId(request.entryId))) return { ok: false, code: "entry_taken" };
      throw error;
    }
    return { ok: true, orderId, entryId, editToken, revision: 1, duplicate: false, unchanged: false };
  }

  const existing = await getOrder(request.orderId);
  if (!existing) return { ok: false, code: "not_found" };
  if (existing.contentRevision !== request.expectedRevision) return { ok: false, code: "revision_conflict", currentRevision: existing.contentRevision };
  const currentContent = orderContentOf(existing);
  const content = resolveContentIds(request.content, currentContent);

  // 内容が変わらない再提出では版を増やさない
  if (stableStringify(content) === stableStringify(currentContent)) {
    if (request.submissionId) {
      await db
        .prepare("insert or ignore into submission_records (submission_id, order_id, entry_id, request_hash, result_revision, created_at) values (?, ?, ?, ?, ?, ?)")
        .bind(request.submissionId, existing.id, existing.entryId, requestHash, existing.contentRevision, now)
        .run();
    }
    return { ok: true, orderId: existing.id, entryId: existing.entryId, editToken: existing.editToken, revision: existing.contentRevision, duplicate: false, unchanged: true };
  }

  const nextRevision = request.expectedRevision + 1;
  const statements: D1PreparedStatement[] = [
    db.prepare("insert into write_guards (id, ok) values (?, (select 1 from orders where id = ? and content_revision = ?))").bind(guardId, existing.id, request.expectedRevision),
    db
      .prepare(
        `update orders set live_event_name = ?, live_event_song_count = ?, band_name = ?, contact_name = ?, microphone_count = ?, uses_backing_track = ?, general_request = ?,
          backing_track_operator = ?, backing_track_device = ?, backing_track_connection = ?, content_revision = ?, updated_at = ?,
          submitter_updated_at = case when ? = 'submitter' then ? else submitter_updated_at end,
          admin_updated_at = case when ? = 'admin' then ? else admin_updated_at end
         where id = ? and content_revision = ?`,
      )
      .bind(
        event.name,
        event.songCount,
        content.bandName,
        content.contactName,
        content.microphoneCount,
        content.usesBackingTrack ? 1 : 0,
        content.generalRequest,
        content.backingTrack?.operator || "",
        content.backingTrack?.device || "",
        content.backingTrack?.connection || "",
        nextRevision,
        now,
        request.actor,
        now,
        request.actor,
        now,
        existing.id,
        request.expectedRevision,
      ),
    db.prepare("delete from members where order_id = ?").bind(existing.id),
    db.prepare("delete from songs where order_id = ?").bind(existing.id),
    db.prepare("delete from equipment where order_id = ?").bind(existing.id),
    ...relatedInsertStatements(db, existing.id, content),
    db
      .prepare("insert into order_revisions (order_id, revision, content_json, actor, submitter_updated_at, admin_updated_at, created_at) values (?, ?, ?, ?, ?, ?, ?)")
      .bind(
        existing.id,
        nextRevision,
        JSON.stringify(content),
        request.actor,
        request.actor === "submitter" ? now : existing.submitterUpdatedAt,
        request.actor === "admin" ? now : existing.adminUpdatedAt,
        now,
      ),
  ];
  if (request.submissionId) {
    statements.push(
      db.prepare("insert into submission_records (submission_id, order_id, entry_id, request_hash, result_revision, created_at) values (?, ?, ?, ?, ?, ?)").bind(request.submissionId, existing.id, existing.entryId, requestHash, nextRevision, now),
    );
  }
  statements.push(db.prepare("delete from write_guards where id = ?").bind(guardId));

  try {
    const results = await db.batch(statements);
    results.forEach((result) => assertD1Result(result, "Failed to update order"));
  } catch (error) {
    const record = await findSubmission(request.submissionId);
    if (record) return replay(record, requestHash);
    const current = await getOrder(existing.id);
    if (!current) return { ok: false, code: "not_found" };
    if (current.contentRevision !== request.expectedRevision) return { ok: false, code: "revision_conflict", currentRevision: current.contentRevision };
    throw error;
  }
  return { ok: true, orderId: existing.id, entryId: existing.entryId, editToken: existing.editToken, revision: nextRevision, duplicate: false, unchanged: false };
}

/* -------------------------------------------------------------------------- */
/* 確認                                                                        */
/* -------------------------------------------------------------------------- */

export type ReviewResult =
  | { ok: true; orderId: string; reviewedRevision: number; reviewedAt: string }
  | { ok: false; code: "not_found" }
  | { ok: false; code: "revision_conflict"; currentRevision: number };

/** expectedRevision が現在の版と一致するときだけ確認済みにする */
export async function reviewOrder(orderId: string, expectedRevision: number): Promise<ReviewResult> {
  const db = getD1Database();
  const now = nowIso();
  const result = await db
    .prepare(
      "update orders set reviewed_revision = ?, reviewed_at = case when reviewed_revision = ? and reviewed_at is not null then reviewed_at else ? end, status = 'done' where id = ? and content_revision = ?",
    )
    .bind(expectedRevision, expectedRevision, now, orderId, expectedRevision)
    .run();
  assertD1Result(result, "Failed to review order");
  const current = await db.prepare("select content_revision, reviewed_revision, reviewed_at from orders where id = ?").bind(orderId).first<{ content_revision: number; reviewed_revision: number | null; reviewed_at: string | null }>();
  if (!current) return { ok: false, code: "not_found" };
  if (!result.meta?.changes || current.reviewed_revision !== expectedRevision) return { ok: false, code: "revision_conflict", currentRevision: current.content_revision };
  return { ok: true, orderId, reviewedRevision: expectedRevision, reviewedAt: toIsoUtc(current.reviewed_at) || now };
}

/** 確認作業の状態（未確認・確認中）だけを変える。提出内容の版は変えない */
export async function updateOrderStatus(id: string, status: Exclude<OrderStatus, "done">) {
  const result = await getD1Database().prepare("update orders set status = ? where id = ?").bind(status, id).run();
  assertD1Result(result, "Failed to update order status");
}

export async function deleteOrder(id: string) {
  const db = getD1Database();
  const results = await db.batch([
    db.prepare("delete from members where order_id = ?").bind(id),
    db.prepare("delete from songs where order_id = ?").bind(id),
    db.prepare("delete from equipment where order_id = ?").bind(id),
    db.prepare("delete from order_revisions where order_id = ?").bind(id),
    db.prepare("delete from order_comments where order_id = ?").bind(id),
    db.prepare("delete from orders where id = ?").bind(id),
  ]);
  results.forEach((result) => assertD1Result(result, "Failed to delete order"));
}
