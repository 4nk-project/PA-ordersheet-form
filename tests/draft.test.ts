import { describe, expect, it } from "vitest";
import { DRAFT_TTL_MS, isDraftFresh, parseStoredDraft } from "@/lib/draft";

describe("下書きの保存期限", () => {
  it("7日以内の下書きだけ復元する", () => {
    const now = 1_900_000_000_000;
    expect(isDraftFresh(now - DRAFT_TTL_MS, now)).toBe(true);
    expect(isDraftFresh(now - DRAFT_TTL_MS - 1, now)).toBe(false);
    expect(parseStoredDraft(JSON.stringify({ savedAt: now - 1000, value: { bandName: "Band" } }), now)?.value).toEqual({ bandName: "Band" });
  });
});
