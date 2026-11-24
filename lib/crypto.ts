const encoder = new TextEncoder();

export function toBase64Url(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

export function fromBase64(value: string) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

/** 暗号学的乱数によるトークン（初期値32バイト） */
export function randomToken(bytes = 32) {
  const buffer = new Uint8Array(bytes);
  crypto.getRandomValues(buffer);
  return toBase64Url(buffer);
}

/** 推測困難な永続ID。例: ent_3f9c0a... */
export function randomId(prefix: string) {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "").slice(0, 20)}`;
}

export async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** キー順を固定したJSON。リクエスト本文の同一性判定に使う */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(",")}}`;
}

export function safeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

async function importAesKey(base64Key: string) {
  const raw = fromBase64(base64Key);
  if (raw.length !== 32) throw new Error("暗号化鍵は32バイト（base64）で設定してください。");
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

/** AES-256-GCM。出力は "iv.ciphertext"（base64url） */
export async function encryptText(plain: string, base64Key: string) {
  const key = await importAesKey(base64Key);
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(plain)));
  return `${toBase64Url(iv)}.${toBase64Url(cipher)}`;
}

export async function decryptText(payload: string, base64Key: string) {
  const [ivText, cipherText] = payload.split(".");
  if (!ivText || !cipherText) throw new Error("暗号文の形式が不正です。");
  const key = await importAesKey(base64Key);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64(ivText) }, key, fromBase64(cipherText));
  return new TextDecoder().decode(plain);
}
