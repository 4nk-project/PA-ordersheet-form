# PA Ordersheet Form

PAオーダーシートの提出をWebで完結し、管理者だけが提出内容を確認できるNext.jsアプリです。

## Run

```bash
npm install
npm run dev
```

管理者ログインの初期パスワードは `admin-pa-2026` です。運用時は `.env.local` に設定してください。

```bash
ADMIN_PASSWORD="your-strong-password"
```

## Pages

- `/` 提出フォーム
- `/thanks` 提出完了
- `/admin/login` 管理者ログイン
- `/admin` 提出一覧
- `/admin/orders/[id]` バンド別詳細

## Database

保存先はCloudflare D1です。D1 bindingは `wrangler.jsonc` の `DB` を使います。

```bash
npx wrangler d1 migrations apply pa-ordersheet-form --local
npx wrangler d1 migrations apply pa-ordersheet-form --remote
```

`0004_entries_invites_revisions.sql`（出演エントリー・招待・版履歴・NodeCG連携）を本番へ適用する前に、バックアップ・リハーサル・検証・戻し方を [docs/live-integration-migration.md](docs/live-integration-migration.md) で確認してください。

## NodeCG 連携

当日進行の NodeCG バンドル（`band-management-nodecg`）は `/api/integration/v1` から確認済みの提出版を取り込みます。トークンの作成と接続手順は [docs/live-integration-migration.md](docs/live-integration-migration.md#6-nodecg-との接続)、API 契約は [contracts/v1/README.md](contracts/v1/README.md) を参照してください。

## 別サークル用MVP

同じコードから、データと管理者ログインを分離した別サークル用Workerを配備できます。

| 環境 | Worker | D1設定 |
| --- | --- | --- |
| 現行サークル | `pa-ordersheet-form` | `wrangler.jsonc` |
| 別サークル | `pa-ordersheet-form-circle2` | `wrangler.circle2.jsonc` |

別サークル用MVP: <https://pa-ordersheet-form-circle2.ankoromoti.workers.dev>

別サークル用の初回セットアップと更新は次のコマンドを使います。

```bash
npm run migrate:circle2:remote
npm run secret:circle2
npm run deploy:circle2
```

詳しい運用手順は [`docs/second-circle-mvp.md`](docs/second-circle-mvp.md) を参照してください。
