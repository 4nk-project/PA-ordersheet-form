import type { Equipment, Member, PAOrder, Song } from "@/types/order";

export const DEFAULT_MEMBER_COUNT = 6;
export const DEFAULT_SONG_COUNT = 8;
export const DEFAULT_EQUIPMENT_COUNT = 8;

export function makeId(prefix = "ord") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function makeEditToken() {
  if (globalThis.crypto?.randomUUID) {
    return `edit_${globalThis.crypto.randomUUID().replaceAll("-", "")}`;
  }
  return `${makeId("edit")}_${Math.random().toString(36).slice(2, 14)}`;
}

export function makeEmptyMembers(count = DEFAULT_MEMBER_COUNT): Member[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `member-${index + 1}`,
    name: "",
    instrument: "",
  }));
}

export function makeEmptySongs(count = DEFAULT_SONG_COUNT): Song[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `song-${index + 1}`,
    order: index + 1,
    title: "",
    duration: "",
    mood: "",
    startTrigger: "",
    paRequest: "",
    mc: {
      hasMc: false,
      person: "",
    },
  }));
}

export function makeEmptyEquipment(count = DEFAULT_EQUIPMENT_COUNT): Equipment[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `equipment-${index + 1}`,
    name: "",
    instrument: "",
  }));
}

export function compactMembers(members: Member[]): Member[] {
  return members
    .map((member) => ({
      ...member,
      name: member.name.trim(),
      instrument: member.instrument.trim(),
    }))
    .filter((member) => member.name || member.instrument);
}

export function compactSongs(songs: Song[]): Song[] {
  return songs
    .map((song, index) => ({
      ...song,
      order: index + 1,
      title: song.title.trim(),
      duration: song.duration.trim(),
      mood: song.mood.trim(),
      startTrigger: song.startTrigger.trim(),
      paRequest: song.paRequest.trim(),
      mc: {
        hasMc: song.mc.hasMc,
        person: song.mc.person.trim(),
      },
    }))
    .filter((song) => song.title || song.duration || song.mood || song.startTrigger || song.paRequest || song.mc.hasMc);
}

export function compactEquipment(equipment: Equipment[]): Equipment[] {
  return equipment
    .map((item) => ({
      ...item,
      name: item.name.trim(),
      instrument: item.instrument.trim(),
    }))
    .filter((item) => item.name || item.instrument);
}

function text(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

function bool(formData: FormData, key: string) {
  return formData.get(key) === "on" || formData.get(key) === "true";
}

export function orderFromFormData(formData: FormData, songCount = DEFAULT_SONG_COUNT): PAOrder {
  const now = new Date().toISOString();
  const members = compactMembers(
    makeEmptyMembers().map((member, index) => ({
      ...member,
      name: text(formData, `member_${index}_name`),
      instrument: text(formData, `member_${index}_instrument`),
    })),
  );
  const songs = compactSongs(
    makeEmptySongs(songCount).map((song, index) => ({
      ...song,
      title: text(formData, `song_${index}_title`),
      duration: text(formData, `song_${index}_duration`),
      mood: text(formData, `song_${index}_mood`),
      startTrigger: text(formData, `song_${index}_start_trigger`),
      paRequest: text(formData, `song_${index}_pa_request`),
      mc: {
        hasMc: bool(formData, `song_${index}_has_mc`),
        person: text(formData, `song_${index}_mc_person`),
      },
    })),
  );
  const equipment = compactEquipment(
    makeEmptyEquipment().map((item, index) => ({
      ...item,
      name: text(formData, `equipment_${index}_name`),
      instrument: text(formData, `equipment_${index}_instrument`),
    })),
  );

  return {
    id: makeId(),
    editToken: makeEditToken(),
    liveEventId: text(formData, "live_event_id"),
    liveEventName: text(formData, "live_event_name"),
    liveEventSongCount: songCount,
    bandName: text(formData, "band_name"),
    contactName: text(formData, "contact_name"),
    microphoneCount: Number(text(formData, "microphone_count") || 0),
    usesBackingTrack: bool(formData, "uses_backing_track"),
    members,
    songs,
    equipment,
    generalRequest: text(formData, "general_request"),
    status: "new",
    createdAt: now,
    updatedAt: now,
  };
}

export function validateOrder(order: PAOrder) {
  const errors: string[] = [];
  if (!order.liveEventId) errors.push("ライブ内容を選択してください。");
  if (!order.bandName) errors.push("バンド名を入力してください。");
  if (!order.contactName) errors.push("代表者名を入力してください。");
  if (order.songs.length === 0) errors.push("少なくとも1曲入力してください。");
  return errors;
}
