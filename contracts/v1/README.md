# 共通API契約 v1

このディレクトリは次の3リポジトリに**同じ内容**で置きます。4つ目の共有リポジトリは作りません。

| リポジトリ | 役割 |
| --- | --- |
| `PA-ordersheet-form` | 連携API（`/api/integration/v1`）の提供元 |
| `band-management-nodecg` | 連携APIの利用、公開APIへの送信元 |
| `band-live-web` | 公開API（`/api/internal/publish/v1`、`/api/public/v1`）の提供元 |

## ファイル

| ファイル | 内容 |
| --- | --- |
| `index.ts` | 型と実行時スキーマ（zod）。`schemaVersion: 1` |
| `diff.ts` | 提出内容の差分（安定IDで追加・変更・削除を識別） |
| `json-schema/*.schema.json` | `index.ts` から生成した JSON Schema（draft-07） |
| `samples/*.json` | 成功・失敗レスポンスのサンプル |
| `contract.test.ts` | サンプルとスキーマの整合テスト |
| `CHECKSUMS.sha256` | 上記ファイルのチェックサム |

## 共通ルール

- JSONキーは camelCase、`schemaVersion: 1`。
- 成功は `{ schemaVersion: 1, data }`、失敗は `{ schemaVersion: 1, error: { code, message, fieldErrors? } }`。
- 時刻は UTC の ISO 8601（末尾 `Z`）。画面で会場のタイムゾーンへ変換する。
- 時間の長さは整数の秒。未入力は `null`（0秒と区別）。
- 行番号・配列インデックスを永続IDにしない。

## PA連携API（ベースパス `/api/integration/v1`、Bearerトークン）

| メソッドとパス | 権限 | 用途 |
| --- | --- | --- |
| `GET /events` | read | アクセス可能なライブ一覧 → `{ events }` |
| `POST /events` | manage | ライブ作成（`Idempotency-Key` 対応）→ `{ event }` |
| `PATCH /events/{eventId}` | manage | ライブ設定変更。`expectedRevision` 必須 → `{ event }` |
| `GET /events/{eventId}/entries` | read | 招待・提出・確認・版・取込通知を含む一覧 → `{ entries }` |
| `POST /events/{eventId}/entries` | manage | 出演エントリー作成（`Idempotency-Key` 対応）→ `{ entry }` |
| `PATCH /events/{eventId}/entries/{entryId}` | manage | バンド名・初期順・取消。`expectedRevision` 必須 → `{ entry }` |
| `POST /events/{eventId}/entries/{entryId}/invites` | manage | 招待発行・再発行（`Idempotency-Key` 対応）→ `{ inviteId, url, expiresAt }` |
| `DELETE /events/{eventId}/entries/{entryId}/invites/{inviteId}` | manage | 招待失効 → `{ inviteId, revokedAt }` |
| `GET /events/{eventId}/entries/{entryId}/order` | read | 現在の提出DTO |
| `GET /events/{eventId}/entries/{entryId}/revisions/{revision}` | read | 特定版の提出DTO |
| `POST /events/{eventId}/entries/{entryId}/review` | manage | `{ expectedRevision }` を確認済みにする |
| `PUT /events/{eventId}/entries/{entryId}/import-receipt` | importReceipt | `{ runtimeId, importedRevision, importedAt }` を通知 |

## 公開API（観客アプリ）

| メソッドとパス | 公開範囲 | 用途 |
| --- | --- | --- |
| `PUT /api/internal/publish/v1/events/{eventId}` | NodeCGサービス認証 | 公開スナップショット全体を置き換える |
| `POST /api/internal/publish/v1/events/{eventId}/heartbeat` | 同上 | `{ runtimeId, sentAt }` で接続状態を更新 |
| `GET /api/public/v1/events/{eventId}` | 読み取り公開 | `{ state, sync: { lastReceivedAt, lastHeartbeatAt, stale } }` |
| `GET /api/public/v1/events` | 読み取り公開 | 公開済みライブの一覧 |

## ステータスコード

400 入力不正 / 401 認証なし・無効 / 403 権限なし・受付終了 / 404 対象なし / 409 版競合 / 410 招待失効・期限切れ / 429 頻度超過 / 503 依存先障害。
エラーコードとの対応は `index.ts` の `ERROR_STATUS` を参照。

## 変更手順

1. どれか1つのリポジトリで `contracts/v1/` を編集する。
2. そのリポジトリで `npm run contracts:generate`（JSON Schema とチェックサムを更新）と `npm test` を実行する。
3. `contracts/v1/` を他の2リポジトリへそのままコピーし、各リポジトリで `npm run contracts:check -- --against <コピー元のcontracts/v1>` を実行する。
4. 破壊的変更は全クライアントへ同時に反映するか、`contracts/v2/` を新設する。
