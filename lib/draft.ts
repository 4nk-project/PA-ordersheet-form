export const ORDER_DRAFT_KEY = "pa-order-sheet-draft-v2";
export const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

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
