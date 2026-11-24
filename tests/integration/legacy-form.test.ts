// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createTestDatabase } from "../helpers/d1";
import { createLiveEvent } from "@/lib/liveEvents";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn((url: string) => { throw new Error(`REDIRECT:${url}`); }), notFound: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: vi.fn(), headers: vi.fn() }));

let env: Awaited<ReturnType<typeof createTestDatabase>>;

beforeAll(async () => {
  env = await createTestDatabase();
}, 60_000);

afterAll(async () => {
  await env?.dispose();
});

function form(liveEventId: string) {
  const data = new FormData();
  data.set("live_event_id", liveEventId);
  data.set("band_name", "招待なしバンド");
  data.set("contact_name", "代表");
  data.set("member_count", "0");
  data.set("equipment_count", "0");
  data.set("song_count", "1");
  data.set("song_0_title", "曲");
  data.set("song_0_duration_min", "3");
  data.set("submission_id", "sub_legacy_0000001");
  return data;
}

describe("旧フォームからの送信（A03）", () => {
  it("招待必須ライブへの招待なしの新規提出を拒否する", async () => {
    const { submitOrder } = await import("@/app/actions");
    const event = (await createLiveEvent({ name: "招待制", songCount: 3, eventDate: null, timeZone: "Asia/Tokyo", submissionDeadlineAt: null, submissionsOpen: true, inviteRequired: true }))!;
    const state = await submitOrder({ fieldErrors: {} }, form(event.id));
    expect(state.formError).toContain("招待URL");
    const count = await env.db.prepare("select count(*) as c from orders").first<{ c: number }>();
    expect(count?.c).toBe(0);
  });

  it("締切を過ぎたライブへの提出を拒否する", async () => {
    const { submitOrder } = await import("@/app/actions");
    const event = (await createLiveEvent({ name: "締切済み", songCount: 3, eventDate: null, timeZone: "Asia/Tokyo", submissionDeadlineAt: new Date(Date.now() - 60_000).toISOString(), submissionsOpen: true, inviteRequired: false }))!;
    const state = await submitOrder({ fieldErrors: {} }, form(event.id));
    expect(state.formError).toContain("締切");
  });

  it("従来方式のライブでは提出と同時に出演エントリーを作る", async () => {
    const { submitOrder } = await import("@/app/actions");
    const event = (await createLiveEvent({ name: "公開フォーム", songCount: 3, eventDate: null, timeZone: "Asia/Tokyo", submissionDeadlineAt: null, submissionsOpen: true, inviteRequired: false }))!;
    await expect(submitOrder({ fieldErrors: {} }, form(event.id))).rejects.toThrow(/REDIRECT:\/thanks/);
    const row = await env.db.prepare("select orders.entry_id, event_entries.band_name from orders join event_entries on event_entries.id = orders.entry_id where orders.live_event_id = ?").bind(event.id).first<{ entry_id: string; band_name: string }>();
    expect(row?.band_name).toBe("招待なしバンド");
  });
});
