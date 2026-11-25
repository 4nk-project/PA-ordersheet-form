import { getRuntimeEnv } from "@/lib/d1/server";

export const ADMIN_SESSION_SECONDS = 60 * 60 * 8;
export const adminCookieName = "pa_admin_session";
const encoder = new TextEncoder();

/** 署名鍵。ログイン（Server Action）と検証（middleware）で同じ値になるよう、同じ読み方で取得する */
function getSessionSecret() {
  const secret = getRuntimeEnv("ADMIN_SESSION_SECRET") || getRuntimeEnv("ADMIN_PASSWORD");
  if (!secret && process.env.NODE_ENV === "production") throw new Error("ADMIN_SESSION_SECRET must be configured in production.");
  return secret || "pa-order-sheet-local-session-secret";
}

function toBase64Url(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

async function signature(payload: string) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(getSessionSecret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return toBase64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(payload))));
}

function safeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

export async function createAdminSessionValue(now = Date.now()) {
  const expires = Math.floor(now / 1000) + ADMIN_SESSION_SECONDS;
  const payload = `${expires}.${crypto.randomUUID().replaceAll("-", "")}`;
  return `${payload}.${await signature(payload)}`;
}

export async function verifyAdminSessionValue(value: string | undefined, now = Date.now()) {
  if (!value) return false;
  const [expiresText, nonce, provided, ...extra] = value.split(".");
  const expires = Number(expiresText);
  if (extra.length || !nonce || !provided || !Number.isInteger(expires) || expires <= Math.floor(now / 1000)) return false;
  return safeEqual(provided, await signature(`${expiresText}.${nonce}`));
}
