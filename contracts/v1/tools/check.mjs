/**
 * 共通契約のチェックサム照合。
 *   node contracts/v1/tools/check.mjs                 ... 手元の contracts/v1 が CHECKSUMS と一致するか
 *   node contracts/v1/tools/check.mjs --against <dir> ... 別リポジトリの contracts/v1 と内容が一致するか
 *   node contracts/v1/tools/check.mjs --write         ... CHECKSUMS を更新
 */
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const CHECKSUM_FILE = "CHECKSUMS.sha256";

function listFiles(dir, base = dir) {
  return readdirSync(dir)
    .flatMap((name) => {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) return listFiles(full, base);
      const rel = relative(base, full).split("\\").join("/");
      return rel === CHECKSUM_FILE || name === ".DS_Store" ? [] : [rel];
    })
    .sort();
}

export function computeChecksums(dir) {
  return listFiles(dir).map((file) => {
    const content = readFileSync(join(dir, file), "utf8").replace(/\r\n/g, "\n");
    return `${createHash("sha256").update(content).digest("hex")}  ${file}`;
  });
}

export function writeChecksums(dir) {
  writeFileSync(join(dir, CHECKSUM_FILE), `${computeChecksums(dir).join("\n")}\n`);
}

function compare(expected, actual, label) {
  const expectedSet = new Set(expected);
  const actualSet = new Set(actual);
  const missing = expected.filter((line) => !actualSet.has(line));
  const extra = actual.filter((line) => !expectedSet.has(line));
  if (!missing.length && !extra.length) return true;
  console.error(`共通契約の差分を検出しました（${label}）`);
  for (const line of missing) console.error(`  - ${line}`);
  for (const line of extra) console.error(`  + ${line}`);
  return false;
}

function main() {
  const root = fileURLToPath(new URL("..", import.meta.url));
  const args = process.argv.slice(2);
  if (args.includes("--write")) {
    writeChecksums(root);
    console.log("CHECKSUMS.sha256 を更新しました。");
    return;
  }
  const actual = computeChecksums(root);
  const checksumPath = join(root, CHECKSUM_FILE);
  if (!existsSync(checksumPath)) {
    console.error("CHECKSUMS.sha256 がありません。npm run contracts:generate を実行してください。");
    process.exit(1);
  }
  const recorded = readFileSync(checksumPath, "utf8").trim().split("\n").filter(Boolean);
  let ok = compare(recorded, actual, "CHECKSUMS.sha256 と手元のファイル");
  const againstIndex = args.indexOf("--against");
  if (againstIndex >= 0) {
    const other = resolve(args[againstIndex + 1] || "");
    if (!existsSync(other)) {
      console.error(`比較先 ${other} が見つかりません。`);
      process.exit(1);
    }
    ok = compare(computeChecksums(other), actual, `比較先 ${other}`) && ok;
  }
  if (!ok) process.exit(1);
  console.log("共通契約 v1 は一致しています。");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
