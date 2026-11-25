// @vitest-environment node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  ApiErrorResponseSchema,
  EntriesListDataSchema,
  EventDataSchema,
  PAOrderDTOSchema,
  PublicSnapshotSchema,
  PublicStateDataSchema,
  parseReviewedPAOrder,
  pickPublicSnapshot,
  successResponseSchema,
} from "./index";
import { diffOrderContent, pickOrderContent } from "./diff";

function sample(name: string): unknown {
  return JSON.parse(readFileSync(fileURLToPath(new URL(`./samples/${name}`, import.meta.url)), "utf8"));
}

describe("共通契約 v1 のサンプル", () => {
  it("PA連携APIのサンプルがスキーマに一致する", () => {
    expect(successResponseSchema(EventDataSchema).safeParse(sample("live-event.json")).success).toBe(true);
    expect(successResponseSchema(EntriesListDataSchema).safeParse(sample("entries-list.json")).success).toBe(true);
    expect(successResponseSchema(PAOrderDTOSchema).safeParse(sample("pa-order-reviewed.json")).success).toBe(true);
    expect(ApiErrorResponseSchema.safeParse(sample("error-revision-conflict.json")).success).toBe(true);
  });

  it("公開スナップショットのサンプルがスキーマに一致する", () => {
    expect(PublicSnapshotSchema.safeParse(sample("public-snapshot.json")).success).toBe(true);
    expect(successResponseSchema(PublicStateDataSchema).safeParse(sample("public-state-response.json")).success).toBe(true);
  });

  it("確認済みでない版は ReviewedPAOrder として受け付けない", () => {
    const order = (sample("pa-order-reviewed.json") as { data: Record<string, unknown> }).data;
    expect(parseReviewedPAOrder(order).ok).toBe(true);
    expect(parseReviewedPAOrder({ ...order, contentRevision: 3 }).ok).toBe(false);
    expect(parseReviewedPAOrder({ ...order, reviewedRevision: null }).ok).toBe(false);
  });

  it("公開スナップショットの追加キー・内部情報を拒否する", () => {
    const snapshot = sample("public-snapshot.json") as Record<string, unknown>;
    expect(PublicSnapshotSchema.safeParse({ ...snapshot, contactName: "秘密" }).success).toBe(false);
    const slots = (snapshot.slots as Record<string, unknown>[]).map((slot) => ({ ...slot, members: ["x"] }));
    expect(PublicSnapshotSchema.safeParse({ ...snapshot, slots }).success).toBe(false);
  });

  it("参照整合性が崩れたスナップショットを拒否する", () => {
    const snapshot = sample("public-snapshot.json") as Record<string, unknown>;
    expect(PublicSnapshotSchema.safeParse({ ...snapshot, currentSlotId: "slot_missing" }).success).toBe(false);
    expect(PublicSnapshotSchema.safeParse({ ...snapshot, phase: "ended" }).success).toBe(false);
    expect(PublicSnapshotSchema.safeParse({ ...snapshot, youtubeVideoId: "https://example.com/x" }).success).toBe(false);
  });

  it("公開フィールドだけを組み直す", () => {
    const parsed = PublicSnapshotSchema.parse(sample("public-snapshot.json"));
    expect(pickPublicSnapshot(parsed)).toEqual(parsed);
  });
});

describe("提出内容の差分", () => {
  it("IDで追加・変更・削除・並び替えを識別する", () => {
    const order = PAOrderDTOSchema.parse((sample("pa-order-reviewed.json") as { data: unknown }).data);
    const before = pickOrderContent(order);
    const after = pickOrderContent(order);
    after.songs = [
      { ...before.songs[1], order: 1, title: "夕焼け" },
      { ...before.songs[0], order: 2 },
      { id: "song_03", order: 3, title: "新曲", durationSeconds: 200, mood: "", startTrigger: "", paRequest: "", mc: { hasMc: false, person: "" } },
    ];
    after.equipment = [];
    const diff = diffOrderContent(before, after);
    expect(diff.hasChanges).toBe(true);
    expect(diff.songs.find((change) => change.id === "song_02")?.changes.map((change) => change.field)).toEqual(["position", "title"]);
    expect(diff.songs.find((change) => change.id === "song_03")?.kind).toBe("added");
    expect(diff.equipment).toMatchObject([{ kind: "removed", id: "eqp_fx01" }]);
    expect(diffOrderContent(before, pickOrderContent(order)).hasChanges).toBe(false);
  });
});
