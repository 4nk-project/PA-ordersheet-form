/** D1 の CURRENT_TIMESTAMP（"YYYY-MM-DD HH:MM:SS"、UTC）などを ISO 8601（UTC）へ正規化する */
export function toIsoUtc(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  const sqlite = trimmed.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2}(?:\.\d+)?)$/);
  const date = new Date(sqlite ? `${sqlite[1]}T${sqlite[2]}Z` : trimmed);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function nowIso() {
  return new Date().toISOString();
}

/** タイムゾーンのオフセット（分）。例: Asia/Tokyo → 540 */
export function timeZoneOffsetMinutes(timeZone: string, at: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - Math.floor(at.getTime() / 1000) * 1000) / 60000);
}

/** 会場タイムゾーンの壁時計（YYYY-MM-DDTHH:MM）を UTC ISO へ */
export function zonedLocalToIso(local: string, timeZone: string): string | null {
  const match = local.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!match) return null;
  const guess = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]));
  let result = guess - timeZoneOffsetMinutes(timeZone, new Date(guess)) * 60000;
  result = guess - timeZoneOffsetMinutes(timeZone, new Date(result)) * 60000;
  return new Date(result).toISOString();
}

/** UTC ISO を会場タイムゾーンの壁時計（YYYY-MM-DDTHH:MM）へ。datetime-local の初期値用 */
export function isoToZonedLocal(iso: string | null, timeZone: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const shifted = new Date(date.getTime() + timeZoneOffsetMinutes(timeZone, date) * 60000);
  return shifted.toISOString().slice(0, 16);
}

export function formatInTimeZone(iso: string | null, timeZone = "Asia/Tokyo") {
  if (!iso) return "-";
  return new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium", timeStyle: "short", timeZone }).format(new Date(iso));
}
