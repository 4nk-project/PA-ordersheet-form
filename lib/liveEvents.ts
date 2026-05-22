import { DEFAULT_SONG_COUNT } from "@/lib/orderSchema";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import type { LiveEvent } from "@/types/order";

type LiveEventRow = {
  id: string;
  name: string;
  song_count: number | null;
  created_at: string;
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
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.from("live_events").select("*").order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch live events: ${error.message}`);
  }

  return (data as LiveEventRow[]).map(fromRow);
}

export async function getLiveEvent(id: string) {
  if (!id) return null;

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.from("live_events").select("*").eq("id", id).maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch live event: ${error.message}`);
  }

  return data ? fromRow(data as LiveEventRow) : null;
}

export async function createLiveEvent(name: string, songCount: number) {
  const trimmedName = name.trim();
  if (!trimmedName) return null;

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("live_events")
    .insert({
      name: trimmedName,
      song_count: Math.max(1, songCount || DEFAULT_SONG_COUNT),
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to create live event: ${error.message}`);
  }

  return fromRow(data as LiveEventRow);
}

export async function updateLiveEventSongCount(id: string, songCount: number) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("live_events")
    .update({ song_count: Math.max(1, songCount || DEFAULT_SONG_COUNT) })
    .eq("id", id);

  if (error) {
    throw new Error(`Failed to update live event: ${error.message}`);
  }
}

export async function deleteLiveEvent(id: string) {
  const supabase = createSupabaseAdminClient();
  const { count, error: countError } = await supabase
    .from("live_events")
    .select("id", { count: "exact", head: true });

  if (countError) {
    throw new Error(`Failed to count live events: ${countError.message}`);
  }

  if ((count || 0) <= 1) return false;

  const { error } = await supabase.from("live_events").delete().eq("id", id);

  if (error) {
    throw new Error(`Failed to delete live event: ${error.message}`);
  }

  return true;
}
