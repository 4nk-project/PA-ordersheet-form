import type { Equipment, Member, PAOrder, Song } from "@/types/order";

export const DEFAULT_MEMBER_COUNT = 2;
export const DEFAULT_SONG_COUNT = 8;
export const DEFAULT_EQUIPMENT_COUNT = 0;
export const MAX_MEMBER_COUNT = 20;
export const MAX_SONG_COUNT = 30;
export const MAX_EQUIPMENT_COUNT = 20;

const LIMITS = {
  bandName: 120,
  contactName: 80,
  memberName: 80,
  instrument: 80,
  songTitle: 160,
  duration: 16,
  mood: 80,
  startTrigger: 120,
  paRequest: 1000,
  generalRequest: 2000,
} as const;

export type OrderFieldErrors = Record<string, string>;

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

export function makeEmptySongs(count = 1): Song[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `song-${index + 1}`,
    order: index + 1,
    title: "",
    duration: "",
    mood: "",
    startTrigger: "",
    paRequest: "",
    mc: { hasMc: false, person: "" },
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
    .map((member) => ({ ...member, name: member.name.trim(), instrument: member.instrument.trim() }))
    .filter((member) => member.name || member.instrument);
}

export function compactSongs(songs: Song[]): Song[] {
  return songs
    .map((song) => ({
      ...song,
      title: song.title.trim(),
      duration: song.duration.trim(),
      mood: song.mood.trim(),
      startTrigger: song.startTrigger.trim(),
      paRequest: song.paRequest.trim(),
      mc: { hasMc: song.mc.hasMc, person: song.mc.person.trim() },
    }))
    .filter((song) => song.title || song.duration || song.mood || song.startTrigger || song.paRequest || song.mc.hasMc)
    .map((song, index) => ({ ...song, order: index + 1 }));
}

export function compactEquipment(equipment: Equipment[]): Equipment[] {
  return equipment
    .map((item) => ({ ...item, name: item.name.trim(), instrument: item.instrument.trim() }))
    .filter((item) => item.name || item.instrument);
}

function text(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

function bool(formData: FormData, key: string) {
  return formData.get(key) === "on" || formData.get(key) === "true";
}

function requestedCount(formData: FormData, key: string, fallback: number, maximum: number) {
  const parsed = Number(formData.get(key));
  if (!Number.isInteger(parsed) || parsed < 0) return fallback;
  return Math.min(parsed, maximum + 1);
}

export function orderFromFormData(formData: FormData, liveSongLimit = DEFAULT_SONG_COUNT): PAOrder {
  const now = new Date().toISOString();
  const memberCount = requestedCount(formData, "member_count", DEFAULT_MEMBER_COUNT, MAX_MEMBER_COUNT);
  const equipmentCount = requestedCount(formData, "equipment_count", 0, MAX_EQUIPMENT_COUNT);
  const songCount = requestedCount(formData, "song_count", 1, MAX_SONG_COUNT);
  const members = compactMembers(
    makeEmptyMembers(memberCount).map((member, index) => ({
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
    makeEmptyEquipment(equipmentCount).map((item, index) => ({
      ...item,
      name: text(formData, `equipment_${index}_name`),
      instrument: text(formData, `equipment_${index}_instrument`),
    })),
  );

  return {
    id: makeId(), editToken: makeEditToken(), liveEventId: text(formData, "live_event_id"),
    liveEventName: text(formData, "live_event_name"), liveEventSongCount: liveSongLimit,
    performanceOrder: null, bandName: text(formData, "band_name"), contactName: text(formData, "contact_name"),
    microphoneCount: Number(text(formData, "microphone_count") || 0), usesBackingTrack: bool(formData, "uses_backing_track"),
    members, songs, equipment, generalRequest: text(formData, "general_request"), status: "new", createdAt: now, updatedAt: now,
  };
}

function addLengthError(errors: OrderFieldErrors, key: string, value: string, max: number, label: string) {
  if (value.length > max) errors[key] = `${label}は${max}文字以内で入力してください。`;
}

export function validateOrderFields(order: PAOrder): OrderFieldErrors {
  const errors: OrderFieldErrors = {};
  if (!order.liveEventId) errors.live_event_id = "ライブを選択してください。";
  if (!order.bandName) errors.band_name = "バンド名を入力してください。";
  if (!order.contactName) errors.contact_name = "代表者名を入力してください。";
  if (!order.songs[0]?.title) errors.song_0_title = "1曲目の曲名を入力してください。";
  if (!Number.isInteger(order.microphoneCount) || order.microphoneCount < 0) errors.microphone_count = "マイク本数は0以上の整数で入力してください。";
  if (order.members.length > MAX_MEMBER_COUNT) errors.member_count = `メンバーは${MAX_MEMBER_COUNT}人までです。`;
  if (order.equipment.length > MAX_EQUIPMENT_COUNT) errors.equipment_count = `持ち込み機材は${MAX_EQUIPMENT_COUNT}件までです。`;
  if (order.songs.length > MAX_SONG_COUNT || order.songs.length > order.liveEventSongCount) errors.song_count = `曲数はこのライブの上限（${order.liveEventSongCount}曲）以内にしてください。`;

  addLengthError(errors, "band_name", order.bandName, LIMITS.bandName, "バンド名");
  addLengthError(errors, "contact_name", order.contactName, LIMITS.contactName, "代表者名");
  addLengthError(errors, "general_request", order.generalRequest, LIMITS.generalRequest, "全体要望");
  order.members.forEach((member, index) => {
    addLengthError(errors, `member_${index}_name`, member.name, LIMITS.memberName, "メンバー名");
    addLengthError(errors, `member_${index}_instrument`, member.instrument, LIMITS.instrument, "担当楽器");
  });
  order.equipment.forEach((item, index) => {
    addLengthError(errors, `equipment_${index}_name`, item.name, LIMITS.songTitle, "機材名");
    addLengthError(errors, `equipment_${index}_instrument`, item.instrument, LIMITS.instrument, "使用者・担当楽器");
  });
  order.songs.forEach((song, index) => {
    addLengthError(errors, `song_${index}_title`, song.title, LIMITS.songTitle, "曲名");
    addLengthError(errors, `song_${index}_duration`, song.duration, LIMITS.duration, "演奏時間");
    addLengthError(errors, `song_${index}_mood`, song.mood, LIMITS.mood, "曲調");
    addLengthError(errors, `song_${index}_start_trigger`, song.startTrigger, LIMITS.startTrigger, "始まりのきっかけ");
    addLengthError(errors, `song_${index}_mc_person`, song.mc.person, LIMITS.memberName, "MC担当");
    addLengthError(errors, `song_${index}_pa_request`, song.paRequest, LIMITS.paRequest, "PAへの要望");
  });
  return errors;
}

export function validateOrder(order: PAOrder) { return Object.values(validateOrderFields(order)); }

export function parseDurationSeconds(value: string) {
  const match = value.trim().match(/^(\d{1,3}):(\d{2})$/);
  if (!match) return 0;
  const minutes = Number(match[1]);
  const seconds = Number(match[2]);
  return seconds < 60 ? minutes * 60 + seconds : 0;
}

export function totalDurationSeconds(songs: Pick<Song, "duration">[]) {
  return songs.reduce((total, song) => total + parseDurationSeconds(song.duration), 0);
}

export function formatDuration(totalSeconds: number) {
  return `${Math.floor(totalSeconds / 60)}:${(totalSeconds % 60).toString().padStart(2, "0")}`;
}
