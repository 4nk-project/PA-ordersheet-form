import type { ImportReceiptDTO } from "@/contracts/v1";
import type { OrderStatus } from "@/types/order";

/** 一覧・詳細で表示する提出状態 */
export type SubmissionState = "unsubmitted" | "unreviewed" | "reviewing" | "updated" | "reviewed";

export const submissionStateLabels: Record<SubmissionState, string> = {
  unsubmitted: "未提出",
  unreviewed: "未確認",
  reviewing: "確認中",
  updated: "更新あり",
  reviewed: "確認済み",
};

export const submissionStateOrder: SubmissionState[] = ["unsubmitted", "unreviewed", "reviewing", "updated", "reviewed"];

export function submissionStateOf(order: { contentRevision: number; reviewedRevision: number | null; status: OrderStatus } | null): SubmissionState {
  if (!order) return "unsubmitted";
  if (order.reviewedRevision === null) return order.status === "reviewing" ? "reviewing" : "unreviewed";
  if (order.contentRevision > order.reviewedRevision) return "updated";
  return "reviewed";
}

export function submissionStateTone(state: SubmissionState) {
  return state === "reviewed" ? "done" : state === "unsubmitted" ? "" : "warn";
}

export type ImportState =
  | { kind: "unknown"; label: string }
  | { kind: "current"; label: string; receipt: ImportReceiptDTO }
  | { kind: "outdated"; label: string; receipt: ImportReceiptDTO };

/**
 * NodeCGへの取り込み状況。通知（ランタイムID・対象版・最終通知日時）がない場合は推測しない。
 * 複数ランタイムの通知がある場合は最後に受信したものを代表として表示する。
 */
export function importStateOf(receipts: ImportReceiptDTO[], reviewedRevision: number | null): ImportState {
  const latest = [...receipts].sort((a, b) => Date.parse(b.receivedAt) - Date.parse(a.receivedAt))[0];
  if (!latest) return { kind: "unknown", label: "取込状況未確認" };
  if (reviewedRevision !== null && latest.importedRevision < reviewedRevision) {
    return { kind: "outdated", label: `取込版 ${latest.importedRevision}（確認済み版 ${reviewedRevision} は未取込）`, receipt: latest };
  }
  return { kind: "current", label: `取込済み 版${latest.importedRevision}`, receipt: latest };
}

export function inviteStateOf(invite: { expiresAt: string; revokedAt: string | null } | null, now = Date.now()) {
  if (!invite) return { kind: "none" as const, label: "招待未発行" };
  if (invite.revokedAt) return { kind: "revoked" as const, label: "招待失効" };
  if (Date.parse(invite.expiresAt) <= now) return { kind: "expired" as const, label: "招待期限切れ" };
  return { kind: "active" as const, label: "招待済み" };
}
