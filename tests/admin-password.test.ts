import { afterEach, describe, expect, it, vi } from "vitest";

// next dev では .dev.vars の値が process.env に入らず、Cloudflare のコンテキストにだけ入る
const cloudflareEnv: Record<string, unknown> = {};
vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext: () => ({ env: cloudflareEnv }) }));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

const { getAdminPassword } = await import("@/lib/auth");
const { createAdminSessionValue, verifyAdminSessionValue } = await import("@/lib/admin-session");

afterEach(() => {
  vi.unstubAllEnvs();
  for (const key of Object.keys(cloudflareEnv)) delete cloudflareEnv[key];
});

describe("管理者パスワードと署名鍵の読み込み", () => {
  it("process.env になければ Cloudflare の設定（.dev.vars・秘密設定）から読む", () => {
    vi.stubEnv("ADMIN_PASSWORD", "");
    cloudflareEnv.ADMIN_PASSWORD = "from-dev-vars";
    expect(getAdminPassword()).toBe("from-dev-vars");
  });

  it("process.env にあればそちらを優先する", () => {
    vi.stubEnv("ADMIN_PASSWORD", "from-process-env");
    cloudflareEnv.ADMIN_PASSWORD = "from-dev-vars";
    expect(getAdminPassword()).toBe("from-process-env");
  });

  it("どちらにもなければ開発用の仮パスワード", () => {
    vi.stubEnv("ADMIN_PASSWORD", "");
    expect(getAdminPassword()).toBe("admin-pa-2026-dev-only");
  });

  it("署名鍵も Cloudflare の設定から読み、鍵が変われば以前のセッションは無効", async () => {
    vi.stubEnv("ADMIN_SESSION_SECRET", "");
    vi.stubEnv("ADMIN_PASSWORD", "");
    cloudflareEnv.ADMIN_SESSION_SECRET = "secret-a";
    const now = 1_900_000_000_000;
    const value = await createAdminSessionValue(now);
    await expect(verifyAdminSessionValue(value, now + 1000)).resolves.toBe(true);
    cloudflareEnv.ADMIN_SESSION_SECRET = "secret-b";
    await expect(verifyAdminSessionValue(value, now + 1000)).resolves.toBe(false);
  });
});
