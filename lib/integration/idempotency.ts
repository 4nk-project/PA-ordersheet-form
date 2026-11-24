import { getD1Database, getRuntimeEnv } from "@/lib/d1/server";
import { decryptText, encryptText, sha256Hex, stableStringify } from "@/lib/crypto";
import { nowIso } from "@/lib/time";
import { jsonError } from "./http";

/** 再送保証期間（初期値24時間） */
export const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

type RecordRow = { request_hash: string; status_code: number; response_body: string | null; encrypted: number; expires_at: string };

export function replayKey() {
  return getRuntimeEnv("INVITE_REPLAY_KEY");
}

/**
 * Idempotency-Key 付きの作成APIを実行する。
 * - 同じキー・同じ本文: 保存した応答を返す
 * - 同じキー・異なる本文: 409
 * - 応答に招待URLを含む場合（sensitive）は INVITE_REPLAY_KEY で暗号化して保存する。鍵がなければ再送には応じず 409 を返す
 */
export async function withIdempotency(
  request: Request,
  principalId: string,
  scope: string,
  body: unknown,
  handler: () => Promise<Response>,
  options: { sensitive?: boolean } = {},
): Promise<Response> {
  const key = request.headers.get("idempotency-key");
  if (!key) return handler();
  if (!/^[A-Za-z0-9_.:-]{8,128}$/.test(key)) return jsonError("invalid_request", "Idempotency-Key の形式が不正です。");

  const db = getD1Database();
  const principal = `${principalId}:${scope}`;
  const requestHash = await sha256Hex(stableStringify(body));
  const now = nowIso();
  await db.prepare("delete from idempotency_records where expires_at < ?").bind(now).run();

  const claimed = await db
    .prepare("insert into idempotency_records (principal, idempotency_key, request_hash, status_code, response_body, encrypted, created_at, expires_at) values (?, ?, ?, 0, NULL, 0, ?, ?) on conflict do nothing")
    .bind(principal, key, requestHash, now, new Date(Date.now() + IDEMPOTENCY_TTL_MS).toISOString())
    .run();

  if (!claimed.meta?.changes) {
    const existing = await db.prepare("select request_hash, status_code, response_body, encrypted, expires_at from idempotency_records where principal = ? and idempotency_key = ?").bind(principal, key).first<RecordRow>();
    if (!existing) return jsonError("idempotency_conflict", "再送記録を確認できませんでした。もう一度お試しください。");
    if (existing.request_hash !== requestHash) return jsonError("idempotency_conflict", "同じ Idempotency-Key が別の内容で使われています。");
    if (existing.status_code === 0) return jsonError("idempotency_conflict", "同じリクエストを処理中です。少し待ってから再送してください。");
    if (!existing.response_body) return jsonError("idempotency_conflict", "この応答は再送できません（再送用の暗号化鍵が未設定）。招待を再発行してください。");
    let body = existing.response_body;
    if (existing.encrypted) {
      const keyText = replayKey();
      if (!keyText) return jsonError("idempotency_conflict", "再送用の暗号化鍵がありません。招待を再発行してください。");
      body = await decryptText(body, keyText);
    }
    return new Response(body, { status: existing.status_code, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "Idempotent-Replayed": "true" } });
  }

  let response: Response;
  try {
    response = await handler();
  } catch (error) {
    await db.prepare("delete from idempotency_records where principal = ? and idempotency_key = ?").bind(principal, key).run();
    throw error;
  }
  if (response.status >= 500) {
    await db.prepare("delete from idempotency_records where principal = ? and idempotency_key = ?").bind(principal, key).run();
    return response;
  }
  const text = await response.clone().text();
  let stored: string | null = text;
  let encrypted = 0;
  if (options.sensitive) {
    const keyText = replayKey();
    if (keyText) {
      stored = await encryptText(text, keyText);
      encrypted = 1;
    } else {
      stored = null;
    }
  }
  await db
    .prepare("update idempotency_records set status_code = ?, response_body = ?, encrypted = ? where principal = ? and idempotency_key = ?")
    .bind(response.status, stored, encrypted, principal, key)
    .run();
  return response;
}
