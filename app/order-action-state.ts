import type { OrderFieldErrors } from "@/lib/orderSchema";

export type OrderActionState = { fieldErrors: OrderFieldErrors; formError?: string };
export const initialOrderActionState: OrderActionState = { fieldErrors: {} };
