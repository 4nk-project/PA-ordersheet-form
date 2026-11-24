/** 旧版（全バンド共通キー）の下書き。他バンドの内容を復元しないよう読み込まずに削除する */
export const LEGACY_DRAFT_KEYS = ["pa-order-sheet-draft-v2"];
export const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * 端末内下書きのキー。ライブ（eventId）と出演エントリー（entryId）ごとに分ける。
 * 招待トークンはキーに使わない。エントリーが決まっていない旧フォームの新規提出は "new"。
 */
export function draftKey(eventId: string | null, entryId: string | null) {
  return `pa-order-draft:v3:${eventId || "none"}:${entryId || "new"}`;
}

export type StoredDraft<T> = { savedAt: number; value: T };

export function isDraftFresh(savedAt: number, now = Date.now()) {
  return Number.isFinite(savedAt) && savedAt <= now && now - savedAt <= DRAFT_TTL_MS;
}

export function parseStoredDraft<T>(raw: string | null, now = Date.now()): StoredDraft<T> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredDraft<T>;
    return parsed && isDraftFresh(parsed.savedAt, now) && parsed.value ? parsed : null;
  } catch {
    return null;
  }
}

export function removeDraft(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    // ストレージが使えない環境では何もしない
  }
}
