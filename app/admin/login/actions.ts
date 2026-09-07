"use server";

import { cookies } from "next/headers";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { adminCookieName, canAttemptAdminLogin, clearAdminLoginFailures, createAdminSessionValue, getAdminPassword, recordAdminLoginFailure } from "@/lib/auth";

export async function login(formData: FormData) {
  const password = String(formData.get("password") || "");
  const next = String(formData.get("next") || "/admin");
  const headerStore = await headers();
  const attemptKey = (headerStore.get("cf-connecting-ip") || headerStore.get("x-forwarded-for")?.split(",")[0] || "local").trim().slice(0, 80);

  if (!canAttemptAdminLogin(attemptKey) || password !== getAdminPassword()) {
    recordAdminLoginFailure(attemptKey);
    redirect(`/admin/login?error=1&next=${encodeURIComponent(next)}`);
  }
  clearAdminLoginFailures(attemptKey);

  const cookieStore = await cookies();
  cookieStore.set(adminCookieName, await createAdminSessionValue(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });

  redirect(next.startsWith("/admin") ? next : "/admin");
}

export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete(adminCookieName);
  redirect("/admin/login");
}
