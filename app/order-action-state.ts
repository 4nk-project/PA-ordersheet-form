import type { OrderFieldErrors } from "@/lib/orderSchema";

export type OrderActionState = {
  fieldErrors: OrderFieldErrors;
  formError?: string;
  /** 別端末・運営による更新と競合した場合の現在の版 */
  conflictRevision?: number;
};
export const initialOrderActionState: OrderActionState = { fieldErrors: {} };
