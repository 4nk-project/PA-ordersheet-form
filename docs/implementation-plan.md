# PAオーダーシート Web化 実装プラン

## 目的

スプレッドシート形式のPAオーダーシートをWebフォームに置き換え、提出された内容を管理者だけがバンド単位で確認できるようにする。

## 現在の実装範囲

- 提出者向けフォーム
  - ライブ内容の選択
  - 選択したライブに応じた曲数分のセットリスト入力
  - バンド基本情報
  - メンバーと担当楽器
  - セットリスト
  - 曲ごとの時間、曲調、開始きっかけ、PA要望
  - MC有無と担当
  - マイク本数
  - 音源使用
  - 持ち込み機材
  - バンド全体要望
- 管理者ログイン
  - `ADMIN_PASSWORD` による簡易認証
  - `/admin` 以下をmiddlewareで保護
- 管理画面
  - ライブ内容の追加・削除
  - ライブごとの曲数指定
  - バンド別提出一覧
  - 未確認、確認中、完了のステータス管理
  - バンド詳細
  - メンバー表
  - セットリスト表
  - 曲ごとのPA要望
  - 持ち込み機材
  - 全体要望
  - CSV出力
  - 提出内容の削除
- 開発用保存先
  - `data/orders.json`
  - `data/live-events.json`

## 本番運用で置き換える箇所

現在は開発しやすさを優先してローカルJSONへ保存している。本番では `lib/orders.ts` の関数をSupabase/PostgreSQL実装に差し替える。

想定テーブル:

```sql
create table live_events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  song_count integer not null default 8,
  created_at timestamptz default now()
);

create table orders (
  id uuid primary key default gen_random_uuid(),
  live_event_id uuid references live_events(id),
  live_event_name text,
  live_event_song_count integer not null default 8,
  band_name text not null,
  contact_name text not null,
  microphone_count integer default 0,
  uses_backing_track boolean default false,
  general_request text,
  status text default 'new',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table members (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id) on delete cascade,
  name text,
  instrument text
);

create table songs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id) on delete cascade,
  song_order integer not null,
  title text,
  duration text,
  mood text,
  start_trigger text,
  pa_request text,
  has_mc boolean default false,
  mc_person text
);

create table equipment (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id) on delete cascade,
  name text,
  instrument text
);
```

Supabase Authを使う場合は、管理者ロールを持つユーザーだけが `orders` / `members` / `songs` / `equipment` を読めるRLSを設定する。提出はServer Action経由にして、匿名ユーザーに直接読み取り権限を与えない。

## 次に追加するとよい機能

- 管理者への新規提出通知
- 印刷用レイアウト
- 出演順やイベントごとの絞り込み
- 提出内容の編集・差し戻し
- Supabase Auth + RLS
