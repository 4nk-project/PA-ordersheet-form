# ライブ連携（0004）の本番移行と NodeCG 接続手順

`migrations/0004_entries_invites_revisions.sql`（出演エントリー・招待・版履歴・NodeCG連携）を本番 D1 に適用し、NodeCG と接続するための手順です。**本番への適用は運営の判断で行い、この手順書自体は本番を変更しません。**

対象の D1 が「現行」か「別サークル用」かを最初に決め、以下のコマンドの `-c` を合わせてください。コマンドの `DB` は D1 のバインディング名で、設定ファイルから実際のデータベースが決まります。

| 対象 | `-c` | データベース名 |
| --- | --- | --- |
| 現行 | `wrangler.jsonc` | `pa-ordersheet-form` |
| 別サークル用 | `wrangler.circle2.jsonc` | `pa-ordersheet-form-circle2` |

`0004_entries_invites_revisions.sql` を含むブランチ（`feature/live-integration`）をチェックアウトした状態で実行します。

## 1. 移行規則（0004 の内容）

- 既存のライブ・提出・出演順・提出ID・編集トークン（編集URL）は変更しない。
- ライブに紐づく既存提出ごとに出演エントリー `ent_<提出ID>` を作り、移行時点の内容を版1として履歴に保存する（過去の中間版は存在しないため作らない）。
- `status='done'` の既存提出は版1を確認済みとして扱う。それ以外は未確認。
- 「分:秒」として読めない・空の演奏時間は `duration_seconds = NULL`（0秒にしない）。
- 既存ライブは招待不要・受付中のまま（従来のフォームから提出できる）。招待必須にするライブは管理画面で切り替える。

## 2. 事前バックアップ（必須）

```bash
mkdir -p backup
npx wrangler d1 export DB --remote -c wrangler.jsonc --output "backup/before-0004-$(date +%Y%m%d-%H%M).sql"
npx wrangler d1 time-travel info DB -c wrangler.jsonc   # 表示されたブックマークと時刻を控える
npx wrangler d1 execute DB --remote -c wrangler.jsonc --file scripts/d1/counts.sql   # 移行前の件数を控える
```

`backup/` の SQL には個人情報（代表者・メンバー名・編集トークン）が含まれます。Git に入れず、共有しないでください。

## 3. ローカルでのリハーサル（推奨）

本番のバックアップを、手元の**空の**ローカル D1 に流し込んで移行を試します。既存のローカル開発データを消さないよう、別のフォルダで行います。

```bash
git clone https://github.com/4nk-project/PA-ordersheet-form.git pa-rehearsal && cd pa-rehearsal
git checkout <移行するブランチ>
npm ci
npx wrangler d1 execute DB --local --file ../PA-ordersheet-form/backup/before-0004-XXXX.sql -y
npx wrangler d1 migrations list DB --local        # 0004 だけが未適用になっていること
npx wrangler d1 migrations apply DB --local
npx wrangler d1 execute DB --local --file scripts/d1/counts.sql        # 移行前と同じ件数
npx wrangler d1 execute DB --local --file scripts/d1/verify-0004.sql   # すべて 0
npm run dev   # 既存の編集URL（/orders/<トークン>）と管理画面が開けることを確認
```

この手順は 2026-11-25 に、0003 時点の検証用データ（`done`/`new` の提出、正常・空・不正な演奏時間）で通しで確認済みです（件数一致、検証項目すべて 0、バックアップからの復元で件数一致）。

## 4. 本番への適用

1. 提出の締切直前・当日など、提出が集中する時間帯を避ける。
2. 新しいコードをデプロイする**前に** migration を適用する（新しいコードは 0004 の列を前提にする）。Workers Builds で `main` へのマージが本番デプロイになっている場合は、**migration を適用してから PR をマージ**する。

```bash
npx wrangler d1 migrations list DB --remote -c wrangler.jsonc    # 0004 だけが未適用であること
npx wrangler d1 migrations apply DB --remote -c wrangler.jsonc
npx wrangler d1 execute DB --remote -c wrangler.jsonc --file scripts/d1/counts.sql
npx wrangler d1 execute DB --remote -c wrangler.jsonc --file scripts/d1/verify-0004.sql
```

3. 件数が移行前と一致し、検証がすべて 0 なら、アプリをデプロイする。
4. 管理画面で既存の提出が表示され、既存の編集URLが開けることを確認する。

## 5. 戻し方

- **migration の適用中・直後に問題が出た場合**：Time Travel で適用前に戻す。

  ```bash
  npx wrangler d1 time-travel restore DB -c wrangler.jsonc --bookmark <手順2で控えたブックマーク>
  ```

  戻した後は、旧バージョンのアプリをデプロイしたままにする（新しいコードは 0004 の列がないと動かない）。
- Time Travel の保持期間を過ぎた場合は、手順2の SQL を新しい D1 に流し込み、`wrangler.jsonc` の `database_id` を差し替える。

## 6. NodeCG との接続

1. 連携トークンを作る。

   ```bash
   npm run token:create -- --id nodecg-main --scopes read,manage,importReceipt --events "*"
   ```

   表示された平文トークンは NodeCG の `PA_API_TOKEN` にだけ設定する。JSON の要素を PA の秘密設定に保存する。

   ```bash
   npx wrangler secret put INTEGRATION_TOKENS   # 値: [ { "id": "nodecg-main", "sha256": "...", ... } ]
   npx wrangler secret put INVITE_REPLAY_KEY    # openssl rand -base64 32
   ```

2. `PA_PUBLIC_BASE_URL` に演者が開く公開URL（招待URLの先頭）を設定する。
3. NodeCG の `PA_API_BASE_URL` に PA の URL を設定して再起動し、Dashboard の「接続状態」で PA が「正常」になることを確認する。
4. トークンを失効させるときは `INTEGRATION_TOKENS` から該当要素を消す。NodeCG 側には「認証情報が無効です（HTTP 401）」と表示され、取り込み済みの当日データはそのまま使える。

連携API・契約の詳細は `contracts/v1/README.md`、NodeCG 側の運用は `band-management-nodecg/docs/operations.md` を参照。
