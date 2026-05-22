import type { OrderStatus } from "@/types/order";

export const statusLabels: Record<OrderStatus, string> = {
  new: "未確認",
  reviewing: "確認中",
  done: "完了",
};

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Tokyo",
  }).format(new Date(value));
}
