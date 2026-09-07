import { describe, expect, it } from "vitest";
import { ADMIN_SESSION_SECONDS, createAdminSessionValue, verifyAdminSessionValue } from "@/lib/admin-session";

describe("管理者セッション", () => {
  it("署名済みで期限内の値だけを受け入れる", async () => {
    const now = 1_900_000_000_000;
    const value = await createAdminSessionValue(now);
    await expect(verifyAdminSessionValue(value, now + 1000)).resolves.toBe(true);
    await expect(verifyAdminSessionValue(`${value}x`, now + 1000)).resolves.toBe(false);
    await expect(verifyAdminSessionValue(value, now + ADMIN_SESSION_SECONDS * 1000 + 1)).resolves.toBe(false);
  });
});
