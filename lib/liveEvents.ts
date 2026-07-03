import { getD1Database, assertD1Result } from "@/lib/d1/server";
import { DEFAULT_SONG_COUNT, makeId } from "@/lib/orderSchema";
import type { LiveEvent } from "@/types/order";

type LiveEventRow = {
  created_at: string;
  id: string;
  name: string;
  song_count: number | null;
};

function fromRow(row: LiveEventRow): LiveEvent {
  return {
    id: row.id,
    name: row.name,
    songCount: Math.max(1, Number(row.song_count || DEFAULT_SONG_COUNT)),
    createdAt: row.created_at,
  };
}

export async function listLiveEvents() {
  const db = getD1Database();
  const result = await db.prepare("select * from live_events order by created_at asc").all<LiveEventRow>();
  assertD1Result(result, "Failed to fetch live events");

  return (result.results || []).map(fromRow);
}

export async function getLiveEvent(id: string) {
  if (!id) return null;

  const db = getD1Database();
  const row = await db.prepare("select * from live_events where id = ?").bind(id).first<LiveEventRow>();

  return row ? fromRow(row) : null;
}

export async function createLiveEvent(name: string, songCount: number) {
  const trimmedName = name.trim();
  if (!trimmedName) return null;

  const db = getD1Database();
  const event = {
    id: makeId("live"),
    name: trimmedName,
    songCount: Math.max(1, songCount || DEFAULT_SONG_COUNT),
    createdAt: new Date().toISOString(),
  };

  const result = await db
    .prepare("insert into live_events (id, name, song_count, created_at) values (?, ?, ?, ?)")
    .bind(event.id, event.name, event.songCount, event.createdAt)
    .run();
  assertD1Result(result, "Failed to create live event");

  return event;
}

export async function updateLiveEventSongCount(id: string, songCount: number) {
  const db = getD1Database();
  const result = await db
    .prepare("update live_events set song_count = ? where id = ?")
    .bind(Math.max(1, songCount || DEFAULT_SONG_COUNT), id)
    .run();
  assertD1Result(result, "Failed to update live event");
}

export async function deleteLiveEvent(id: string) {
  const db = getD1Database();
  const countRow = await db.prepare("select count(*) as count from live_events").first<{ count: number }>();

  if ((countRow?.count || 0) <= 1) return false;

  const result = await db.prepare("delete from live_events where id = ?").bind(id).run();
  assertD1Result(result, "Failed to delete live event");

  return true;
}
