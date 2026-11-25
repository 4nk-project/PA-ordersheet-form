import { getD1Database, assertD1Result } from "@/lib/d1/server";
import { DEFAULT_SONG_COUNT } from "@/lib/orderSchema";
import { randomId } from "@/lib/crypto";
import { nowIso, toIsoUtc } from "@/lib/time";
import type { LiveEvent } from "@/types/order";

type LiveEventRow = {
  created_at: string;
  event_date: string | null;
  id: string;
  invite_required: number | null;
  name: string;
  revision: number | null;
  song_count: number | null;
  submission_deadline_at: string | null;
  submissions_open: number | null;
  time_zone: string | null;
  updated_at: string | null;
};

export function liveEventFromRow(row: LiveEventRow): LiveEvent {
  const createdAt = toIsoUtc(row.created_at) || row.created_at;
  return {
    id: row.id,
    name: row.name,
    songCount: Math.min(30, Math.max(1, Number(row.song_count || DEFAULT_SONG_COUNT))),
    createdAt,
    eventDate: row.event_date || null,
    timeZone: row.time_zone || "Asia/Tokyo",
    submissionDeadlineAt: toIsoUtc(row.submission_deadline_at),
    submissionsOpen: row.submissions_open === null ? true : Boolean(row.submissions_open),
    inviteRequired: Boolean(row.invite_required),
    revision: Math.max(1, Number(row.revision || 1)),
    updatedAt: toIsoUtc(row.updated_at) || createdAt,
  };
}

export type SubmissionWindow = { open: true } | { open: false; reason: "closed" | "deadline"; message: string };

/** 演者による提出・更新ができるか（サーバー側で判定する） */
export function submissionWindow(event: Pick<LiveEvent, "submissionsOpen" | "submissionDeadlineAt">, now = Date.now()): SubmissionWindow {
  if (!event.submissionsOpen) return { open: false, reason: "closed", message: "このライブの受付は停止中です。運営に連絡してください。" };
  if (event.submissionDeadlineAt && Date.parse(event.submissionDeadlineAt) <= now) {
    return { open: false, reason: "deadline", message: "提出締切を過ぎたため、内容の更新はできません。変更が必要な場合は運営に連絡してください。" };
  }
  return { open: true };
}

export async function listLiveEvents() {
  const db = getD1Database();
  const result = await db.prepare("select * from live_events order by created_at asc").all<LiveEventRow>();
  assertD1Result(result, "Failed to fetch live events");

  return (result.results || []).map(liveEventFromRow);
}

export async function getLiveEvent(id: string) {
  if (!id) return null;

  const db = getD1Database();
  const row = await db.prepare("select * from live_events where id = ?").bind(id).first<LiveEventRow>();

  return row ? liveEventFromRow(row) : null;
}

export type LiveEventInput = {
  name: string;
  songCount: number;
  eventDate: string | null;
  timeZone: string;
  submissionDeadlineAt: string | null;
  submissionsOpen: boolean;
  inviteRequired: boolean;
};

export async function createLiveEvent(input: LiveEventInput, id = randomId("live")) {
  const name = input.name.trim();
  if (!name) return null;

  const db = getD1Database();
  const now = nowIso();
  const result = await db
    .prepare(
      "insert into live_events (id, name, song_count, created_at, event_date, time_zone, submission_deadline_at, submissions_open, invite_required, revision, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)",
    )
    .bind(
      id,
      name,
      Math.min(30, Math.max(1, input.songCount || DEFAULT_SONG_COUNT)),
      now,
      input.eventDate,
      input.timeZone,
      input.submissionDeadlineAt,
      input.submissionsOpen ? 1 : 0,
      input.inviteRequired ? 1 : 0,
      now,
    )
    .run();
  assertD1Result(result, "Failed to create live event");

  return getLiveEvent(id);
}

export type LiveEventPatch = Partial<LiveEventInput>;

const patchColumns: Record<keyof LiveEventPatch, string> = {
  name: "name",
  songCount: "song_count",
  eventDate: "event_date",
  timeZone: "time_zone",
  submissionDeadlineAt: "submission_deadline_at",
  submissionsOpen: "submissions_open",
  inviteRequired: "invite_required",
};

/** 楽観ロック付きのライブ設定変更。版が一致しなければ "conflict" */
export async function patchLiveEvent(id: string, expectedRevision: number, patch: LiveEventPatch): Promise<LiveEvent | "conflict" | null> {
  const db = getD1Database();
  const sets: string[] = [];
  const values: unknown[] = [];
  for (const [key, column] of Object.entries(patchColumns) as [keyof LiveEventPatch, string][]) {
    if (patch[key] === undefined) continue;
    const value = patch[key];
    sets.push(`${column} = ?`);
    values.push(typeof value === "boolean" ? (value ? 1 : 0) : key === "songCount" ? Math.min(30, Math.max(1, Number(value))) : value);
  }
  const result = await db
    .prepare(`update live_events set ${[...sets, "revision = revision + 1", "updated_at = ?"].join(", ")} where id = ? and revision = ?`)
    .bind(...values, nowIso(), id, expectedRevision)
    .run();
  assertD1Result(result, "Failed to update live event");
  if (!result.meta?.changes) {
    const current = await getLiveEvent(id);
    return current ? "conflict" : null;
  }
  return getLiveEvent(id);
}

export async function deleteLiveEvent(id: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const db = getD1Database();
  const counts = await db
    .prepare(
      "select (select count(*) from live_events) as events, (select count(*) from event_entries where live_event_id = ?) as entries, (select count(*) from orders where live_event_id = ?) as orders",
    )
    .bind(id, id)
    .first<{ events: number; entries: number; orders: number }>();

  if ((counts?.events || 0) <= 1) return { ok: false, message: "最後のライブは削除できません。" };
  if ((counts?.entries || 0) > 0 || (counts?.orders || 0) > 0) return { ok: false, message: "出演エントリーまたは提出があるライブは削除できません。" };

  const result = await db.prepare("delete from live_events where id = ?").bind(id).run();
  assertD1Result(result, "Failed to delete live event");

  return { ok: true };
}
