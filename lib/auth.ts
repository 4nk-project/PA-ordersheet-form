import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminCookieName, createAdminSessionValue, verifyAdminSessionValue } from "@/lib/admin-session";
import { getRuntimeEnv } from "@/lib/d1/server";

export { adminCookieName, createAdminSessionValue, verifyAdminSessionValue } from "@/lib/admin-session";

/** 管理者パスワード。本番は Workers の秘密設定、開発時は .dev.vars からも読む */
export function getAdminPassword() {
  const password = getRuntimeEnv("ADMIN_PASSWORD");
  if (!password && process.env.NODE_ENV === "production") throw new Error("ADMIN_PASSWORD must be configured in production.");
  return password || "admin-pa-2026-dev-only";
}

export async function isAdminSession() {
  const cookieStore = await cookies();
  return verifyAdminSessionValue(cookieStore.get(adminCookieName)?.value);
}

export async function requireAdminSession() {
  if (!(await isAdminSession())) redirect("/admin/login");
}

const attempts = new Map<string, { count: number; resetAt: number }>();

export function canAttemptAdminLogin(key: string, now = Date.now()) {
  const current = attempts.get(key);
  if (!current || current.resetAt <= now) {
    return true;
  }
  return current.count < 8;
}

export function recordAdminLoginFailure(key: string, now = Date.now()) {
  const current = attempts.get(key);
  if (!current || current.resetAt <= now) attempts.set(key, { count: 1, resetAt: now + 10 * 60 * 1000 });
  else current.count += 1;
}

export function clearAdminLoginFailures(key: string) {
  attempts.delete(key);
}
