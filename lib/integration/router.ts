import {
  CreateEntryBodySchema,
  CreateEventBodySchema,
  ImportReceiptBodySchema,
  IssueInviteBodySchema,
  PAOrderDTOSchema,
  PatchEntryBodySchema,
  PatchEventBodySchema,
  ReviewBodySchema,
} from "@/contracts/v1";
import { createEntry, getAdminEntry, getEntry, invitePath, issueInvite, listAdminEntries, patchEntry, revokeInvite, upsertImportReceipt } from "@/lib/entries";
import { createLiveEvent, getLiveEvent, listLiveEvents, patchLiveEvent } from "@/lib/liveEvents";
import { getOrderByEntryId, getOrderRevision, reviewOrder } from "@/lib/orders";
import { getRuntimeEnv } from "@/lib/d1/server";
import { authenticate, canAccessEvent } from "./auth";
import { toEntryDTO, toLiveEventDTO, toPAOrderDTO } from "./dto";
import { jsonError, jsonOk, readJsonBody } from "./http";
import { withIdempotency } from "./idempotency";

const ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;

function publicBaseUrl(request: Request) {
  const configured = getRuntimeEnv("PA_PUBLIC_BASE_URL");
  return (configured || new URL(request.url).origin).replace(/\/+$/, "");
}

async function entryInEvent(eventId: string, entryId: string) {
  const entry = await getEntry(entryId);
  return entry && entry.liveEventId === eventId ? entry : null;
}

async function entryResponse(entryId: string, status = 200) {
  const row = await getAdminEntry(entryId);
  return row ? jsonOk({ entry: toEntryDTO(row) }, status) : jsonError("not_found", "出演エントリーが見つかりません。");
}

/**
 * /api/integration/v1/{...segments} の処理。
 * すべての経路でサーバー側の Bearer 認証を行う（/admin の middleware には依存しない）。
 */
export async function handleIntegrationRequest(request: Request, segments: string[]): Promise<Response> {
  try {
    return await route(request, segments);
  } catch (error) {
    console.error("integration api error", error instanceof Error ? error.message : "unknown");
    return jsonError("internal_error", "サーバーでエラーが発生しました。");
  }
}

async function route(request: Request, segments: string[]): Promise<Response> {
  const method = request.method.toUpperCase();
  const [root, eventId, sub, entryId, action, extra, ...rest] = segments;
  if (root !== "events" || rest.length) return jsonError("not_found", "対象が見つかりません。");
  if (eventId !== undefined && !ID.test(eventId)) return jsonError("not_found", "ライブが見つかりません。");
  if (entryId !== undefined && !ID.test(entryId)) return jsonError("not_found", "出演エントリーが見つかりません。");

  // /events
  if (eventId === undefined) {
    if (method === "GET") {
      const auth = await authenticate(request, "read");
      if (!auth.ok) return auth.response;
      const events = (await listLiveEvents()).filter((event) => canAccessEvent(auth.principal, event.id));
      return jsonOk({ events: events.map(toLiveEventDTO) });
    }
    if (method === "POST") {
      const auth = await authenticate(request, "manage");
      if (!auth.ok) return auth.response;
      if (!auth.principal.eventIds.includes("*")) return jsonError("forbidden", "ライブを作成する権限がありません。");
      const body = await readJsonBody(request, CreateEventBodySchema);
      if (!body.ok) return body.response;
      return withIdempotency(request, auth.principal.id, "POST /events", body.raw, async () => {
        const event = await createLiveEvent({
          name: body.data.name,
          songCount: body.data.songLimit,
          eventDate: body.data.eventDate,
          timeZone: body.data.timeZone,
          submissionDeadlineAt: body.data.submissionDeadlineAt,
          submissionsOpen: body.data.submissionsOpen,
          inviteRequired: body.data.inviteRequired,
        });
        return event ? jsonOk({ event: toLiveEventDTO(event) }, 201) : jsonError("invalid_request", "ライブを作成できませんでした。");
      });
    }
    return jsonError("invalid_request", "このメソッドは使えません。", { status: 405 });
  }

  // /events/{eventId}
  if (sub === undefined) {
    if (method !== "PATCH") return jsonError("invalid_request", "このメソッドは使えません。", { status: 405 });
    const auth = await authenticate(request, "manage", eventId);
    if (!auth.ok) return auth.response;
    const body = await readJsonBody(request, PatchEventBodySchema);
    if (!body.ok) return body.response;
    const { expectedRevision, songLimit, ...rest } = body.data;
    const result = await patchLiveEvent(eventId, expectedRevision, { ...rest, songCount: songLimit });
    if (result === null) return jsonError("not_found", "ライブが見つかりません。");
    if (result === "conflict") {
      const current = await getLiveEvent(eventId);
      return jsonError("revision_conflict", "ライブ設定が他で更新されています。再読み込みしてください。", { currentRevision: current?.revision });
    }
    return jsonOk({ event: toLiveEventDTO(result) });
  }

  if (sub !== "entries") return jsonError("not_found", "対象が見つかりません。");

  // /events/{eventId}/entries
  if (entryId === undefined) {
    if (method === "GET") {
      const auth = await authenticate(request, "read", eventId);
      if (!auth.ok) return auth.response;
      if (!(await getLiveEvent(eventId))) return jsonError("not_found", "ライブが見つかりません。");
      return jsonOk({ entries: (await listAdminEntries(eventId)).map(toEntryDTO) });
    }
    if (method === "POST") {
      const auth = await authenticate(request, "manage", eventId);
      if (!auth.ok) return auth.response;
      const body = await readJsonBody(request, CreateEntryBodySchema);
      if (!body.ok) return body.response;
      return withIdempotency(request, auth.principal.id, `POST /events/${eventId}/entries`, body.raw, async () => {
        const entry = await createEntry(eventId, body.data.bandName, body.data.initialPerformanceOrder);
        if (!entry) return jsonError("not_found", "ライブが見つかりません。");
        return entryResponse(entry.id, 201);
      });
    }
    return jsonError("invalid_request", "このメソッドは使えません。", { status: 405 });
  }

  // /events/{eventId}/entries/{entryId}
  if (action === undefined) {
    if (method !== "PATCH") return jsonError("invalid_request", "このメソッドは使えません。", { status: 405 });
    const auth = await authenticate(request, "manage", eventId);
    if (!auth.ok) return auth.response;
    const body = await readJsonBody(request, PatchEntryBodySchema);
    if (!body.ok) return body.response;
    if (!(await entryInEvent(eventId, entryId))) return jsonError("not_found", "出演エントリーが見つかりません。");
    const { expectedRevision, ...patch } = body.data;
    const result = await patchEntry(entryId, expectedRevision, patch);
    if (result === null) return jsonError("not_found", "出演エントリーが見つかりません。");
    if (result === "conflict") {
      const current = await getEntry(entryId);
      return jsonError("revision_conflict", "出演エントリーが他で更新されています。再読み込みしてください。", { currentRevision: current?.revision });
    }
    return entryResponse(entryId);
  }

  if (action === "invites") {
    if (extra === undefined && method === "POST") {
      const auth = await authenticate(request, "manage", eventId);
      if (!auth.ok) return auth.response;
      const body = await readJsonBody(request, IssueInviteBodySchema);
      if (!body.ok) return body.response;
      if (!(await entryInEvent(eventId, entryId))) return jsonError("not_found", "出演エントリーが見つかりません。");
      return withIdempotency(
        request,
        auth.principal.id,
        `POST /events/${eventId}/entries/${entryId}/invites`,
        body.raw,
        async () => {
          const result = await issueInvite(entryId, body.data.expiresAt, body.data.reissue);
          if (!result.ok) return jsonError(result.code, result.message);
          // 招待URLはこの応答にだけ含める（一覧APIには含めない）
          return jsonOk({ inviteId: result.inviteId, url: `${publicBaseUrl(request)}${invitePath(result.token)}`, expiresAt: result.expiresAt }, 201);
        },
        { sensitive: true },
      );
    }
    if (extra !== undefined && method === "DELETE") {
      if (!ID.test(extra)) return jsonError("not_found", "招待が見つかりません。");
      const auth = await authenticate(request, "manage", eventId);
      if (!auth.ok) return auth.response;
      if (!(await entryInEvent(eventId, entryId))) return jsonError("not_found", "出演エントリーが見つかりません。");
      const result = await revokeInvite(entryId, extra);
      return result.ok ? jsonOk({ inviteId: extra, revokedAt: result.revokedAt }) : jsonError("not_found", "招待が見つかりません。");
    }
    return jsonError("invalid_request", "このメソッドは使えません。", { status: 405 });
  }

  if (action === "order" || action === "revisions") {
    if (method !== "GET") return jsonError("invalid_request", "このメソッドは使えません。", { status: 405 });
    const auth = await authenticate(request, "read", eventId);
    if (!auth.ok) return auth.response;
    if (!(await entryInEvent(eventId, entryId))) return jsonError("not_found", "出演エントリーが見つかりません。");
    const order = await getOrderByEntryId(entryId);
    if (!order) return jsonError("not_found", "このエントリーの提出はまだありません。");
    let revisionNumber = order.contentRevision;
    if (action === "revisions") {
      if (extra === undefined || !/^[1-9]\d{0,8}$/.test(extra)) return jsonError("not_found", "版が見つかりません。");
      revisionNumber = Number(extra);
    } else if (extra !== undefined) {
      return jsonError("not_found", "対象が見つかりません。");
    }
    const revision = await getOrderRevision(order.id, revisionNumber);
    if (!revision) return jsonError("not_found", "指定した版が見つかりません。");
    const dto = PAOrderDTOSchema.parse(toPAOrderDTO(order, entryId, revision));
    return jsonOk(dto);
  }

  if (action === "review") {
    if (method !== "POST" || extra !== undefined) return jsonError("invalid_request", "このメソッドは使えません。", { status: 405 });
    const auth = await authenticate(request, "manage", eventId);
    if (!auth.ok) return auth.response;
    const body = await readJsonBody(request, ReviewBodySchema);
    if (!body.ok) return body.response;
    if (!(await entryInEvent(eventId, entryId))) return jsonError("not_found", "出演エントリーが見つかりません。");
    const order = await getOrderByEntryId(entryId);
    if (!order) return jsonError("not_found", "このエントリーの提出はまだありません。");
    const result = await reviewOrder(order.id, body.data.expectedRevision);
    if (!result.ok && result.code === "not_found") return jsonError("not_found", "提出が見つかりません。");
    if (!result.ok) return jsonError("revision_conflict", "確認中に新しい提出が届きました。差分を確認してから再度確認済みにしてください。", { currentRevision: result.currentRevision });
    return jsonOk({ entryId, orderId: order.id, reviewedRevision: result.reviewedRevision, reviewedAt: result.reviewedAt });
  }

  if (action === "import-receipt") {
    if (method !== "PUT" || extra !== undefined) return jsonError("invalid_request", "このメソッドは使えません。", { status: 405 });
    const auth = await authenticate(request, "importReceipt", eventId);
    if (!auth.ok) return auth.response;
    const body = await readJsonBody(request, ImportReceiptBodySchema);
    if (!body.ok) return body.response;
    if (!(await entryInEvent(eventId, entryId))) return jsonError("not_found", "出演エントリーが見つかりません。");
    const order = await getOrderByEntryId(entryId);
    if (!order || body.data.importedRevision > order.contentRevision) return jsonError("invalid_request", "存在しない版の取り込み通知です。");
    const saved = await upsertImportReceipt(entryId, body.data.runtimeId, body.data.importedRevision, body.data.importedAt);
    return jsonOk(saved);
  }

  return jsonError("not_found", "対象が見つかりません。");
}
