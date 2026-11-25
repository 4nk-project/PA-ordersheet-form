import { assertD1Result, getD1Database } from "@/lib/d1/server";
import { randomId, randomToken, sha256Hex } from "@/lib/crypto";
import { getLiveEvent } from "@/lib/liveEvents";
import { nowIso, toIsoUtc } from "@/lib/time";
import type { ImportReceiptDTO } from "@/contracts/v1";
import type { AdminEntryRow, EntryInvite, EventEntry, LiveEvent, OrderStatus } from "@/types/order";

type EntryRow = {
  band_name: string;
  cancelled_at: string | null;
  created_at: string;
  id: string;
  initial_performance_order: number | null;
  live_event_id: string;
  revision: number;
  updated_at: string;
};

type InviteRow = {
  created_at: string;
  entry_id: string;
  expires_at: string;
  id: string;
  revoked_at: string | null;
};

type ReceiptRow = {
  entry_id: string;
  imported_at: string;
  imported_revision: number;
  received_at: string;
  runtime_id: string;
};

type AdminEntryJoinRow = EntryRow & {
  order_id: string | null;
  contact_name: string | null;
  uses_backing_track: number | null;
  status: OrderStatus | null;
  content_revision: number | null;
  reviewed_revision: number | null;
  reviewed_at: string | null;
  order_created_at: string | null;
  submitter_updated_at: string | null;
  order_updated_at: string | null;
  admin_updated_at: string | null;
  song_count: number | null;
  has_pa_request: number | null;
};

export function entryFromRow(row: EntryRow): EventEntry {
  const createdAt = toIsoUtc(row.created_at) || row.created_at;
  return {
    id: row.id,
    liveEventId: row.live_event_id,
    bandName: row.band_name,
    initialPerformanceOrder: row.initial_performance_order,
    cancelledAt: toIsoUtc(row.cancelled_at),
    revision: Math.max(1, Number(row.revision || 1)),
    createdAt,
    updatedAt: toIsoUtc(row.updated_at) || createdAt,
  };
}

function inviteFromRow(row: InviteRow): EntryInvite {
  return {
    id: row.id,
    entryId: row.entry_id,
    expiresAt: toIsoUtc(row.expires_at) || row.expires_at,
    revokedAt: toIsoUtc(row.revoked_at),
    createdAt: toIsoUtc(row.created_at) || row.created_at,
  };
}

function receiptFromRow(row: ReceiptRow): ImportReceiptDTO {
  return {
    runtimeId: row.runtime_id,
    importedRevision: row.imported_revision,
    importedAt: toIsoUtc(row.imported_at) || row.imported_at,
    receivedAt: toIsoUtc(row.received_at) || row.received_at,
  };
}

export async function getEntry(entryId: string) {
  if (!entryId) return null;
  const row = await getD1Database().prepare("select * from event_entries where id = ?").bind(entryId).first<EntryRow>();
  return row ? entryFromRow(row) : null;
}

/** 失効していない最新の招待（期限切れも含む） */
export async function getCurrentInvite(entryId: string) {
  const row = await getD1Database()
    .prepare("select * from entry_invites where entry_id = ? order by revoked_at is null desc, created_at desc limit 1")
    .bind(entryId)
    .first<InviteRow>();
  return row ? inviteFromRow(row) : null;
}

async function invitesByEntry(entryIds: string[]) {
  const map = new Map<string, EntryInvite>();
  if (!entryIds.length) return map;
  const placeholders = entryIds.map(() => "?").join(", ");
  const result = await getD1Database()
    .prepare(`select * from entry_invites where entry_id in (${placeholders}) order by created_at asc`)
    .bind(...entryIds)
    .all<InviteRow>();
  assertD1Result(result, "Failed to fetch invites");
  for (const row of result.results || []) {
    const invite = inviteFromRow(row);
    const existing = map.get(row.entry_id);
    // 失効していない招待を優先し、同じ条件なら新しいものを採用する
    if (!existing || (existing.revokedAt && !invite.revokedAt) || Boolean(existing.revokedAt) === Boolean(invite.revokedAt)) map.set(row.entry_id, invite);
  }
  return map;
}

export async function receiptsByEntry(entryIds: string[]) {
  const map = new Map<string, ImportReceiptDTO[]>();
  if (!entryIds.length) return map;
  const placeholders = entryIds.map(() => "?").join(", ");
  const result = await getD1Database()
    .prepare(`select * from import_receipts where entry_id in (${placeholders}) order by received_at desc`)
    .bind(...entryIds)
    .all<ReceiptRow>();
  assertD1Result(result, "Failed to fetch import receipts");
  for (const row of result.results || []) {
    map.set(row.entry_id, [...(map.get(row.entry_id) || []), receiptFromRow(row)]);
  }
  return map;
}

/** ライブの出演エントリー一覧（未提出・取消を含む） */
export async function listAdminEntries(liveEventId: string): Promise<AdminEntryRow[]> {
  if (!liveEventId) return [];
  const result = await getD1Database()
    .prepare(
      `select event_entries.*,
        orders.id as order_id, orders.contact_name, orders.uses_backing_track, orders.status, orders.content_revision,
        orders.reviewed_revision, orders.reviewed_at, orders.created_at as order_created_at, orders.submitter_updated_at,
        orders.updated_at as order_updated_at, orders.admin_updated_at,
        (select count(*) from songs where songs.order_id = orders.id) as song_count,
        (case when coalesce(orders.general_request, '') != '' or exists(select 1 from songs where songs.order_id = orders.id and coalesce(songs.pa_request, '') != '') then 1 else 0 end) as has_pa_request
      from event_entries
      left join orders on orders.entry_id = event_entries.id
      where event_entries.live_event_id = ?
      order by coalesce(event_entries.initial_performance_order, 999999), event_entries.created_at asc`,
    )
    .bind(liveEventId)
    .all<AdminEntryJoinRow>();
  assertD1Result(result, "Failed to fetch entries");
  const rows = result.results || [];
  const ids = rows.map((row) => row.id);
  const [invites, receipts] = await Promise.all([invitesByEntry(ids), receiptsByEntry(ids)]);
  return rows.map((row) => ({
    entry: entryFromRow(row),
    invite: invites.get(row.id) || null,
    importReceipts: receipts.get(row.id) || [],
    order: row.order_id
      ? {
          id: row.order_id,
          contactName: row.contact_name || "",
          songCount: Number(row.song_count || 0),
          usesBackingTrack: Boolean(row.uses_backing_track),
          hasPaRequest: Boolean(row.has_pa_request),
          status: row.status || "new",
          contentRevision: Number(row.content_revision || 1),
          reviewedRevision: row.reviewed_revision,
          reviewedAt: toIsoUtc(row.reviewed_at),
          createdAt: toIsoUtc(row.order_created_at) || "",
          submitterUpdatedAt: toIsoUtc(row.submitter_updated_at) || toIsoUtc(row.order_updated_at) || "",
          adminUpdatedAt: toIsoUtc(row.admin_updated_at),
        }
      : null,
  }));
}

export async function getAdminEntry(entryId: string) {
  const entry = await getEntry(entryId);
  if (!entry) return null;
  const rows = await listAdminEntries(entry.liveEventId);
  return rows.find((row) => row.entry.id === entryId) || null;
}

async function nextInitialOrder(liveEventId: string) {
  const row = await getD1Database()
    .prepare("select max(initial_performance_order) as max_order from event_entries where live_event_id = ?")
    .bind(liveEventId)
    .first<{ max_order: number | null }>();
  return (row?.max_order || 0) + 1;
}

export async function createEntry(liveEventId: string, bandName: string, initialPerformanceOrder: number | null, id = randomId("ent")) {
  const event = await getLiveEvent(liveEventId);
  if (!event) return null;
  const now = nowIso();
  const order = initialPerformanceOrder ?? (await nextInitialOrder(liveEventId));
  const result = await getD1Database()
    .prepare("insert into event_entries (id, live_event_id, band_name, initial_performance_order, cancelled_at, revision, created_at, updated_at) values (?, ?, ?, ?, NULL, 1, ?, ?)")
    .bind(id, liveEventId, bandName.trim(), order, now, now)
    .run();
  assertD1Result(result, "Failed to create entry");
  return getEntry(id);
}

export type EntryPatch = { bandName?: string; initialPerformanceOrder?: number | null; cancelled?: boolean };

/** 楽観ロック付きのエントリー変更。出演順・名前の変更で提出内容の版は増やさない */
export async function patchEntry(entryId: string, expectedRevision: number, patch: EntryPatch): Promise<EventEntry | "conflict" | null> {
  const db = getD1Database();
  const sets: string[] = [];
  const values: unknown[] = [];
  const now = nowIso();
  if (patch.bandName !== undefined) {
    sets.push("band_name = ?");
    values.push(patch.bandName.trim());
  }
  if (patch.initialPerformanceOrder !== undefined) {
    sets.push("initial_performance_order = ?");
    values.push(patch.initialPerformanceOrder);
  }
  if (patch.cancelled !== undefined) {
    sets.push("cancelled_at = ?");
    values.push(patch.cancelled ? now : null);
  }
  const statements = [
    db.prepare(`update event_entries set ${[...sets, "revision = revision + 1", "updated_at = ?"].join(", ")} where id = ? and revision = ?`).bind(...values, now, entryId, expectedRevision),
  ];
  if (patch.initialPerformanceOrder !== undefined) {
    // 旧来の演奏順表示との互換のため、提出側の performance_order も揃える（内容の版は変えない）
    statements.push(db.prepare("update orders set performance_order = ? where entry_id = ?").bind(patch.initialPerformanceOrder, entryId));
  }
  const [result] = await db.batch(statements);
  assertD1Result(result, "Failed to update entry");
  if (!result.meta?.changes) {
    const current = await getEntry(entryId);
    return current ? "conflict" : null;
  }
  return getEntry(entryId);
}

/** 演奏順管理画面の上下移動。ライブ内の初期出演順を詰め直す */
export async function moveEntry(liveEventId: string, entryId: string, direction: "up" | "down") {
  const rows = await listAdminEntries(liveEventId);
  const currentIndex = rows.findIndex((row) => row.entry.id === entryId);
  const nextIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
  if (currentIndex < 0 || nextIndex < 0 || nextIndex >= rows.length) return;
  const next = [...rows];
  const [moved] = next.splice(currentIndex, 1);
  next.splice(nextIndex, 0, moved);
  const db = getD1Database();
  const now = nowIso();
  const statements = next.flatMap((row, index) => {
    if (row.entry.initialPerformanceOrder === index + 1) return [];
    return [
      db.prepare("update event_entries set initial_performance_order = ?, revision = revision + 1, updated_at = ? where id = ? and live_event_id = ?").bind(index + 1, now, row.entry.id, liveEventId),
      db.prepare("update orders set performance_order = ? where entry_id = ?").bind(index + 1, row.entry.id),
    ];
  });
  if (!statements.length) return;
  const results = await db.batch(statements);
  results.forEach((result) => assertD1Result(result, "Failed to move entry"));
}

/* -------------------------------------------------------------------------- */
/* 招待                                                                        */
/* -------------------------------------------------------------------------- */

export const DEFAULT_INVITE_DAYS = 30;

export function invitePath(token: string) {
  return `/invite/${token}`;
}

export type IssueInviteResult =
  | { ok: true; inviteId: string; token: string; expiresAt: string }
  | { ok: false; code: "not_found" | "invite_exists" | "invalid_request"; message: string };

/** 招待を発行する。reissue=true なら既存の有効な招待を同じバッチで失効させる */
export async function issueInvite(entryId: string, expiresAt: string, reissue: boolean, inviteId = randomId("inv")): Promise<IssueInviteResult> {
  const entry = await getEntry(entryId);
  if (!entry) return { ok: false, code: "not_found", message: "出演エントリーが見つかりません。" };
  if (entry.cancelledAt) return { ok: false, code: "invalid_request", message: "取消済みのエントリーには招待を発行できません。" };
  if (Date.parse(expiresAt) <= Date.now()) return { ok: false, code: "invalid_request", message: "有効期限は現在より後にしてください。" };
  const current = await getCurrentInvite(entryId);
  if (current && !current.revokedAt && Date.parse(current.expiresAt) > Date.now() && !reissue) {
    return { ok: false, code: "invite_exists", message: "有効な招待がすでにあります。再発行する場合は reissue を指定してください。" };
  }
  const token = randomToken(32);
  const tokenHash = await sha256Hex(token);
  const now = nowIso();
  const db = getD1Database();
  const results = await db.batch([
    db.prepare("update entry_invites set revoked_at = ? where entry_id = ? and revoked_at is null").bind(now, entryId),
    db.prepare("insert into entry_invites (id, entry_id, token_hash, expires_at, revoked_at, created_at) values (?, ?, ?, ?, NULL, ?)").bind(inviteId, entryId, tokenHash, new Date(expiresAt).toISOString(), now),
  ]);
  results.forEach((result) => assertD1Result(result, "Failed to issue invite"));
  return { ok: true, inviteId, token, expiresAt: new Date(expiresAt).toISOString() };
}

export async function revokeInvite(entryId: string, inviteId: string): Promise<{ ok: true; revokedAt: string } | { ok: false }> {
  const db = getD1Database();
  const now = nowIso();
  await db.prepare("update entry_invites set revoked_at = ? where id = ? and entry_id = ? and revoked_at is null").bind(now, inviteId, entryId).run();
  const row = await db.prepare("select * from entry_invites where id = ? and entry_id = ?").bind(inviteId, entryId).first<InviteRow>();
  if (!row) return { ok: false };
  return { ok: true, revokedAt: toIsoUtc(row.revoked_at) || now };
}

export type InviteResolution =
  | { status: "valid"; invite: EntryInvite; entry: EventEntry; event: LiveEvent }
  | { status: "expired" | "revoked" | "cancelled"; invite: EntryInvite; entry: EventEntry; event: LiveEvent }
  | { status: "not_found" };

/** 招待トークンを検証する。GETで呼んでも状態は変えない */
export async function resolveInvite(token: string, now = Date.now()): Promise<InviteResolution> {
  if (!/^[A-Za-z0-9_-]{20,200}$/.test(token)) return { status: "not_found" };
  const row = await getD1Database().prepare("select * from entry_invites where token_hash = ?").bind(await sha256Hex(token)).first<InviteRow>();
  if (!row) return { status: "not_found" };
  const invite = inviteFromRow(row);
  const entry = await getEntry(invite.entryId);
  const event = entry ? await getLiveEvent(entry.liveEventId) : null;
  if (!entry || !event) return { status: "not_found" };
  if (invite.revokedAt) return { status: "revoked", invite, entry, event };
  if (entry.cancelledAt) return { status: "cancelled", invite, entry, event };
  if (Date.parse(invite.expiresAt) <= now) return { status: "expired", invite, entry, event };
  return { status: "valid", invite, entry, event };
}

/* -------------------------------------------------------------------------- */
/* 取り込み通知                                                                 */
/* -------------------------------------------------------------------------- */

export async function upsertImportReceipt(entryId: string, runtimeId: string, importedRevision: number, importedAt: string) {
  const receivedAt = nowIso();
  const result = await getD1Database()
    .prepare(
      `insert into import_receipts (entry_id, runtime_id, imported_revision, imported_at, received_at) values (?, ?, ?, ?, ?)
       on conflict (entry_id, runtime_id) do update set imported_revision = excluded.imported_revision, imported_at = excluded.imported_at, received_at = excluded.received_at`,
    )
    .bind(entryId, runtimeId, importedRevision, new Date(importedAt).toISOString(), receivedAt)
    .run();
  assertD1Result(result, "Failed to save import receipt");
  return { entryId, runtimeId, importedRevision, importedAt: new Date(importedAt).toISOString(), receivedAt };
}
