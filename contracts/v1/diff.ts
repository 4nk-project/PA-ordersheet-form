/**
 * 提出内容の差分（共通契約 v1）
 * 安定したIDで項目を突き合わせ、追加・変更・削除・並び替えを項目単位で返す。
 * 色だけに頼らず表示できるよう、変更前後の値を文字列で持たせる。
 */
import type { OrderContent, OrderEquipment, OrderMember, OrderSong } from "./index";

export type FieldChange = { field: string; label: string; before: string; after: string };
export type ItemChange = {
  kind: "added" | "removed" | "changed";
  id: string;
  /** 一覧表示用の名前（曲名・メンバー名など） */
  label: string;
  /** 変更前の位置（1始まり）。追加は null */
  beforePosition: number | null;
  /** 変更後の位置（1始まり）。削除は null */
  afterPosition: number | null;
  changes: FieldChange[];
};
export type OrderDiff = {
  fields: FieldChange[];
  members: ItemChange[];
  equipment: ItemChange[];
  songs: ItemChange[];
  hasChanges: boolean;
};

export function formatDurationSeconds(seconds: number | null) {
  if (seconds === null) return "未入力";
  return `${Math.floor(seconds / 60)}分${String(seconds % 60).padStart(2, "0")}秒`;
}

function text(value: string) {
  return value.trim() ? value : "（空欄）";
}

function yesNo(value: boolean) {
  return value ? "あり" : "なし";
}

function compareField(changes: FieldChange[], field: string, label: string, before: string, after: string) {
  if (before !== after) changes.push({ field, label, before, after });
}

function memberName(members: OrderMember[], id: string | null) {
  if (!id) return "（指定なし）";
  return members.find((member) => member.id === id)?.name || "（削除されたメンバー）";
}

function diffItems<T extends { id: string }>(
  before: T[],
  after: T[],
  label: (item: T) => string,
  fields: (beforeItem: T, afterItem: T) => FieldChange[],
): ItemChange[] {
  const result: ItemChange[] = [];
  const beforeIndex = new Map(before.map((item, index) => [item.id, index]));
  const afterIndex = new Map(after.map((item, index) => [item.id, index]));
  after.forEach((item, index) => {
    const previousIndex = beforeIndex.get(item.id);
    if (previousIndex === undefined) {
      result.push({ kind: "added", id: item.id, label: label(item), beforePosition: null, afterPosition: index + 1, changes: [] });
      return;
    }
    const changes = fields(before[previousIndex], item);
    if (previousIndex !== index) changes.unshift({ field: "position", label: "順番", before: `${previousIndex + 1}番目`, after: `${index + 1}番目` });
    if (changes.length) result.push({ kind: "changed", id: item.id, label: label(item), beforePosition: previousIndex + 1, afterPosition: index + 1, changes });
  });
  before.forEach((item, index) => {
    if (!afterIndex.has(item.id)) result.push({ kind: "removed", id: item.id, label: label(item), beforePosition: index + 1, afterPosition: null, changes: [] });
  });
  return result;
}

export function diffOrderContent(before: OrderContent, after: OrderContent): OrderDiff {
  const fields: FieldChange[] = [];
  compareField(fields, "bandName", "バンド名", text(before.bandName), text(after.bandName));
  compareField(fields, "contactName", "代表者", text(before.contactName), text(after.contactName));
  compareField(fields, "microphoneCount", "マイク本数", `${before.microphoneCount}本`, `${after.microphoneCount}本`);
  compareField(fields, "usesBackingTrack", "音源使用", yesNo(before.usesBackingTrack), yesNo(after.usesBackingTrack));
  compareField(fields, "backingTrack.operator", "音源の再生担当", text(before.backingTrack?.operator || ""), text(after.backingTrack?.operator || ""));
  compareField(fields, "backingTrack.device", "音源の再生端末", text(before.backingTrack?.device || ""), text(after.backingTrack?.device || ""));
  compareField(fields, "backingTrack.connection", "音源の接続方法", text(before.backingTrack?.connection || ""), text(after.backingTrack?.connection || ""));
  compareField(fields, "generalRequest", "全体要望", text(before.generalRequest), text(after.generalRequest));

  const members = diffItems<OrderMember>(before.members, after.members, (item) => item.name || "名前未入力", (b, a) => {
    const changes: FieldChange[] = [];
    compareField(changes, "name", "名前", text(b.name), text(a.name));
    compareField(changes, "instrument", "担当楽器", text(b.instrument), text(a.instrument));
    return changes;
  });
  const equipment = diffItems<OrderEquipment>(before.equipment, after.equipment, (item) => item.name || "機材名未入力", (b, a) => {
    const changes: FieldChange[] = [];
    compareField(changes, "name", "機材名", text(b.name), text(a.name));
    compareField(changes, "instrument", "担当楽器・用途", text(b.instrument), text(a.instrument));
    compareField(changes, "memberId", "使用者", memberName(before.members, b.memberId), memberName(after.members, a.memberId));
    return changes;
  });
  const songs = diffItems<OrderSong>(before.songs, after.songs, (item) => item.title || "曲名未入力", (b, a) => {
    const changes: FieldChange[] = [];
    compareField(changes, "title", "曲名", text(b.title), text(a.title));
    compareField(changes, "durationSeconds", "演奏時間", formatDurationSeconds(b.durationSeconds), formatDurationSeconds(a.durationSeconds));
    compareField(changes, "mood", "曲調", text(b.mood), text(a.mood));
    compareField(changes, "startTrigger", "始まり方", text(b.startTrigger), text(a.startTrigger));
    compareField(changes, "mc", "MC", b.mc.hasMc ? `あり（${b.mc.person || "担当未入力"}）` : "なし", a.mc.hasMc ? `あり（${a.mc.person || "担当未入力"}）` : "なし");
    compareField(changes, "paRequest", "PA要望", text(b.paRequest), text(a.paRequest));
    return changes;
  });

  return { fields, members, equipment, songs, hasChanges: Boolean(fields.length || members.length || equipment.length || songs.length) };
}

/** DTOなどから提出内容の範囲だけを取り出す */
export function pickOrderContent(source: OrderContent): OrderContent {
  return {
    bandName: source.bandName,
    contactName: source.contactName,
    microphoneCount: source.microphoneCount,
    usesBackingTrack: source.usesBackingTrack,
    backingTrack: source.backingTrack ? { operator: source.backingTrack.operator, device: source.backingTrack.device, connection: source.backingTrack.connection } : null,
    members: source.members.map((member) => ({ id: member.id, name: member.name, instrument: member.instrument })),
    equipment: source.equipment.map((item) => ({ id: item.id, name: item.name, instrument: item.instrument, memberId: item.memberId })),
    songs: source.songs.map((song) => ({
      id: song.id,
      order: song.order,
      title: song.title,
      durationSeconds: song.durationSeconds,
      mood: song.mood,
      startTrigger: song.startTrigger,
      paRequest: song.paRequest,
      mc: { hasMc: song.mc.hasMc, person: song.mc.person },
    })),
    generalRequest: source.generalRequest,
  };
}

export function totalSongSeconds(songs: Pick<OrderSong, "durationSeconds">[]) {
  return songs.reduce((total, song) => total + (song.durationSeconds ?? 0), 0);
}
