// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDatabase } from "../helpers/d1";
import { createEntry, issueInvite, resolveInvite } from "@/lib/entries";
import { createLiveEvent } from "@/lib/liveEvents";
import { getOrder, getOrderRevision, listOrderRevisions, reviewOrder, saveOrder } from "@/lib/orders";
import { setTestD1Database, type D1DatabaseBinding } from "@/lib/d1/server";
import type { OrderContent } from "@/contracts/v1";
import type { LiveEvent } from "@/types/order";

let env: Awaited<ReturnType<typeof createTestDatabase>>;
let event: LiveEvent;

function content(overrides: Partial<OrderContent> = {}): OrderContent {
  return {
    bandName: "青信号",
    contactName: "山田",
    microphoneCount: 2,
    usesBackingTrack: false,
    backingTrack: null,
    members: [{ id: "member_client_1", name: "山田", instrument: "Vo" }],
    equipment: [{ id: "equipment_client_1", name: "ボード", instrument: "Gt", memberId: "member_client_1" }],
    songs: [{ id: "song_client_1", order: 1, title: "曲1", durationSeconds: 240, mood: "", startTrigger: "", paRequest: "", mc: { hasMc: false, person: "" } }],
    generalRequest: "",
    ...overrides,
  };
}

beforeAll(async () => {
  env = await createTestDatabase();
  event = (await createLiveEvent({ name: "冬ライブ", songCount: 5, eventDate: "2026-12-01", timeZone: "Asia/Tokyo", submissionDeadlineAt: null, submissionsOpen: true, inviteRequired: true }))!;
}, 60_000);

afterAll(async () => {
  await env?.dispose();
});

describe("提出の版管理（ローカルD1）", () => {
  it("初回提出の応答が失われて再送しても、提出は重複しない（A04）", async () => {
    const entry = (await createEntry(event.id, "青信号", null))!;
    const request = { kind: "create" as const, liveEvent: event, entryId: entry.id, content: content(), actor: "submitter" as const, submissionId: "sub_retry_000001" };
    const first = await saveOrder(request);
    const second = await saveOrder(request);
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second.orderId).toBe(first.orderId);
    expect(second.duplicate).toBe(true);
    const count = await env.db.prepare("select count(*) as c from orders where entry_id = ?").bind(entry.id).first<{ c: number }>();
    expect(count?.c).toBe(1);
    // 別の submissionId でも同じエントリーへの2件目の作成は拒否する
    const third = await saveOrder({ ...request, submissionId: "sub_retry_000002" });
    expect(third).toMatchObject({ ok: false, code: "entry_taken" });
  });

  it("再提出・管理者編集で版が増え、同じ内容では増えない。項目IDは維持される（A06）", async () => {
    const entry = (await createEntry(event.id, "放課後", null))!;
    const created = await saveOrder({ kind: "create", liveEvent: event, entryId: entry.id, content: content({ bandName: "放課後" }), actor: "submitter", submissionId: "sub_a06_create1" });
    if (!created.ok) throw new Error("create failed");
    const v1 = (await getOrder(created.orderId))!;
    expect(v1.members[0].id).toMatch(/^mem_/);
    expect(v1.equipment[0].memberId).toBe(v1.members[0].id);

    const edited = { ...content({ bandName: "放課後" }), members: v1.members, equipment: v1.equipment.map((item) => ({ ...item })), songs: [{ ...v1.songs[0], title: "曲1（改）" }, { id: "song_new_client", order: 2, title: "新曲", durationSeconds: 200, mood: "", startTrigger: "", paRequest: "", mc: { hasMc: false, person: "" } }] };
    const updated = await saveOrder({ kind: "update", orderId: created.orderId, liveEvent: event, expectedRevision: 1, content: edited, actor: "submitter", submissionId: "sub_a06_update1" });
    expect(updated).toMatchObject({ ok: true, revision: 2 });
    const v2 = (await getOrder(created.orderId))!;
    expect(v2.songs[0].id).toBe(v1.songs[0].id);
    expect(v2.members[0].id).toBe(v1.members[0].id);

    const unchanged = await saveOrder({ kind: "update", orderId: created.orderId, liveEvent: event, expectedRevision: 2, content: { ...edited, songs: v2.songs.map((song) => ({ ...song })) }, actor: "submitter", submissionId: "sub_a06_same01" });
    expect(unchanged).toMatchObject({ ok: true, revision: 2, unchanged: true });

    const admin = await saveOrder({ kind: "update", orderId: created.orderId, liveEvent: event, expectedRevision: 2, content: { ...edited, songs: v2.songs.map((song) => ({ ...song })), generalRequest: "運営メモ反映" }, actor: "admin", submissionId: "sub_a06_admin1" });
    expect(admin).toMatchObject({ ok: true, revision: 3 });
    const v3 = (await getOrder(created.orderId))!;
    expect(v3.adminUpdatedAt).not.toBeNull();
    expect(v3.submitterUpdatedAt).toBe(v2.submitterUpdatedAt);
    expect((await listOrderRevisions(created.orderId)).map((revision) => [revision.revision, revision.actor])).toEqual([
      [3, "admin"],
      [2, "submitter"],
      [1, "submitter"],
    ]);
    expect((await getOrderRevision(created.orderId, 1))?.content.songs).toHaveLength(1);

    // 古い版を前提にした更新は競合として拒否し、黙って上書きしない
    const stale = await saveOrder({ kind: "update", orderId: created.orderId, liveEvent: event, expectedRevision: 2, content: content({ bandName: "放課後" }), actor: "submitter", submissionId: "sub_a06_stale1" });
    expect(stale).toMatchObject({ ok: false, code: "revision_conflict", currentRevision: 3 });
  });

  it("確認と再提出が競合したとき、新しい版を確認済みにしない（A07）", async () => {
    const entry = (await createEntry(event.id, "競合テスト", null))!;
    const created = await saveOrder({ kind: "create", liveEvent: event, entryId: entry.id, content: content({ bandName: "競合テスト" }), actor: "submitter", submissionId: "sub_a07_create1" });
    if (!created.ok) throw new Error("create failed");
    await saveOrder({ kind: "update", orderId: created.orderId, liveEvent: event, expectedRevision: 1, content: content({ bandName: "競合テスト", generalRequest: "追記" }), actor: "submitter", submissionId: "sub_a07_update1" });
    expect(await reviewOrder(created.orderId, 1)).toMatchObject({ ok: false, code: "revision_conflict", currentRevision: 2 });
    expect((await getOrder(created.orderId))?.reviewedRevision).toBeNull();
    expect(await reviewOrder(created.orderId, 2)).toMatchObject({ ok: true, reviewedRevision: 2 });
  });

  it("複数テーブル更新の途中で失敗しても、提出内容と履歴は部分更新されない（A08）", async () => {
    const entry = (await createEntry(event.id, "原子性", null))!;
    const created = await saveOrder({ kind: "create", liveEvent: event, entryId: entry.id, content: content({ bandName: "原子性" }), actor: "submitter", submissionId: "sub_a08_create1" });
    if (!created.ok) throw new Error("create failed");
    const failing: D1DatabaseBinding = {
      prepare: (query) => env.db.prepare(query),
      batch: (statements) => env.db.batch([...statements, env.db.prepare("insert into write_guards (id, ok) values ('force_failure', NULL)")]),
    };
    setTestD1Database(failing);
    await expect(
      saveOrder({ kind: "update", orderId: created.orderId, liveEvent: event, expectedRevision: 1, content: content({ bandName: "原子性", songs: [] }), actor: "submitter", submissionId: "sub_a08_update1" }),
    ).rejects.toThrow();
    setTestD1Database(env.db);
    const order = (await getOrder(created.orderId))!;
    expect(order.contentRevision).toBe(1);
    expect(order.songs).toHaveLength(1);
    expect(await listOrderRevisions(created.orderId)).toHaveLength(1);
    const record = await env.db.prepare("select count(*) as c from submission_records where submission_id = 'sub_a08_update1'").first<{ c: number }>();
    expect(record?.c).toBe(0);
  });
});

describe("招待", () => {
  it("再発行で以前の招待を失効させ、期限切れ・失効を判定する。GETでの検証は状態を変えない（A01・A02）", async () => {
    const entry = (await createEntry(event.id, "招待テスト", null))!;
    const first = await issueInvite(entry.id, new Date(Date.now() + 86400_000).toISOString(), false);
    if (!first.ok) throw new Error("issue failed");
    expect(await issueInvite(entry.id, new Date(Date.now() + 86400_000).toISOString(), false)).toMatchObject({ ok: false, code: "invite_exists" });
    const before = await resolveInvite(first.token);
    expect(before.status).toBe("valid");
    expect((await resolveInvite(first.token)).status).toBe("valid");
    const second = await issueInvite(entry.id, new Date(Date.now() + 86400_000).toISOString(), true);
    if (!second.ok) throw new Error("reissue failed");
    expect((await resolveInvite(first.token)).status).toBe("revoked");
    const resolved = await resolveInvite(second.token);
    expect(resolved.status).toBe("valid");
    if (resolved.status === "valid") expect(resolved.entry.id).toBe(entry.id);
    expect((await resolveInvite(second.token, Date.now() + 2 * 86400_000)).status).toBe("expired");
    const stored = await env.db.prepare("select token_hash from entry_invites where entry_id = ?").bind(entry.id).all<{ token_hash: string }>();
    expect((stored.results || []).some((row) => row.token_hash === second.token)).toBe(false);
  });
});
