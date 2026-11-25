# PA Ordersheet Form

PAオーダーシートの提出をWebで完結し、管理者だけが提出内容を確認できるNext.jsアプリです。

## Run

```bash
npm install
npm run dev
```

## 管理者パスワード

管理者ログイン（`/admin/login`）のパスワードは `ADMIN_PASSWORD` で設定します。

### ローカル開発

`.dev.vars.example` を `.dev.vars` にコピーし、`ADMIN_PASSWORD` を書き換えます（`.dev.vars` は Git に入れません）。未設定のときは開発専用の `admin-pa-2026-dev-only` でログインできます。

```bash
cp .dev.vars.example .dev.vars
```

### 本番（Cloudflare Workers）

Worker の Secret に登録します。パスワードを変えるときも同じコマンドで上書きします。再デプロイは不要です。

```bash
npx wrangler secret put ADMIN_PASSWORD
```

本番で `ADMIN_PASSWORD` が未設定だと管理画面はエラーになります。`ADMIN_SESSION_SECRET`（ログイン状態の署名鍵）が未設定の場合は `ADMIN_PASSWORD` が代わりに使われるため、パスワードを変えるとログイン中の管理者は全員ログアウトされます。

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
