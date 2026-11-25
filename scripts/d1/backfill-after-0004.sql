-- 0004 適用後に旧バージョンのアプリで作られた提出を、0004 と同じ規則で補う（何度実行しても同じ結果）。
-- 0004 の適用から新しいアプリのデプロイまでの間に、旧フォームから提出された場合に使う。
--   npx wrangler d1 execute DB --remote -c wrangler.jsonc --file scripts/d1/backfill-after-0004.sql
-- 対象：出演エントリーのない提出、版1の履歴のない提出、秒数が未設定の演奏時間。
-- 既に移行済みの提出は変更しない（確認済みの版・エントリーも上書きしない）。

UPDATE orders SET submitter_updated_at = updated_at WHERE submitter_updated_at IS NULL;

UPDATE songs
SET duration_seconds = CAST(substr(trim(duration), 1, instr(trim(duration), ':') - 1) AS INTEGER) * 60
  + CAST(substr(trim(duration), instr(trim(duration), ':') + 1) AS INTEGER)
WHERE duration IS NOT NULL
  AND duration_seconds IS NULL
  AND (
    trim(duration) GLOB '[0-9]:[0-5][0-9]'
    OR trim(duration) GLOB '[0-9][0-9]:[0-5][0-9]'
    OR trim(duration) GLOB '[0-9][0-9][0-9]:[0-5][0-9]'
  );

INSERT INTO event_entries (id, live_event_id, band_name, initial_performance_order, cancelled_at, revision, created_at, updated_at)
SELECT 'ent_' || orders.id, orders.live_event_id, orders.band_name, orders.performance_order, NULL, 1, orders.created_at, orders.updated_at
FROM orders
WHERE orders.entry_id IS NULL
  AND orders.live_event_id IS NOT NULL
  AND orders.live_event_id != ''
  AND EXISTS (SELECT 1 FROM live_events WHERE live_events.id = orders.live_event_id)
  AND NOT EXISTS (SELECT 1 FROM event_entries WHERE event_entries.id = 'ent_' || orders.id);

UPDATE orders
SET entry_id = 'ent_' || id
WHERE entry_id IS NULL
  AND EXISTS (SELECT 1 FROM event_entries WHERE event_entries.id = 'ent_' || orders.id);

UPDATE orders
SET reviewed_revision = 1,
    reviewed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE status = 'done'
  AND reviewed_revision IS NULL
  AND NOT EXISTS (SELECT 1 FROM order_revisions WHERE order_revisions.order_id = orders.id);

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
