import type { BackingTrack, ImportReceiptDTO, OrderContent } from "@/contracts/v1";

/** 確認作業用の状態。演奏状態には使わない */
export type OrderStatus = "new" | "reviewing" | "done";

export type Member = {
  id: string;
  name: string;
  instrument: string;
};

export type Song = {
  id: string;
  order: number;
  title: string;
  /** 整数の秒。未入力・解釈不能は null */
  durationSeconds: number | null;
  /** 旧形式の演奏時間（互換表示用） */
  duration: string;
  mood: string;
  startTrigger: string;
  paRequest: string;
  mc: {
    hasMc: boolean;
    person: string;
  };
};

export type Equipment = {
  id: string;
  name: string;
  instrument: string;
  memberId: string | null;
};

export type LiveEvent = {
  id: string;
  name: string;
  songCount: number;
  createdAt: string;
  eventDate: string | null;
  timeZone: string;
  submissionDeadlineAt: string | null;
  submissionsOpen: boolean;
  inviteRequired: boolean;
  revision: number;
  updatedAt: string;
};

export type AdminComment = {
  id: string;
  authorName: string;
  body: string;
  createdAt: string;
};

export type PAOrder = {
  id: string;
  editToken: string;
  entryId: string | null;
  liveEventId: string;
  liveEventName: string;
  liveEventSongCount: number;
  performanceOrder: number | null;
  bandName: string;
  contactName: string;
  microphoneCount: number;
  usesBackingTrack: boolean;
  backingTrack: BackingTrack;
  members: Member[];
  songs: Song[];
  equipment: Equipment[];
  generalRequest: string;
  status: OrderStatus;
  contentRevision: number;
  reviewedRevision: number | null;
  reviewedAt: string | null;
  createdAt: string;
  /** 互換用：最後に何らかの更新があった日時 */
  updatedAt: string;
  submitterUpdatedAt: string;
  adminUpdatedAt: string | null;
};

/** 版履歴の1件 */
export type OrderRevision = {
  orderId: string;
  revision: number;
  content: OrderContent;
  actor: "submitter" | "admin" | "migration";
  submitterUpdatedAt: string | null;
  adminUpdatedAt: string | null;
  createdAt: string;
};

export type EntryInvite = {
  id: string;
  entryId: string;
  expiresAt: string;
  revokedAt: string | null;
  createdAt: string;
};

export type EventEntry = {
  id: string;
  liveEventId: string;
  bandName: string;
  initialPerformanceOrder: number | null;
  cancelledAt: string | null;
  revision: number;
  createdAt: string;
  updatedAt: string;
};

/** 運営一覧の1行（招待済みの未提出も含む） */
export type AdminEntryRow = {
  entry: EventEntry;
  invite: EntryInvite | null;
  order: null | {
    id: string;
    contactName: string;
    songCount: number;
    usesBackingTrack: boolean;
    hasPaRequest: boolean;
    status: OrderStatus;
    contentRevision: number;
    reviewedRevision: number | null;
    reviewedAt: string | null;
    createdAt: string;
    submitterUpdatedAt: string;
    adminUpdatedAt: string | null;
  };
  importReceipts: ImportReceiptDTO[];
};

export type OrderSummary = {
  id: string;
  editToken?: string;
  entryId: string | null;
  liveEventId: string;
  liveEventName: string;
  liveEventSongCount: number;
  performanceOrder: number | null;
  bandName: string;
  contactName: string;
  songCount: number;
  usesBackingTrack: boolean;
  hasPaRequest: boolean;
  status: OrderStatus;
  contentRevision: number;
  reviewedRevision: number | null;
  createdAt: string;
  updatedAt: string;
  submitterUpdatedAt: string;
  adminUpdatedAt: string | null;
};
