import { describe, expect, it } from "vitest";
import { DRAFT_TTL_MS, draftKey, isDraftFresh, parseStoredDraft } from "@/lib/draft";

describe("端末内下書き", () => {
  it("7日以内の下書きだけ復元する", () => {
    const now = 1_900_000_000_000;
    expect(isDraftFresh(now - DRAFT_TTL_MS, now)).toBe(true);
    expect(isDraftFresh(now - DRAFT_TTL_MS - 1, now)).toBe(false);
    expect(parseStoredDraft(JSON.stringify({ savedAt: now - 1000, value: { bandName: "Band" } }), now)?.value).toEqual({ bandName: "Band" });
  });

  it("ライブとエントリーごとにキーを分け、招待トークンを使わない", () => {
    expect(draftKey("live_a", "ent_1")).not.toBe(draftKey("live_a", "ent_2"));
    expect(draftKey("live_a", "ent_1")).not.toBe(draftKey("live_b", "ent_1"));
    expect(draftKey("live_a", "ent_1")).toBe("pa-order-draft:v3:live_a:ent_1");
  });
});
