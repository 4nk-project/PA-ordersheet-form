/**
 * contracts/v1/index.ts から JSON Schema を生成し、チェックサムを更新する。
 * 実行: npx tsx contracts/v1/tools/generate.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import * as contract from "../index";
import { writeChecksums } from "./check.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const outDir = `${root}/json-schema`;
mkdirSync(outDir, { recursive: true });

const targets: Record<string, z.ZodType> = {
  "api-error-response": contract.ApiErrorResponseSchema,
  "live-event": contract.LiveEventDTOSchema,
  "entry": contract.EntryDTOSchema,
  "pa-order": contract.PAOrderDTOSchema,
  "create-event-body": contract.CreateEventBodySchema,
  "patch-event-body": contract.PatchEventBodySchema,
  "create-entry-body": contract.CreateEntryBodySchema,
  "patch-entry-body": contract.PatchEntryBodySchema,
  "issue-invite-body": contract.IssueInviteBodySchema,
  "review-body": contract.ReviewBodySchema,
  "import-receipt-body": contract.ImportReceiptBodySchema,
  "invite-issued-data": contract.InviteIssuedDataSchema,
  "review-result-data": contract.ReviewResultDataSchema,
  "import-receipt-result-data": contract.ImportReceiptResultDataSchema,
  "public-snapshot": contract.PublicSnapshotSchema,
  "heartbeat-body": contract.HeartbeatBodySchema,
  "publish-result-data": contract.PublishResultDataSchema,
  "public-state-data": contract.PublicStateDataSchema,
};

for (const [name, schema] of Object.entries(targets)) {
  const json = z.toJSONSchema(schema, { target: "draft-7", io: "input", unrepresentable: "any" });
  writeFileSync(`${outDir}/${name}.schema.json`, `${JSON.stringify({ $id: `band-live/v1/${name}`, ...json }, null, 2)}\n`);
}
writeChecksums(root);
console.log(`JSON Schema を ${Object.keys(targets).length} 件生成し、チェックサムを更新しました。`);
