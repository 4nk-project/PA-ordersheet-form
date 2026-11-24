import type { EntryDTO, LiveEventDTO, OrderContent, PAOrderDTO } from "@/contracts/v1";
import type { AdminEntryRow, LiveEvent, PAOrder } from "@/types/order";

export function toLiveEventDTO(event: LiveEvent): LiveEventDTO {
  return {
    eventId: event.id,
    revision: event.revision,
    name: event.name,
    eventDate: event.eventDate,
    timeZone: event.timeZone,
    submissionDeadlineAt: event.submissionDeadlineAt,
    submissionsOpen: event.submissionsOpen,
    inviteRequired: event.inviteRequired,
    songLimit: event.songCount,
  };
}

export function toEntryDTO(row: AdminEntryRow): EntryDTO {
  return {
    eventId: row.entry.liveEventId,
    entryId: row.entry.id,
    revision: row.entry.revision,
    bandName: row.entry.bandName,
    initialPerformanceOrder: row.entry.initialPerformanceOrder,
    cancelled: Boolean(row.entry.cancelledAt),
    invite: row.invite ? { inviteId: row.invite.id, expiresAt: row.invite.expiresAt, revokedAt: row.invite.revokedAt } : null,
    order: row.order
      ? {
          orderId: row.order.id,
          contentRevision: row.order.contentRevision,
          reviewedRevision: row.order.reviewedRevision,
          reviewStatus: row.order.status,
          submitterUpdatedAt: row.order.submitterUpdatedAt,
          adminUpdatedAt: row.order.adminUpdatedAt,
        }
      : null,
    importReceipts: row.importReceipts,
  };
}

/** 提出DTO。編集トークン・招待トークン・内部コメントは含めない */
export function toPAOrderDTO(
  order: PAOrder,
  entryId: string,
  revision: { revision: number; content: OrderContent; submitterUpdatedAt: string | null; adminUpdatedAt: string | null },
): PAOrderDTO {
  return {
    eventId: order.liveEventId,
    entryId,
    orderId: order.id,
    contentRevision: revision.revision,
    reviewedRevision: order.reviewedRevision,
    reviewedAt: order.reviewedAt,
    bandName: revision.content.bandName,
    contactName: revision.content.contactName,
    microphoneCount: revision.content.microphoneCount,
    usesBackingTrack: revision.content.usesBackingTrack,
    backingTrack: revision.content.backingTrack,
    members: revision.content.members,
    equipment: revision.content.equipment,
    songs: revision.content.songs,
    generalRequest: revision.content.generalRequest,
    submitterUpdatedAt: revision.submitterUpdatedAt || order.submitterUpdatedAt,
    adminUpdatedAt: revision.adminUpdatedAt,
  };
}
