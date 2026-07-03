CREATE TABLE IF NOT EXISTS live_event_comments (
  id TEXT PRIMARY KEY,
  live_event_id TEXT NOT NULL,
  author_name TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (live_event_id) REFERENCES live_events(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS order_comments (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  author_name TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_live_event_comments_live_event_id ON live_event_comments(live_event_id);
CREATE INDEX IF NOT EXISTS idx_order_comments_order_id ON order_comments(order_id);
