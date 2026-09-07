# 別サークル用MVP

## 方針

アプリのコードは現行サークルと共有し、Cloudflare Worker、D1データベース、管理者パスワードだけを別にします。
フォーム、管理画面、CSV出力などの機能は現行環境と同じです。

この構成では、片方のサークルの提出内容がもう片方の管理画面やCSVに表示されることはありません。

## 環境構成

| 項目 | 現行サークル | 別サークル |
| --- | --- | --- |
| Worker | `pa-ordersheet-form` | `pa-ordersheet-form-circle2` |
| D1 | `pa-ordersheet-form` | `pa-ordersheet-form-circle2` |
| Wrangler設定 | `wrangler.jsonc` | `wrangler.circle2.jsonc` |
| 管理者パスワード | 現行WorkerのSecret | 別WorkerのSecret |

別サークル用MVPは次のURLへ公開済みです。

<https://pa-ordersheet-form-circle2.ankoromoti.workers.dev>

## 初回公開

別サークル用D1へテーブルを作成します。

```bash
npm run migrate:circle2:remote
```

別サークル専用の管理者パスワードを登録します。現行サークルとは異なる十分に長いパスワードを指定してください。

```bash
npm run secret:circle2
```

別サークル用Workerを公開します。

```bash
npm run deploy:circle2
```

公開後に表示されるURLを開き、次を確認します。

1. `/` からテスト提出できる
2. `/admin/login` に別サークル専用パスワードでログインできる
3. テスト提出が別サークル側の管理画面だけに表示される
4. CSVに同じテスト提出が含まれる
5. 現行サークルの管理画面にはテスト提出が表示されない

現在は提出フォームの表示と管理者ログインを確認済みで、新しいD1に現行データが混入していないことも確認済みです。実際の提出テストを行う前に、管理画面の「ライブ内容」から正式なライブ名と曲数を追加してください。

## 通常の更新

コードを変更したときは、動作確認後に両方のWorkerを個別に公開します。

```bash
npm run deploy
npm run deploy:circle2
```

新しいマイグレーションを追加した場合は、公開前に両方のD1へ適用します。

```bash
npx wrangler d1 migrations apply DB --remote
npm run migrate:circle2:remote
```

## MVP後に決めること

- `circle2` を正式なサークル名や短い識別名へ変更する
- サークルごとの独自ドメインを設定する
- サークル名や問い合わせ先を画面に表示するか決める
- バックアップと管理者交代時のパスワード更新手順を決める

サークル数が増え、同じ管理者が一括管理したくなった段階で、サークルIDによるマルチテナント化を再検討します。2サークルの段階では、この分離構成のほうが安全で運用も単純です。
