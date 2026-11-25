import { z } from "zod";
import { IntegrationScopeSchema, type IntegrationScope } from "@/contracts/v1";
import { getRuntimeEnv } from "@/lib/d1/server";
import { safeEqual, sha256Hex } from "@/lib/crypto";
import { jsonError } from "./http";

/**
 * 連携用トークンの設定（秘密設定 INTEGRATION_TOKENS に JSON で保存する）
 * [{ "id": "nodecg-main", "sha256": "<トークンのSHA-256(hex)>", "scopes": ["read","manage","importReceipt"], "eventIds": ["*"] }]
 * 平文トークンは保存しない。`npm run token:create` で生成できる。
 */
const TokenConfigSchema = z.array(
  z.strictObject({
    id: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
    sha256: z.string().regex(/^[0-9a-f]{64}$/),
    scopes: z.array(IntegrationScopeSchema).min(1),
    eventIds: z.array(z.string().min(1)).min(1),
  }),
);

export type IntegrationPrincipal = { id: string; scopes: IntegrationScope[]; eventIds: string[] };

let cachedSource: string | undefined;
let cachedTokens: z.infer<typeof TokenConfigSchema> = [];

function loadTokens() {
  const source = getRuntimeEnv("INTEGRATION_TOKENS") || "[]";
  if (source !== cachedSource) {
    const parsed = TokenConfigSchema.safeParse(JSON.parse(source));
    cachedTokens = parsed.success ? parsed.data : [];
    cachedSource = source;
    if (!parsed.success) console.error("INTEGRATION_TOKENS の形式が不正です。連携APIはすべて拒否されます。");
  }
  return cachedTokens;
}

export function canAccessEvent(principal: IntegrationPrincipal, eventId: string) {
  return principal.eventIds.includes("*") || principal.eventIds.includes(eventId);
}

const windows = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 300;

function rateLimited(principalId: string, now = Date.now()) {
  const current = windows.get(principalId);
  if (!current || current.resetAt <= now) {
    windows.set(principalId, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  current.count += 1;
  return current.count > RATE_LIMIT;
}

/** Bearerトークンを検証し、権限と対象ライブを確認する。演者用トークンや管理者Cookieは使わない */
export async function authenticate(request: Request, scope: IntegrationScope, eventId?: string): Promise<{ ok: true; principal: IntegrationPrincipal } | { ok: false; response: Response }> {
  const header = request.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+([A-Za-z0-9._~+/=-]{16,512})$/);
  if (!match) return { ok: false, response: jsonError("unauthorized", "認証情報がありません。") };
  let tokens: z.infer<typeof TokenConfigSchema>;
  try {
    tokens = loadTokens();
  } catch {
    return { ok: false, response: jsonError("dependency_unavailable", "連携用トークンの設定を読み込めません。") };
  }
  const hash = await sha256Hex(match[1]);
  const token = tokens.find((item) => safeEqual(item.sha256, hash));
  if (!token) return { ok: false, response: jsonError("unauthorized", "認証情報が無効です。") };
  const principal: IntegrationPrincipal = { id: token.id, scopes: token.scopes, eventIds: token.eventIds };
  if (rateLimited(principal.id)) return { ok: false, response: jsonError("rate_limited", "リクエストが多すぎます。しばらく待ってから再試行してください。") };
  if (!principal.scopes.includes(scope)) return { ok: false, response: jsonError("forbidden", `この操作には ${scope} 権限が必要です。`) };
  if (eventId && !canAccessEvent(principal, eventId)) return { ok: false, response: jsonError("forbidden", "このライブへのアクセス権がありません。") };
  return { ok: true, principal };
}
