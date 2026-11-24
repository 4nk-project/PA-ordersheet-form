import type { OrderStatus } from "@/types/order";
import { formatInTimeZone } from "@/lib/time";

export const statusLabels: Record<OrderStatus, string> = {
  new: "未確認",
  reviewing: "確認中",
  done: "確認済み",
};

export function formatDateTime(value: string) {
  return formatInTimeZone(value, "Asia/Tokyo");
}
