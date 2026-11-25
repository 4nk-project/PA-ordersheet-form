/**
 * NodeCG 連携用のサービストークンを生成する。
 *   node scripts/create-integration-token.mjs --id nodecg-main --scopes read,manage,importReceipt --events "*"
 * 平文トークンは NodeCG 側の PA_API_TOKEN にだけ設定し、PA には SHA-256 を INTEGRATION_TOKENS として保存する。
 */
import { createHash, randomBytes } from "node:crypto";

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};
const id = option("id", "nodecg-main");
const scopes = option("scopes", "read,manage,importReceipt").split(",").map((scope) => scope.trim()).filter(Boolean);
const eventIds = option("events", "*").split(",").map((event) => event.trim()).filter(Boolean);
const allowed = new Set(["read", "manage", "importReceipt"]);
if (!/^[A-Za-z0-9_-]{1,64}$/.test(id) || !scopes.length || scopes.some((scope) => !allowed.has(scope))) {
  console.error("--id は英数字・_・-、--scopes は read,manage,importReceipt から指定してください。");
  process.exit(1);
}
const token = `pa_${randomBytes(32).toString("base64url")}`;
const entry = { id, sha256: createHash("sha256").update(token).digest("hex"), scopes, eventIds };
console.log("NodeCG の PA_API_TOKEN に設定する平文トークン（この表示限り。保存・共有に注意）:");
console.log(token);
console.log("\nPA の INTEGRATION_TOKENS（JSON配列）に追加する要素:");
console.log(JSON.stringify(entry));
console.log("\n例: wrangler secret put INTEGRATION_TOKENS  （値は上の要素を [] で囲んだJSON）");
