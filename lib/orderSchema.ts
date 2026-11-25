import type { BackingTrack, OrderContent } from "@/contracts/v1";
import type { Equipment, Member, Song } from "@/types/order";

export const DEFAULT_MEMBER_COUNT = 2;
export const DEFAULT_SONG_COUNT = 8;
export const DEFAULT_EQUIPMENT_COUNT = 0;
export const MAX_MEMBER_COUNT = 20;
export const MAX_SONG_COUNT = 30;
export const MAX_EQUIPMENT_COUNT = 20;
export const MAX_DURATION_MINUTES = 59;

export const LIMITS = {
  bandName: 120,
  contactName: 80,
  memberName: 80,
  instrument: 80,
  equipmentName: 160,
  songTitle: 160,
  mood: 80,
  startTrigger: 120,
  paRequest: 1000,
  generalRequest: 2000,
  backingTrackOperator: 80,
  backingTrackDevice: 120,
  backingTrackConnection: 120,
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

export function emptyBackingTrack(): BackingTrack {
  return { operator: "", device: "", connection: "" };
}

export function makeEmptyMember(): Member {
  return { id: makeId("member"), name: "", instrument: "" };
}

export function makeEmptyMembers(count = DEFAULT_MEMBER_COUNT): Member[] {
  return Array.from({ length: count }, makeEmptyMember);
}

export function makeEmptySong(order = 1): Song {
  return { id: makeId("song"), order, title: "", durationSeconds: null, duration: "", mood: "", startTrigger: "", paRequest: "", mc: { hasMc: false, person: "" } };
}

export function makeEmptySongs(count = 1): Song[] {
  return Array.from({ length: count }, (_, index) => makeEmptySong(index + 1));
}

export function makeEmptyEquipmentItem(): Equipment {
  return { id: makeId("equipment"), name: "", instrument: "", memberId: null };
}

export function makeEmptyEquipment(count = DEFAULT_EQUIPMENT_COUNT): Equipment[] {
  return Array.from({ length: count }, makeEmptyEquipmentItem);
}

export function isMemberFilled(member: Pick<Member, "name" | "instrument">) {
  return Boolean(member.name.trim() || member.instrument.trim());
}

export function isEquipmentFilled(item: Pick<Equipment, "name" | "instrument">) {
  return Boolean(item.name.trim() || item.instrument.trim());
}

export function isSongFilled(song: Pick<Song, "title" | "durationSeconds" | "mood" | "startTrigger" | "paRequest" | "mc">) {
  return Boolean(song.title.trim() || song.durationSeconds !== null || song.mood.trim() || song.startTrigger.trim() || song.paRequest.trim() || song.mc.hasMc || song.mc.person.trim());
}

/** 「分」「秒」の入力を秒へ。両方空欄は null、範囲外・非整数は "invalid" */
export function durationFromParts(minutesText: string, secondsText: string): number | null | "invalid" {
  const minutes = minutesText.trim();
  const seconds = secondsText.trim();
  if (!minutes && !seconds) return null;
  const minuteValue = minutes ? Number(minutes) : 0;
  const secondValue = seconds ? Number(seconds) : 0;
  if (!Number.isInteger(minuteValue) || !Number.isInteger(secondValue)) return "invalid";
  if (minuteValue < 0 || minuteValue > MAX_DURATION_MINUTES || secondValue < 0 || secondValue > 59) return "invalid";
  const total = minuteValue * 60 + secondValue;
  return total > 0 ? total : "invalid";
}

/** 旧形式 "m:ss" を秒へ。解釈できなければ null（0秒にしない） */
export function parseLegacyDuration(value: string | null | undefined): number | null {
  const match = (value || "").trim().match(/^(\d{1,3}):([0-5]\d)$/);
  if (!match) return null;
  const total = Number(match[1]) * 60 + Number(match[2]);
  return total > 0 ? total : null;
}

export function formatDuration(totalSeconds: number) {
  return `${Math.floor(totalSeconds / 60)}:${(totalSeconds % 60).toString().padStart(2, "0")}`;
}

/** 表示用（例: 4分30秒）。未入力は null */
export function formatDurationJa(totalSeconds: number | null) {
  if (totalSeconds === null) return null;
  return `${Math.floor(totalSeconds / 60)}分${String(totalSeconds % 60).padStart(2, "0")}秒`;
}

export function totalDurationSeconds(songs: Pick<Song, "durationSeconds">[]) {
  return songs.reduce((total, song) => total + (song.durationSeconds ?? 0), 0);
}

/* -------------------------------------------------------------------------- */
/* フォーム解析                                                                */
/* -------------------------------------------------------------------------- */

export type OrderFormInput = {
  liveEventId: string;
  content: OrderContent;
  submissionId: string;
  expectedRevision: number | null;
};

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function bool(formData: FormData, key: string) {
  return formData.get(key) === "on" || formData.get(key) === "true";
}

function requestedCount(formData: FormData, key: string, fallback: number, maximum: number) {
  const parsed = Number(formData.get(key));
  if (!Number.isInteger(parsed) || parsed < 0) return fallback;
  return Math.min(parsed, maximum + 1);
}

function clientId(formData: FormData, key: string, prefix: string) {
  const value = text(formData, key);
  return /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(value) ? value : makeId(prefix);
}

function addLengthError(errors: OrderFieldErrors, key: string, value: string, max: number, label: string) {
  if (value.length > max) errors[key] = `${label}は${max}文字以内で入力してください。`;
}

/**
 * フォームの内容を解析し、入力済みの行だけを残した提出内容と、元の行番号に対応したエラーを返す。
 * songLimit はサーバーが把握するライブの最大曲数。
 */
export function parseOrderForm(formData: FormData, options: { songLimit: number; bandName?: string }) {
  const errors: OrderFieldErrors = {};
  const memberCount = requestedCount(formData, "member_count", DEFAULT_MEMBER_COUNT, MAX_MEMBER_COUNT);
  const equipmentCount = requestedCount(formData, "equipment_count", 0, MAX_EQUIPMENT_COUNT);
  const songCount = requestedCount(formData, "song_count", 1, MAX_SONG_COUNT);

  const members: OrderContent["members"] = [];
  for (let index = 0; index < memberCount; index += 1) {
    const member = { id: clientId(formData, `member_${index}_id`, "member"), name: text(formData, `member_${index}_name`), instrument: text(formData, `member_${index}_instrument`) };
    addLengthError(errors, `member_${index}_name`, member.name, LIMITS.memberName, "メンバー名");
    addLengthError(errors, `member_${index}_instrument`, member.instrument, LIMITS.instrument, "担当楽器");
    if (isMemberFilled(member)) members.push(member);
  }
  const memberIds = new Set(members.map((member) => member.id));

  const equipment: OrderContent["equipment"] = [];
  for (let index = 0; index < equipmentCount; index += 1) {
    const memberId = text(formData, `equipment_${index}_member_id`);
    const item = {
      id: clientId(formData, `equipment_${index}_id`, "equipment"),
      name: text(formData, `equipment_${index}_name`),
      instrument: text(formData, `equipment_${index}_instrument`),
      memberId: memberIds.has(memberId) ? memberId : null,
    };
    addLengthError(errors, `equipment_${index}_name`, item.name, LIMITS.equipmentName, "機材名");
    addLengthError(errors, `equipment_${index}_instrument`, item.instrument, LIMITS.instrument, "担当楽器・用途");
    if (isEquipmentFilled(item)) {
      if (!item.name) errors[`equipment_${index}_name`] = "機材名を入力してください。";
      equipment.push(item);
    }
  }

  const songs: OrderContent["songs"] = [];
  for (let index = 0; index < songCount; index += 1) {
    const duration = durationFromParts(text(formData, `song_${index}_duration_min`), text(formData, `song_${index}_duration_sec`));
    const song = {
      id: clientId(formData, `song_${index}_id`, "song"),
      order: songs.length + 1,
      title: text(formData, `song_${index}_title`),
      durationSeconds: duration === "invalid" ? null : duration,
      mood: text(formData, `song_${index}_mood`),
      startTrigger: text(formData, `song_${index}_start_trigger`),
      paRequest: text(formData, `song_${index}_pa_request`),
      mc: { hasMc: bool(formData, `song_${index}_has_mc`), person: text(formData, `song_${index}_mc_person`) },
    };
    if (!song.mc.hasMc) song.mc.person = "";
    addLengthError(errors, `song_${index}_title`, song.title, LIMITS.songTitle, "曲名");
    addLengthError(errors, `song_${index}_mood`, song.mood, LIMITS.mood, "曲調");
    addLengthError(errors, `song_${index}_start_trigger`, song.startTrigger, LIMITS.startTrigger, "始まり方");
    addLengthError(errors, `song_${index}_mc_person`, song.mc.person, LIMITS.memberName, "MC担当");
    addLengthError(errors, `song_${index}_pa_request`, song.paRequest, LIMITS.paRequest, "PAへの要望");
    const filled = isSongFilled(song) || duration === "invalid";
    if (!filled) continue;
    if (!song.title) errors[`song_${index}_title`] = `${index + 1}曲目の曲名を入力してください。`;
    if (duration === "invalid") errors[`song_${index}_duration_min`] = `${index + 1}曲目の演奏時間は0〜59分、0〜59秒の範囲で入力してください。`;
    else if (duration === null) errors[`song_${index}_duration_min`] = `${index + 1}曲目の演奏時間（分・秒）を入力してください。`;
    songs.push(song);
  }

  const usesBackingTrack = bool(formData, "uses_backing_track");
  const backingTrack = usesBackingTrack
    ? { operator: text(formData, "backing_track_operator"), device: text(formData, "backing_track_device"), connection: text(formData, "backing_track_connection") }
    : null;
  const microphoneText = text(formData, "microphone_count");
  const microphoneCount = microphoneText === "" ? 0 : Number(microphoneText);

  const content: OrderContent = {
    bandName: options.bandName ?? text(formData, "band_name"),
    contactName: text(formData, "contact_name"),
    microphoneCount: Number.isFinite(microphoneCount) ? microphoneCount : -1,
    usesBackingTrack,
    backingTrack,
    members,
    equipment,
    songs,
    generalRequest: text(formData, "general_request"),
  };

  if (!content.bandName) errors.band_name = "バンド名を入力してください。";
  if (!content.contactName) errors.contact_name = "代表者名を入力してください。";
  if (!Number.isInteger(content.microphoneCount) || content.microphoneCount < 0 || content.microphoneCount > 99) errors.microphone_count = "マイク本数は0〜99の整数で入力してください。";
  if (songs.length === 0 && !errors.song_0_title) errors.song_0_title = "少なくとも1曲の曲名と演奏時間を入力してください。";
  if (Number(formData.get("member_count")) > MAX_MEMBER_COUNT) errors.member_count = `メンバーは${MAX_MEMBER_COUNT}人までです。`;
  if (Number(formData.get("equipment_count")) > MAX_EQUIPMENT_COUNT) errors.equipment_count = `持ち込み機材は${MAX_EQUIPMENT_COUNT}件までです。`;
  if (songs.length > MAX_SONG_COUNT || songs.length > options.songLimit) errors.song_count = `曲数はこのライブの上限（${options.songLimit}曲）以内にしてください。`;
  if (backingTrack) {
    if (!backingTrack.operator) errors.backing_track_operator = "音源の再生担当を入力してください。";
    if (!backingTrack.device) errors.backing_track_device = "再生に使う端末を入力してください。";
    if (!backingTrack.connection) errors.backing_track_connection = "接続方法を入力してください。";
    addLengthError(errors, "backing_track_operator", backingTrack.operator, LIMITS.backingTrackOperator, "再生担当");
    addLengthError(errors, "backing_track_device", backingTrack.device, LIMITS.backingTrackDevice, "再生端末");
    addLengthError(errors, "backing_track_connection", backingTrack.connection, LIMITS.backingTrackConnection, "接続方法");
  }
  addLengthError(errors, "band_name", content.bandName, LIMITS.bandName, "バンド名");
  addLengthError(errors, "contact_name", content.contactName, LIMITS.contactName, "代表者名");
  addLengthError(errors, "general_request", content.generalRequest, LIMITS.generalRequest, "全体要望");

  const expectedText = text(formData, "expected_revision");
  const expectedRevision = expectedText && Number.isInteger(Number(expectedText)) ? Number(expectedText) : null;
  const submissionId = text(formData, "submission_id");

  const input: OrderFormInput = {
    liveEventId: text(formData, "live_event_id"),
    content,
    submissionId: /^[A-Za-z0-9_-]{8,128}$/.test(submissionId) ? submissionId : "",
    expectedRevision,
  };
  return { input, errors };
}
