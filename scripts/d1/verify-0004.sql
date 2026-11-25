-- 0004 移行後の検証。すべて 0 なら正常。
SELECT
  (SELECT COUNT(*) FROM orders WHERE live_event_id IN (SELECT id FROM live_events) AND (entry_id IS NULL OR entry_id NOT IN (SELECT id FROM event_entries))) AS orders_without_entry,
  (SELECT COUNT(*) FROM orders o WHERE NOT EXISTS (SELECT 1 FROM order_revisions r WHERE r.order_id = o.id AND r.revision = 1)) AS orders_without_revision1,
  (SELECT COUNT(*) FROM orders WHERE status = 'done' AND (reviewed_revision IS NULL OR reviewed_revision <> 1)) AS done_not_reviewed,
  (SELECT COUNT(*) FROM orders WHERE status <> 'done' AND reviewed_revision IS NOT NULL) AS undone_marked_reviewed,
  (SELECT COUNT(*) FROM songs WHERE (duration IS NULL OR trim(duration) NOT GLOB '[0-9]*:[0-5][0-9]') AND duration_seconds IS NOT NULL) AS bad_duration_not_null,
  (SELECT COUNT(*) FROM orders WHERE edit_token IS NULL OR edit_token = '') AS edit_token_missing;
