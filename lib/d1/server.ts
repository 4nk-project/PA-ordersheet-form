import { getCloudflareContext } from "@opennextjs/cloudflare";

export type D1Result<T = unknown> = {
  error?: string;
  meta?: { changes?: number; last_row_id?: number };
  results?: T[];
  success: boolean;
};

export type D1PreparedStatement = {
  all<T = unknown>(): Promise<D1Result<T>>;
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(): Promise<T | null>;
  run(): Promise<D1Result>;
};

export type D1DatabaseBinding = {
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
  prepare(query: string): D1PreparedStatement;
};

type TestGlobal = typeof globalThis & { __PA_TEST_D1__?: D1DatabaseBinding };

/** テストからローカルD1（wrangler getPlatformProxy）を差し込む */
export function setTestD1Database(db: D1DatabaseBinding | undefined) {
  (globalThis as TestGlobal).__PA_TEST_D1__ = db;
}

export function getD1Database() {
  const testDb = (globalThis as TestGlobal).__PA_TEST_D1__;
  if (testDb) return testDb;

  const env = getCloudflareContext().env as Record<string, unknown>;
  const db = env.DB;

  if (!db) {
    throw new Error("D1 database binding DB is not configured.");
  }

  return db as D1DatabaseBinding;
}

export function assertD1Result(result: D1Result, message: string) {
  if (!result.success) {
    throw new Error(`${message}: ${result.error || "Unknown D1 error"}`);
  }
}

/** process.env または Cloudflare の環境変数・シークレットから文字列を読む */
export function getRuntimeEnv(name: string): string | undefined {
  const processValue = process.env[name];
  if (processValue) return processValue;
  try {
    const cloudflareEnv = getCloudflareContext().env as Record<string, unknown>;
    const value = cloudflareEnv[name];
    return typeof value === "string" ? value : undefined;
  } catch {
    return undefined;
  }
}
