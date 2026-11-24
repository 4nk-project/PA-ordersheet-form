/**
 * 軽音ライブ管理システム 共通API契約 v1
 *
 * このファイルは PA-ordersheet-form / band-management-nodecg / band-live-web の
 * 各リポジトリの `contracts/v1/` に同じ内容で置く。変更する場合は3リポジトリへ同時に反映し、
 * `npm run contracts:check` でチェックサムを更新・照合すること。
 * 破壊的変更は v2 を新設する。
 */
import { z } from "zod";

export const SCHEMA_VERSION = 1 as const;

/* -------------------------------------------------------------------------- */
/* 共通                                                                        */
/* -------------------------------------------------------------------------- */

/** 永続ID。行番号や配列インデックスを使わない。 */
export const IdSchema = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/, "IDの形式が不正です。");
/** UTCのISO 8601文字列（末尾Z）。 */
export const IsoDateTimeSchema = z.iso.datetime();
/** YYYY-MM-DD */
export const IsoDateSchema = z.iso.date();
/** 整数の秒。未入力は null（0秒と区別する）。 */
export const DurationSecondsSchema = z.number().int().min(0).max(24 * 60 * 60);
export const RevisionSchema = z.number().int().min(1);

export function isValidTimeZone(value: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(0);
    return true;
  } catch {
    return false;
  }
}

export const TimeZoneSchema = z.string().min(1).max(64).refine(isValidTimeZone, "タイムゾーンが不正です。");

/** YouTube動画ID。任意URL・iframe HTMLは受け付けない。 */
export const YOUTUBE_VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
export const YoutubeVideoIdSchema = z.string().regex(YOUTUBE_VIDEO_ID_PATTERN, "YouTube動画IDが不正です。");

export const ErrorCodeSchema = z.enum([
  "invalid_request",
  "unauthorized",
  "forbidden",
  "submissions_closed",
  "not_found",
  "revision_conflict",
  "idempotency_conflict",
  "invite_exists",
  "invite_revoked",
  "invite_expired",
  "not_reviewed",
  "rate_limited",
  "dependency_unavailable",
  "internal_error",
]);
export type ErrorCode = z.infer<typeof ErrorCodeSchema>;

/** 失敗時の共通レスポンス */
export const ApiErrorResponseSchema = z.strictObject({
  schemaVersion: z.literal(SCHEMA_VERSION),
  error: z.strictObject({
    code: ErrorCodeSchema,
    message: z.string(),
    fieldErrors: z.record(z.string(), z.string()).optional(),
    /** 版競合時に、相手側の現在の版を返す場合がある */
    currentRevision: z.number().int().min(0).optional(),
  }),
});
export type ApiErrorResponse = z.infer<typeof ApiErrorResponseSchema>;

/** 成功時の共通レスポンス */
export function successResponseSchema<T extends z.ZodType>(data: T) {
  return z.strictObject({ schemaVersion: z.literal(SCHEMA_VERSION), data });
}
export type ApiSuccessResponse<T> = { schemaVersion: typeof SCHEMA_VERSION; data: T };

/** ステータスコードとエラーコードの対応 */
export const ERROR_STATUS: Record<ErrorCode, number> = {
  invalid_request: 400,
  unauthorized: 401,
  forbidden: 403,
  submissions_closed: 403,
  not_found: 404,
  revision_conflict: 409,
  idempotency_conflict: 409,
  invite_exists: 409,
  invite_revoked: 410,
  invite_expired: 410,
  not_reviewed: 409,
  rate_limited: 429,
  dependency_unavailable: 503,
  internal_error: 500,
};

/* -------------------------------------------------------------------------- */
/* PA ⇔ NodeCG 連携API  /api/integration/v1                                   */
/* -------------------------------------------------------------------------- */

export const INTEGRATION_BASE_PATH = "/api/integration/v1";
export const IntegrationScopeSchema = z.enum(["read", "manage", "importReceipt"]);
export type IntegrationScope = z.infer<typeof IntegrationScopeSchema>;

export const LiveEventDTOSchema = z.strictObject({
  eventId: IdSchema,
  /** ライブ設定の版。提出の版とは別 */
  revision: RevisionSchema,
  name: z.string().min(1).max(160),
  /** YYYY-MM-DD。未設定の既存ライブは null */
  eventDate: IsoDateSchema.nullable(),
  timeZone: TimeZoneSchema,
  submissionDeadlineAt: IsoDateTimeSchema.nullable(),
  submissionsOpen: z.boolean(),
  inviteRequired: z.boolean(),
  songLimit: z.number().int().min(1).max(30),
});
export type LiveEventDTO = z.infer<typeof LiveEventDTOSchema>;

export const ReviewStatusSchema = z.enum(["new", "reviewing", "done"]);

export const ImportReceiptDTOSchema = z.strictObject({
  runtimeId: IdSchema,
  importedRevision: RevisionSchema,
  importedAt: IsoDateTimeSchema,
  receivedAt: IsoDateTimeSchema,
});
export type ImportReceiptDTO = z.infer<typeof ImportReceiptDTOSchema>;

export const EntryDTOSchema = z.strictObject({
  eventId: IdSchema,
  entryId: IdSchema,
  /** バンド名・初期順などの設定の版 */
  revision: RevisionSchema,
  bandName: z.string().min(1).max(120),
  initialPerformanceOrder: z.number().int().min(1).nullable(),
  cancelled: z.boolean(),
  invite: z
    .strictObject({ inviteId: IdSchema, expiresAt: IsoDateTimeSchema, revokedAt: IsoDateTimeSchema.nullable() })
    .nullable(),
  order: z
    .strictObject({
      orderId: IdSchema,
      contentRevision: RevisionSchema,
      reviewedRevision: RevisionSchema.nullable(),
      reviewStatus: ReviewStatusSchema,
      submitterUpdatedAt: IsoDateTimeSchema,
      adminUpdatedAt: IsoDateTimeSchema.nullable(),
    })
    .nullable(),
  importReceipts: z.array(ImportReceiptDTOSchema),
});
export type EntryDTO = z.infer<typeof EntryDTOSchema>;

export const BackingTrackSchema = z.strictObject({
  operator: z.string().max(80),
  device: z.string().max(120),
  connection: z.string().max(120),
});

export const OrderMemberSchema = z.strictObject({ id: IdSchema, name: z.string().max(80), instrument: z.string().max(80) });
export const OrderEquipmentSchema = z.strictObject({
  id: IdSchema,
  name: z.string().max(160),
  instrument: z.string().max(80),
  memberId: IdSchema.nullable(),
});
export const OrderSongSchema = z.strictObject({
  id: IdSchema,
  order: z.number().int().min(1),
  title: z.string().max(160),
  durationSeconds: DurationSecondsSchema.nullable(),
  mood: z.string().max(80),
  startTrigger: z.string().max(120),
  paRequest: z.string().max(1000),
  mc: z.strictObject({ hasMc: z.boolean(), person: z.string().max(80) }),
});

/** 提出内容そのもの（版ごとに保存される範囲） */
export const OrderContentShape = {
  bandName: z.string().min(1).max(120),
  contactName: z.string().max(80),
  microphoneCount: z.number().int().min(0).max(99),
  usesBackingTrack: z.boolean(),
  backingTrack: BackingTrackSchema.nullable(),
  members: z.array(OrderMemberSchema).max(20),
  equipment: z.array(OrderEquipmentSchema).max(20),
  songs: z.array(OrderSongSchema).max(30),
  generalRequest: z.string().max(2000),
};
export const OrderContentSchema = z.strictObject(OrderContentShape);
export type OrderContent = z.infer<typeof OrderContentSchema>;
export type OrderMember = z.infer<typeof OrderMemberSchema>;
export type OrderEquipment = z.infer<typeof OrderEquipmentSchema>;
export type OrderSong = z.infer<typeof OrderSongSchema>;
export type BackingTrack = z.infer<typeof BackingTrackSchema>;

/** 提出DTO。編集トークン・招待トークン・セッション・内部コメントは含めない。 */
export const PAOrderDTOSchema = z.strictObject({
  eventId: IdSchema,
  entryId: IdSchema,
  orderId: IdSchema,
  contentRevision: RevisionSchema,
  reviewedRevision: RevisionSchema.nullable(),
  reviewedAt: IsoDateTimeSchema.nullable(),
  ...OrderContentShape,
  submitterUpdatedAt: IsoDateTimeSchema,
  adminUpdatedAt: IsoDateTimeSchema.nullable(),
});
export type PAOrderDTO = z.infer<typeof PAOrderDTOSchema>;

/** 確認済みの提出DTO。contentRevision === reviewedRevision を実行時に検証する。 */
export const ReviewedPAOrderSchema = PAOrderDTOSchema.refine(
  (order) => order.reviewedRevision !== null && order.contentRevision === order.reviewedRevision,
  { message: "確認済みの版ではありません。", path: ["reviewedRevision"] },
).brand<"ReviewedPAOrder">();
export type ReviewedPAOrder = z.infer<typeof ReviewedPAOrderSchema>;

export function parseReviewedPAOrder(value: unknown): { ok: true; order: ReviewedPAOrder } | { ok: false; reason: string } {
  const result = ReviewedPAOrderSchema.safeParse(value);
  if (result.success) return { ok: true, order: result.data };
  return { ok: false, reason: result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join(" / ") };
}

/* ---- リクエスト本文 ---- */

export const CreateEventBodySchema = z.strictObject({
  name: z.string().trim().min(1).max(160),
  eventDate: IsoDateSchema.nullable().default(null),
  timeZone: TimeZoneSchema.default("Asia/Tokyo"),
  submissionDeadlineAt: IsoDateTimeSchema.nullable().default(null),
  submissionsOpen: z.boolean().default(true),
  inviteRequired: z.boolean().default(true),
  songLimit: z.number().int().min(1).max(30).default(8),
});
export type CreateEventBody = z.infer<typeof CreateEventBodySchema>;

export const PatchEventBodySchema = z
  .strictObject({
    expectedRevision: RevisionSchema,
    name: z.string().trim().min(1).max(160).optional(),
    eventDate: IsoDateSchema.nullable().optional(),
    timeZone: TimeZoneSchema.optional(),
    submissionDeadlineAt: IsoDateTimeSchema.nullable().optional(),
    submissionsOpen: z.boolean().optional(),
    inviteRequired: z.boolean().optional(),
    songLimit: z.number().int().min(1).max(30).optional(),
  });
export type PatchEventBody = z.infer<typeof PatchEventBodySchema>;

export const CreateEntryBodySchema = z.strictObject({
  bandName: z.string().trim().min(1).max(120),
  initialPerformanceOrder: z.number().int().min(1).nullable().default(null),
});
export type CreateEntryBody = z.infer<typeof CreateEntryBodySchema>;

export const PatchEntryBodySchema = z.strictObject({
  expectedRevision: RevisionSchema,
  bandName: z.string().trim().min(1).max(120).optional(),
  initialPerformanceOrder: z.number().int().min(1).nullable().optional(),
  cancelled: z.boolean().optional(),
});
export type PatchEntryBody = z.infer<typeof PatchEntryBodySchema>;

export const IssueInviteBodySchema = z.strictObject({
  expiresAt: IsoDateTimeSchema,
  /** true なら既存の有効な招待を失効させて再発行する */
  reissue: z.boolean().default(false),
});
export type IssueInviteBody = z.infer<typeof IssueInviteBodySchema>;

export const ReviewBodySchema = z.strictObject({ expectedRevision: RevisionSchema });
export type ReviewBody = z.infer<typeof ReviewBodySchema>;

export const ImportReceiptBodySchema = z.strictObject({
  runtimeId: IdSchema,
  importedRevision: RevisionSchema,
  importedAt: IsoDateTimeSchema,
});
export type ImportReceiptBody = z.infer<typeof ImportReceiptBodySchema>;

/* ---- レスポンスの data ---- */

export const EventsListDataSchema = z.strictObject({ events: z.array(LiveEventDTOSchema) });
export const EventDataSchema = z.strictObject({ event: LiveEventDTOSchema });
export const EntriesListDataSchema = z.strictObject({ entries: z.array(EntryDTOSchema) });
export const EntryDataSchema = z.strictObject({ entry: EntryDTOSchema });
export const InviteIssuedDataSchema = z.strictObject({ inviteId: IdSchema, url: z.url(), expiresAt: IsoDateTimeSchema });
export const InviteRevokedDataSchema = z.strictObject({ inviteId: IdSchema, revokedAt: IsoDateTimeSchema });
export const ReviewResultDataSchema = z.strictObject({
  entryId: IdSchema,
  orderId: IdSchema,
  reviewedRevision: RevisionSchema,
  reviewedAt: IsoDateTimeSchema,
});
export const ImportReceiptResultDataSchema = z.strictObject({
  entryId: IdSchema,
  runtimeId: IdSchema,
  importedRevision: RevisionSchema,
  importedAt: IsoDateTimeSchema,
  receivedAt: IsoDateTimeSchema,
});
export type InviteIssuedData = z.infer<typeof InviteIssuedDataSchema>;
export type ReviewResultData = z.infer<typeof ReviewResultDataSchema>;
export type ImportReceiptResultData = z.infer<typeof ImportReceiptResultDataSchema>;

/** エンドポイント一覧（ドキュメント・テスト用） */
export const INTEGRATION_ENDPOINTS = [
  { method: "GET", path: "/events", scope: "read" },
  { method: "POST", path: "/events", scope: "manage" },
  { method: "PATCH", path: "/events/{eventId}", scope: "manage" },
  { method: "GET", path: "/events/{eventId}/entries", scope: "read" },
  { method: "POST", path: "/events/{eventId}/entries", scope: "manage" },
  { method: "PATCH", path: "/events/{eventId}/entries/{entryId}", scope: "manage" },
  { method: "POST", path: "/events/{eventId}/entries/{entryId}/invites", scope: "manage" },
  { method: "DELETE", path: "/events/{eventId}/entries/{entryId}/invites/{inviteId}", scope: "manage" },
  { method: "GET", path: "/events/{eventId}/entries/{entryId}/order", scope: "read" },
  { method: "GET", path: "/events/{eventId}/entries/{entryId}/revisions/{revision}", scope: "read" },
  { method: "POST", path: "/events/{eventId}/entries/{entryId}/review", scope: "manage" },
  { method: "PUT", path: "/events/{eventId}/entries/{entryId}/import-receipt", scope: "importReceipt" },
] as const satisfies readonly { method: string; path: string; scope: IntegrationScope }[];

/* -------------------------------------------------------------------------- */
/* NodeCG → 観客アプリ 公開API                                                  */
/* -------------------------------------------------------------------------- */

export const PUBLISH_BASE_PATH = "/api/internal/publish/v1";
export const PUBLIC_BASE_PATH = "/api/public/v1";

export const PhaseSchema = z.enum(["waiting", "preparing", "playing", "break", "ended"]);
export type Phase = z.infer<typeof PhaseSchema>;
export const SlotStateSchema = z.enum(["pending", "playing", "completed", "skipped", "cancelled"]);
export type SlotState = z.infer<typeof SlotStateSchema>;
export const SlotKindSchema = z.enum(["performance", "break"]);
export type SlotKind = z.infer<typeof SlotKindSchema>;
export const ProgressDelayBasisSchema = z.enum(["nextEstimatedStart", "finalActualEnd", "unavailable"]);
export type ProgressDelayBasis = z.infer<typeof ProgressDelayBasisSchema>;

export const PublicSlotSchema = z.strictObject({
  slotId: IdSchema,
  kind: SlotKindSchema,
  /** 休憩枠は null */
  bandName: z.string().min(1).max(120).nullable(),
  label: z.string().max(120),
  plannedStartAt: IsoDateTimeSchema,
  plannedEndAt: IsoDateTimeSchema,
  actualStartAt: IsoDateTimeSchema.nullable(),
  actualEndAt: IsoDateTimeSchema.nullable(),
  estimatedStartAt: IsoDateTimeSchema.nullable(),
  estimatedEndAt: IsoDateTimeSchema.nullable(),
  /** 開始済みの枠の確定値（実績開始 − 予定開始）。未開始は null */
  startDelaySeconds: z.number().int().nullable(),
  state: SlotStateSchema,
});
export type PublicSlot = z.infer<typeof PublicSlotSchema>;

const PublicSnapshotObjectSchema = z.strictObject({
  schemaVersion: z.literal(SCHEMA_VERSION),
  eventId: IdSchema,
  /** 送信元識別用の公開可能なID。認証トークンではない */
  runtimeId: IdSchema,
  /** NodeCG の publishRevision */
  revision: z.number().int().min(1),
  stateUpdatedAt: IsoDateTimeSchema,
  eventName: z.string().min(1).max(160),
  timeZone: TimeZoneSchema,
  phase: PhaseSchema,
  currentSlotId: IdSchema.nullable(),
  nextSlotId: IdSchema.nullable(),
  progressDelaySeconds: z.number().int().nullable(),
  progressDelayBasis: ProgressDelayBasisSchema,
  youtubeVideoId: YoutubeVideoIdSchema.nullable(),
  publicMessage: z.string().max(500),
  slots: z.array(PublicSlotSchema).max(100),
});

/** 参照整合性・状態の組み合わせを検証する */
export function checkPublicSnapshotIntegrity(snapshot: z.infer<typeof PublicSnapshotObjectSchema>): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  for (const slot of snapshot.slots) {
    if (ids.has(slot.slotId)) problems.push(`slotId ${slot.slotId} が重複しています。`);
    ids.add(slot.slotId);
    if (slot.kind === "break" && slot.bandName !== null) problems.push(`休憩枠 ${slot.slotId} の bandName は null にしてください。`);
    if (slot.kind === "performance" && slot.bandName === null) problems.push(`出演枠 ${slot.slotId} に bandName がありません。`);
    if (Date.parse(slot.plannedEndAt) <= Date.parse(slot.plannedStartAt)) problems.push(`枠 ${slot.slotId} の予定終了が予定開始以前です。`);
    if (slot.actualEndAt && !slot.actualStartAt) problems.push(`枠 ${slot.slotId} に実績開始がないのに実績終了があります。`);
    if (slot.actualStartAt && slot.actualEndAt && Date.parse(slot.actualEndAt) < Date.parse(slot.actualStartAt)) {
      problems.push(`枠 ${slot.slotId} の実績終了が実績開始より前です。`);
    }
    if (slot.state === "playing" && (!slot.actualStartAt || slot.actualEndAt)) problems.push(`実施中の枠 ${slot.slotId} の実績時刻が不整合です。`);
    if (slot.state === "completed" && (!slot.actualStartAt || !slot.actualEndAt)) problems.push(`終了済みの枠 ${slot.slotId} の実績時刻が不足しています。`);
  }
  const current = snapshot.currentSlotId ? snapshot.slots.find((slot) => slot.slotId === snapshot.currentSlotId) : null;
  const next = snapshot.nextSlotId ? snapshot.slots.find((slot) => slot.slotId === snapshot.nextSlotId) : null;
  if (snapshot.currentSlotId && !current) problems.push("currentSlotId が slots に存在しません。");
  if (snapshot.nextSlotId && !next) problems.push("nextSlotId が slots に存在しません。");
  if (next && (next.kind !== "performance" || next.state !== "pending")) problems.push("nextSlotId は未実施の出演枠を指してください。");
  switch (snapshot.phase) {
    case "playing":
      if (!current || current.kind !== "performance" || current.state !== "playing") problems.push("phase=playing の currentSlotId は演奏中の出演枠を指してください。");
      break;
    case "break":
      if (!current || current.kind !== "break" || current.state !== "playing") problems.push("phase=break の currentSlotId は実施中の休憩枠を指してください。");
      break;
    case "preparing":
    case "waiting":
      if (snapshot.currentSlotId !== null) problems.push(`phase=${snapshot.phase} の currentSlotId は null にしてください。`);
      break;
    case "ended":
      if (snapshot.currentSlotId !== null || snapshot.nextSlotId !== null) problems.push("phase=ended の currentSlotId / nextSlotId は null にしてください。");
      break;
  }
  return problems;
}

export const PublicSnapshotSchema = PublicSnapshotObjectSchema.superRefine((snapshot, context) => {
  for (const message of checkPublicSnapshotIntegrity(snapshot)) context.addIssue({ code: "custom", message });
});
export type PublicSnapshot = z.infer<typeof PublicSnapshotSchema>;

/** 公開フィールドだけを列挙して組み直す（保存時・送信時に使う） */
export function pickPublicSnapshot(snapshot: PublicSnapshot): PublicSnapshot {
  return {
    schemaVersion: SCHEMA_VERSION,
    eventId: snapshot.eventId,
    runtimeId: snapshot.runtimeId,
    revision: snapshot.revision,
    stateUpdatedAt: snapshot.stateUpdatedAt,
    eventName: snapshot.eventName,
    timeZone: snapshot.timeZone,
    phase: snapshot.phase,
    currentSlotId: snapshot.currentSlotId,
    nextSlotId: snapshot.nextSlotId,
    progressDelaySeconds: snapshot.progressDelaySeconds,
    progressDelayBasis: snapshot.progressDelayBasis,
    youtubeVideoId: snapshot.youtubeVideoId,
    publicMessage: snapshot.publicMessage,
    slots: snapshot.slots.map((slot) => ({
      slotId: slot.slotId,
      kind: slot.kind,
      bandName: slot.bandName,
      label: slot.label,
      plannedStartAt: slot.plannedStartAt,
      plannedEndAt: slot.plannedEndAt,
      actualStartAt: slot.actualStartAt,
      actualEndAt: slot.actualEndAt,
      estimatedStartAt: slot.estimatedStartAt,
      estimatedEndAt: slot.estimatedEndAt,
      startDelaySeconds: slot.startDelaySeconds,
      state: slot.state,
    })),
  };
}

export const HeartbeatBodySchema = z.strictObject({
  runtimeId: IdSchema,
  sentAt: IsoDateTimeSchema,
});
export type HeartbeatBody = z.infer<typeof HeartbeatBodySchema>;

export const PublishResultDataSchema = z.strictObject({
  eventId: IdSchema,
  runtimeId: IdSchema,
  revision: z.number().int().min(1),
  receivedAt: IsoDateTimeSchema,
  /** 同じ版・同じ内容の再送だった場合 true */
  duplicate: z.boolean(),
});
export const HeartbeatResultDataSchema = z.strictObject({
  eventId: IdSchema,
  runtimeId: IdSchema,
  receivedAt: IsoDateTimeSchema,
});

export const PublicSyncSchema = z.strictObject({
  lastReceivedAt: IsoDateTimeSchema,
  lastHeartbeatAt: IsoDateTimeSchema.nullable(),
  stale: z.boolean(),
});
export const PublicStateDataSchema = z.strictObject({ state: PublicSnapshotSchema, sync: PublicSyncSchema });
export type PublicStateData = z.infer<typeof PublicStateDataSchema>;
export type PublishResultData = z.infer<typeof PublishResultDataSchema>;

export const PublicEventSummarySchema = z.strictObject({
  eventId: IdSchema,
  eventName: z.string(),
  phase: PhaseSchema,
  firstPlannedStartAt: IsoDateTimeSchema.nullable(),
  timeZone: TimeZoneSchema,
});
export const PublicEventsListDataSchema = z.strictObject({ events: z.array(PublicEventSummarySchema) });

/** 公開側の判定定数（初期値） */
export const PUBLIC_TIMING = {
  heartbeatIntervalSeconds: 15,
  staleAfterSeconds: 45,
  clientRefreshSeconds: 10,
  httpTimeoutSeconds: 5,
  retryMaxSeconds: 30,
} as const;
