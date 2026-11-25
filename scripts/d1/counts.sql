-- 主要テーブルの件数（移行前後・復元後に比べる）
SELECT 'live_events' AS t, COUNT(*) AS n FROM live_events UNION ALL SELECT 'orders', COUNT(*) FROM orders UNION ALL SELECT 'songs', COUNT(*) FROM songs UNION ALL SELECT 'members', COUNT(*) FROM members UNION ALL SELECT 'equipment', COUNT(*) FROM equipment;
