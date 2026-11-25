// @vitest-environment node
import { createHash, randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDatabase } from "../helpers/d1";
import { handleIntegrationRequest } from "@/lib/integration/router";
import { createLiveEvent } from "@/lib/liveEvents";
import { getOrderByEntryId, saveOrder } from "@/lib/orders";
import { EntriesListDataSchema, EntryDataSchema, InviteIssuedDataSchema, PAOrderDTOSchema, ApiErrorResponseSchema, parseReviewedPAOrder, successResponseSchema } from "@/contracts/v1";
import type { LiveEvent } from "@/types/order";

const tokens = {
  full: "full-token-0123456789abcdef",
  readOnly: "read-token-0123456789abcdef",
  otherEvent: "other-token-0123456789abcdef",
};
const sha = (value: string) => createHash("sha256").update(value).digest("hex");

let env: Awaited<ReturnType<typeof createTestDatabase>>;
let event: LiveEvent;
let otherEvent: LiveEvent;

async function call(method: string, path: string, options: { token?: string; body?: unknown; headers?: Record<string, string> } = {}) {
  const headers: Record<string, string> = { ...options.headers };
  if (options.token) headers.authorization = `Bearer ${options.token}`;
  if (options.body !== undefined) headers["content-type"] = "application/json";
  const request = new Request(`https://pa.example.test/api/integration/v1/${path}`, { method, headers, body: options.body === undefined ? undefined : JSON.stringify(options.body) });
  const response = await handleIntegrationRequest(request, path.split("/"));
  return { status: response.status, json: (await response.json()) as Record<string, unknown> };
}

beforeAll(async () => {
  env = await createTestDatabase();
  event = (await createLiveEvent({ name: "冬ライブ", songCount: 5, eventDate: "2026-12-01", timeZone: "Asia/Tokyo", submissionDeadlineAt: null, submissionsOpen: true, inviteRequired: true }))!;
  otherEvent = (await createLiveEvent({ name: "別ライブ", songCount: 5, eventDate: null, timeZone: "Asia/Tokyo", submissionDeadlineAt: null, submissionsOpen: true, inviteRequired: true }))!;
  process.env.INTEGRATION_TOKENS = JSON.stringify([
    { id: "nodecg-main", sha256: sha(tokens.full), scopes: ["read", "manage", "importReceipt"], eventIds: ["*"] },
    { id: "reader", sha256: sha(tokens.readOnly), scopes: ["read"], eventIds: ["*"] },
    { id: "other", sha256: sha(tokens.otherEvent), scopes: ["read", "manage", "importReceipt"], eventIds: [otherEvent.id] },
  ]);
  process.env.INVITE_REPLAY_KEY = randomBytes(32).toString("base64");
}, 60_000);

afterAll(async () => {
  delete process.env.INTEGRATION_TOKENS;
  delete process.env.INVITE_REPLAY_KEY;
  await env?.dispose();
});

describe("PA連携API（/api/integration/v1）", () => {
  it("認証なし・無効は401、権限不足・対象外ライブは403（A26）", async () => {
    expect((await call("GET", "events")).status).toBe(401);
    expect((await call("GET", "events", { token: "wrong-token-0123456789" })).status).toBe(401);
    expect((await call("POST", `events/${event.id}/entries`, { token: tokens.readOnly, body: { bandName: "x" } })).status).toBe(403);
    expect((await call("GET", `events/${event.id}/entries`, { token: tokens.otherEvent })).status).toBe(403);
    const list = await call("GET", "events", { token: tokens.otherEvent });
    expect((list.json.data as { events: { eventId: string }[] }).events.map((item) => item.eventId)).toEqual([otherEvent.id]);
  });

  it("入力可能なフィールド以外を拒否する", async () => {
    const response = await call("POST", `events/${event.id}/entries`, { token: tokens.full, body: { bandName: "x", eventId: otherEvent.id } });
    expect(response.status).toBe(400);
    expect(ApiErrorResponseSchema.safeParse(response.json).success).toBe(true);
  });

  it("エントリー作成・招待発行は Idempotency-Key で重複しない", async () => {
    const created1 = await call("POST", `events/${event.id}/entries`, { token: tokens.full, body: { bandName: "青信号" }, headers: { "idempotency-key": "create-entry-0001" } });
    const created2 = await call("POST", `events/${event.id}/entries`, { token: tokens.full, body: { bandName: "青信号" }, headers: { "idempotency-key": "create-entry-0001" } });
    expect(created1.status).toBe(201);
    expect(created2.json).toEqual(created1.json);
    expect((await call("POST", `events/${event.id}/entries`, { token: tokens.full, body: { bandName: "別名" }, headers: { "idempotency-key": "create-entry-0001" } })).status).toBe(409);
    const entry = successResponseSchema(EntryDataSchema).parse(created1.json).data.entry;

    const expiresAt = new Date(Date.now() + 7 * 86400_000).toISOString();
    const invite1 = await call("POST", `events/${event.id}/entries/${entry.entryId}/invites`, { token: tokens.full, body: { expiresAt }, headers: { "idempotency-key": "invite-key-0001" } });
    const invite2 = await call("POST", `events/${event.id}/entries/${entry.entryId}/invites`, { token: tokens.full, body: { expiresAt }, headers: { "idempotency-key": "invite-key-0001" } });
    expect(invite1.status).toBe(201);
    expect(invite2.json).toEqual(invite1.json);
    const issued = successResponseSchema(InviteIssuedDataSchema).parse(invite1.json).data;
    expect(issued.url).toMatch(/^https:\/\/pa\.example\.test\/invite\//);
    const stored = await env.db.prepare("select response_body from idempotency_records where idempotency_key = 'invite-key-0001'").first<{ response_body: string }>();
    expect(stored?.response_body).not.toContain(issued.url);

    const list = await call("GET", `events/${event.id}/entries`, { token: tokens.readOnly });
    expect(JSON.stringify(list.json)).not.toContain(issued.url.split("/invite/")[1]);
    expect(successResponseSchema(EntriesListDataSchema).safeParse(list.json).success).toBe(true);
  });

  it("未確認の版は ReviewedPAOrder にならず、確認・取り込み通知の流れが通る（A09・A11）", async () => {
    const created = await call("POST", `events/${event.id}/entries`, { token: tokens.full, body: { bandName: "放課後セッション", initialPerformanceOrder: 2 } });
    const entry = successResponseSchema(EntryDataSchema).parse(created.json).data.entry;
    expect((await call("GET", `events/${event.id}/entries/${entry.entryId}/order`, { token: tokens.full })).status).toBe(404);
    const saved = await saveOrder({
      kind: "create",
      liveEvent: event,
      entryId: entry.entryId,
      content: { bandName: "放課後セッション", contactName: "佐藤", microphoneCount: 1, usesBackingTrack: false, backingTrack: null, members: [], equipment: [], songs: [{ id: "s1", order: 1, title: "曲", durationSeconds: 200, mood: "", startTrigger: "", paRequest: "", mc: { hasMc: false, person: "" } }], generalRequest: "" },
      actor: "submitter",
      submissionId: "sub_api_00000001",
    });
    expect(saved.ok).toBe(true);

    const current = await call("GET", `events/${event.id}/entries/${entry.entryId}/order`, { token: tokens.full });
    const dto = successResponseSchema(PAOrderDTOSchema).parse(current.json).data;
    expect(JSON.stringify(dto)).not.toMatch(/edit_|editToken/);
    expect(parseReviewedPAOrder(dto).ok).toBe(false);

    expect((await call("POST", `events/${event.id}/entries/${entry.entryId}/review`, { token: tokens.full, body: { expectedRevision: 2 } })).status).toBe(409);
    const review = await call("POST", `events/${event.id}/entries/${entry.entryId}/review`, { token: tokens.full, body: { expectedRevision: 1 } });
    expect(review.status).toBe(200);
    const revision = await call("GET", `events/${event.id}/entries/${entry.entryId}/revisions/1`, { token: tokens.full });
    expect(parseReviewedPAOrder((revision.json as { data: unknown }).data).ok).toBe(true);

    const receipt = await call("PUT", `events/${event.id}/entries/${entry.entryId}/import-receipt`, { token: tokens.full, body: { runtimeId: "runtime_main", importedRevision: 1, importedAt: new Date().toISOString() } });
    expect(receipt.status).toBe(200);
    expect((await call("PUT", `events/${event.id}/entries/${entry.entryId}/import-receipt`, { token: tokens.readOnly, body: { runtimeId: "runtime_main", importedRevision: 1, importedAt: new Date().toISOString() } })).status).toBe(403);
    const list = successResponseSchema(EntriesListDataSchema).parse((await call("GET", `events/${event.id}/entries`, { token: tokens.full })).json).data.entries;
    expect(list.find((item) => item.entryId === entry.entryId)?.importReceipts[0]).toMatchObject({ runtimeId: "runtime_main", importedRevision: 1 });
    expect((await getOrderByEntryId(entry.entryId))?.reviewedRevision).toBe(1);
  });

  it("ライブ・エントリーの変更は expectedRevision で競合を検出する", async () => {
    const stale = await call("PATCH", `events/${event.id}`, { token: tokens.full, body: { expectedRevision: 99, submissionsOpen: false } });
    expect(stale.status).toBe(409);
    const ok = await call("PATCH", `events/${event.id}`, { token: tokens.full, body: { expectedRevision: event.revision, submissionsOpen: false } });
    expect(ok.status).toBe(200);
    expect((ok.json.data as { event: { revision: number; submissionsOpen: boolean } }).event).toMatchObject({ revision: event.revision + 1, submissionsOpen: false });
  });
});
