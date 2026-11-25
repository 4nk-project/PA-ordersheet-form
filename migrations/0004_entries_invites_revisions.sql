-- 0004: 出演エントリー・招待・提出の版管理・NodeCG連携
-- 既存のライブ・提出を保ったまま、提出ごとに出演エントリーと初版の履歴を作る。
-- 既存の出演順(performance_order)・提出ID・編集トークンは変更しない。
-- 移行規則:
--   * live_event_id が存在するライブを指す提出ごとに、エントリー `ent_<提出ID>` を作る。
--   * すべての既存提出の内容版(content_revision)を1とし、移行時点の内容を版1の履歴として保存する。
--     過去の中間版は存在しないため復元しない。
--   * status='done' の既存提出は、移行時点の版1を確認済み(reviewed_revision=1)として扱う。
--   * 既存の duration が「分:秒」として解釈できない・空の場合、duration_seconds は NULL（0秒にしない）。
--   * 既存の機材の member_id は NULL。instrument の表示は残す。
--   * 既存ライブは招待不要(invite_required=0)・受付中のまま。従来のフォームから提出できる。

-- ライブ設定の拡張 ------------------------------------------------------------
ALTER TABLE live_events ADD COLUMN event_date TEXT;
ALTER TABLE live_events ADD COLUMN time_zone TEXT NOT NULL DEFAULT 'Asia/Tokyo';
ALTER TABLE live_events ADD COLUMN submission_deadline_at TEXT;
ALTER TABLE live_events ADD COLUMN submissions_open INTEGER NOT NULL DEFAULT 1;
ALTER TABLE live_events ADD COLUMN invite_required INTEGER NOT NULL DEFAULT 0;
ALTER TABLE live_events ADD COLUMN revision INTEGER NOT NULL DEFAULT 1;
ALTER TABLE live_events ADD COLUMN updated_at TEXT;
UPDATE live_events SET updated_at = created_at WHERE updated_at IS NULL;

-- 出演エントリー ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS event_entries (
  id TEXT PRIMARY KEY,
  live_event_id TEXT NOT NULL,
  band_name TEXT NOT NULL,
  initial_performance_order INTEGER,
  cancelled_at TEXT,
  revision INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (live_event_id) REFERENCES live_events(id)
);
CREATE INDEX IF NOT EXISTS idx_event_entries_live_event ON event_entries(live_event_id, initial_performance_order);

-- 招待（トークンはハッシュのみ保存） ---------------------------------------------
CREATE TABLE IF NOT EXISTS entry_invites (
  id TEXT PRIMARY KEY,
  entry_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (entry_id) REFERENCES event_entries(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_entry_invites_entry ON entry_invites(entry_id, created_at);
-- 1エントリーにつき失効していない招待は1件まで
CREATE UNIQUE INDEX IF NOT EXISTS idx_entry_invites_active ON entry_invites(entry_id) WHERE revoked_at IS NULL;

-- 提出の版管理 -----------------------------------------------------------------
ALTER TABLE orders ADD COLUMN entry_id TEXT REFERENCES event_entries(id);
ALTER TABLE orders ADD COLUMN content_revision INTEGER NOT NULL DEFAULT 1;
ALTER TABLE orders ADD COLUMN reviewed_revision INTEGER;
ALTER TABLE orders ADD COLUMN reviewed_at TEXT;
ALTER TABLE orders ADD COLUMN submitter_updated_at TEXT;
ALTER TABLE orders ADD COLUMN admin_updated_at TEXT;
ALTER TABLE orders ADD COLUMN backing_track_operator TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN backing_track_device TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN backing_track_connection TEXT NOT NULL DEFAULT '';
-- 1エントリーの有効な提出は1件まで
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_entry_id ON orders(entry_id);

ALTER TABLE songs ADD COLUMN duration_seconds INTEGER;
ALTER TABLE equipment ADD COLUMN member_id TEXT;

CREATE TABLE IF NOT EXISTS order_revisions (
  order_id TEXT NOT NULL,
  revision INTEGER NOT NULL,
  content_json TEXT NOT NULL,
  actor TEXT NOT NULL CHECK (actor IN ('submitter', 'admin', 'migration')),
  submitter_updated_at TEXT,
  admin_updated_at TEXT,
  created_at TEXT NOT NULL,
  PRIMARY KEY (order_id, revision),
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

-- 提出・更新の再送照合（submissionId） ------------------------------------------
CREATE TABLE IF NOT EXISTS submission_records (
  submission_id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  entry_id TEXT,
  request_hash TEXT NOT NULL,
  result_revision INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

-- NodeCGからの取り込み通知 -------------------------------------------------------
CREATE TABLE IF NOT EXISTS import_receipts (
  entry_id TEXT NOT NULL,
  runtime_id TEXT NOT NULL,
  imported_revision INTEGER NOT NULL,
  imported_at TEXT NOT NULL,
  received_at TEXT NOT NULL,
  PRIMARY KEY (entry_id, runtime_id),
  FOREIGN KEY (entry_id) REFERENCES event_entries(id) ON DELETE CASCADE
);

-- 連携APIの Idempotency-Key 再送記録（招待URLを含む応答は暗号化して保存） --------------
CREATE TABLE IF NOT EXISTS idempotency_records (
  principal TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  response_body TEXT,
  encrypted INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  PRIMARY KEY (principal, idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_idempotency_records_expires ON idempotency_records(expires_at);

-- D1 batch 内の楽観ロック用。条件不成立時に NOT NULL 制約違反でバッチ全体を失敗させる。
CREATE TABLE IF NOT EXISTS write_guards (
  id TEXT PRIMARY KEY,
  ok INTEGER NOT NULL
);

-- 提出とエントリーのライブが一致しない書き込みを拒否する
CREATE TRIGGER IF NOT EXISTS trg_orders_entry_event_insert
BEFORE INSERT ON orders
WHEN NEW.entry_id IS NOT NULL
  AND NEW.live_event_id IS NOT (SELECT live_event_id FROM event_entries WHERE id = NEW.entry_id)
BEGIN
  SELECT RAISE(ABORT, 'order live_event_id does not match entry');
END;

CREATE TRIGGER IF NOT EXISTS trg_orders_entry_event_update
BEFORE UPDATE OF entry_id, live_event_id ON orders
WHEN NEW.entry_id IS NOT NULL
  AND NEW.live_event_id IS NOT (SELECT live_event_id FROM event_entries WHERE id = NEW.entry_id)
BEGIN
  SELECT RAISE(ABORT, 'order live_event_id does not match entry');
END;

-- 既存データの移行 ---------------------------------------------------------------
UPDATE orders SET submitter_updated_at = updated_at WHERE submitter_updated_at IS NULL;

UPDATE songs
SET duration_seconds = CAST(substr(trim(duration), 1, instr(trim(duration), ':') - 1) AS INTEGER) * 60
  + CAST(substr(trim(duration), instr(trim(duration), ':') + 1) AS INTEGER)
WHERE duration IS NOT NULL
  AND (
    trim(duration) GLOB '[0-9]:[0-5][0-9]'
    OR trim(duration) GLOB '[0-9][0-9]:[0-5][0-9]'
    OR trim(duration) GLOB '[0-9][0-9][0-9]:[0-5][0-9]'
  );

INSERT INTO event_entries (id, live_event_id, band_name, initial_performance_order, cancelled_at, revision, created_at, updated_at)
SELECT 'ent_' || orders.id, orders.live_event_id, orders.band_name, orders.performance_order, NULL, 1, orders.created_at, orders.updated_at
FROM orders
WHERE orders.live_event_id IS NOT NULL
  AND orders.live_event_id != ''
  AND EXISTS (SELECT 1 FROM live_events WHERE live_events.id = orders.live_event_id);

UPDATE orders
SET entry_id = 'ent_' || id
WHERE EXISTS (SELECT 1 FROM event_entries WHERE event_entries.id = 'ent_' || orders.id);

UPDATE orders
SET reviewed_revision = 1,
    reviewed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE status = 'done';

INSERT INTO order_revisions (order_id, revision, content_json, actor, submitter_updated_at, admin_updated_at, created_at)
SELECT
  orders.id,
  1,
  json_object(
    'bandName', orders.band_name,
    'contactName', coalesce(orders.contact_name, ''),
    'microphoneCount', coalesce(orders.microphone_count, 0),
    'usesBackingTrack', CASE WHEN orders.uses_backing_track THEN json('true') ELSE json('false') END,
    'backingTrack', CASE WHEN orders.uses_backing_track
      THEN json_object('operator', '', 'device', '', 'connection', '')
      ELSE json('null') END,
    'members', json(coalesce((
      SELECT json_group_array(json_object('id', m.id, 'name', coalesce(m.name, ''), 'instrument', coalesce(m.instrument, '')))
      FROM (SELECT * FROM members WHERE members.order_id = orders.id ORDER BY position, id) AS m
    ), '[]')),
    'equipment', json(coalesce((
      SELECT json_group_array(json_object('id', e.id, 'name', coalesce(e.name, ''), 'instrument', coalesce(e.instrument, ''), 'memberId', json('null')))
      FROM (SELECT * FROM equipment WHERE equipment.order_id = orders.id ORDER BY position, id) AS e
    ), '[]')),
    'songs', json(coalesce((
      SELECT json_group_array(json_object(
        'id', s.id,
        'order', s.song_order,
        'title', coalesce(s.title, ''),
        'durationSeconds', s.duration_seconds,
        'mood', coalesce(s.mood, ''),
        'startTrigger', coalesce(s.start_trigger, ''),
        'paRequest', coalesce(s.pa_request, ''),
        'mc', json_object('hasMc', CASE WHEN s.has_mc THEN json('true') ELSE json('false') END, 'person', coalesce(s.mc_person, ''))
      ))
      FROM (SELECT * FROM songs WHERE songs.order_id = orders.id ORDER BY song_order, id) AS s
    ), '[]')),
    'generalRequest', coalesce(orders.general_request, '')
  ),
  'migration',
  orders.submitter_updated_at,
  NULL,
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM orders
WHERE NOT EXISTS (SELECT 1 FROM order_revisions WHERE order_revisions.order_id = orders.id AND order_revisions.revision = 1);
