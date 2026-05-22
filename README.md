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

## Production Note

現在の保存先は開発・検証用のローカルJSONです。本番運用では `lib/orders.ts` の保存処理をSupabase/PostgreSQLへ置き換える想定です。
