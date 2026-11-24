import { ERROR_STATUS, SCHEMA_VERSION, type ErrorCode } from "@/contracts/v1";
import type { z } from "zod";

const baseHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};

export function jsonOk(data: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify({ schemaVersion: SCHEMA_VERSION, data }), { status, headers: { ...baseHeaders, ...extraHeaders } });
}

export function jsonError(code: ErrorCode, message: string, extra: { fieldErrors?: Record<string, string>; currentRevision?: number; status?: number } = {}) {
  const error: Record<string, unknown> = { code, message };
  if (extra.fieldErrors) error.fieldErrors = extra.fieldErrors;
  if (extra.currentRevision !== undefined) error.currentRevision = extra.currentRevision;
  return new Response(JSON.stringify({ schemaVersion: SCHEMA_VERSION, error }), { status: extra.status ?? ERROR_STATUS[code], headers: baseHeaders });
}

export function zodFieldErrors(error: z.ZodError) {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return fieldErrors;
}

/** JSON本文を読み、許可したフィールドだけを持つスキーマで検証する */
export async function readJsonBody<T extends z.ZodType>(request: Request, schema: T): Promise<{ ok: true; data: z.infer<T>; raw: unknown } | { ok: false; response: Response }> {
  let raw: unknown;
  try {
    const text = await request.text();
    if (text.length > 256 * 1024) return { ok: false, response: jsonError("invalid_request", "本文が大きすぎます。") };
    raw = text ? JSON.parse(text) : {};
  } catch {
    return { ok: false, response: jsonError("invalid_request", "JSONを解析できませんでした。") };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { ok: false, response: jsonError("invalid_request", "入力内容が不正です。", { fieldErrors: zodFieldErrors(parsed.error) }) };
  return { ok: true, data: parsed.data, raw };
}
