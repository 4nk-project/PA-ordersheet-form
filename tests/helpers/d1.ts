import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getPlatformProxy } from "wrangler";
import { setTestD1Database, type D1DatabaseBinding } from "@/lib/d1/server";

/** migrations/*.sql を文として分割する（トリガーの BEGIN〜END は1文として扱う） */
export function splitSql(sql: string) {
  const statements: string[] = [];
  let current: string[] = [];
  let inTrigger = false;
  for (const rawLine of sql.split("\n")) {
    const line = rawLine.replace(/--.*$/, "");
    if (!line.trim()) continue;
    current.push(line);
    if (/^\s*CREATE TRIGGER/i.test(line)) inTrigger = true;
    const ends = inTrigger ? /^\s*END;\s*$/i.test(line) : /;\s*$/.test(line);
    if (ends) {
      statements.push(current.join("\n").trim().replace(/;$/, inTrigger ? ";" : ""));
      current = [];
      inTrigger = false;
    }
  }
  if (current.join("").trim()) statements.push(current.join("\n"));
  return statements;
}

export async function createTestDatabase(options: { seed?: (db: D1DatabaseBinding) => Promise<void>; upTo?: string } = {}) {
  const proxy = await getPlatformProxy<{ DB: D1DatabaseBinding }>({ configPath: "wrangler.jsonc", persist: false });
  const db = proxy.env.DB;
  const dir = join(process.cwd(), "migrations");
  const files = readdirSync(dir).filter((file) => file.endsWith(".sql")).sort();
  let seeded = false;
  for (const file of files) {
    // upTo を指定した場合、そのファイルまで適用した時点で seed を実行する（移行テスト用）
    if (options.seed && options.upTo && !seeded && file > options.upTo) {
      await options.seed(db);
      seeded = true;
    }
    for (const statement of splitSql(readFileSync(join(dir, file), "utf8"))) await db.prepare(statement).run();
  }
  if (options.seed && !seeded) await options.seed(db);
  setTestD1Database(db);
  return {
    db,
    async dispose() {
      setTestD1Database(undefined);
      await proxy.dispose();
    },
  };
}
