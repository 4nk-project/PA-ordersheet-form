import { cookies } from "next/headers";

export const adminCookieName = "pa_admin";

export function getAdminPassword() {
  return process.env.ADMIN_PASSWORD || "admin-pa-2026";
}

export async function isAdminSession() {
  const cookieStore = await cookies();
  return cookieStore.get(adminCookieName)?.value === "1";
}
