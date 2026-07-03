import { getCloudflareContext } from "@opennextjs/cloudflare";

type D1Result<T = unknown> = {
  error?: string;
  results?: T[];
  success: boolean;
};

type D1PreparedStatement = {
  all<T = unknown>(): Promise<D1Result<T>>;
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(): Promise<T | null>;
  run(): Promise<D1Result>;
};

export type D1DatabaseBinding = {
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
  prepare(query: string): D1PreparedStatement;
};

export function getD1Database() {
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
