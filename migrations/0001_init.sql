CREATE TABLE IF NOT EXISTS live_events (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  song_count INTEGER NOT NULL DEFAULT 8,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  edit_token TEXT NOT NULL UNIQUE,
  live_event_id TEXT,
  live_event_name TEXT,
  live_event_song_count INTEGER NOT NULL DEFAULT 8,
  band_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  microphone_count INTEGER DEFAULT 0,
  uses_backing_track INTEGER DEFAULT 0,
  general_request TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (live_event_id) REFERENCES live_events(id)
);

CREATE TABLE IF NOT EXISTS members (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  name TEXT,
  instrument TEXT,
  position INTEGER DEFAULT 0,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS songs (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  song_order INTEGER NOT NULL,
  title TEXT,
  duration TEXT,
  mood TEXT,
  start_trigger TEXT,
  pa_request TEXT,
  has_mc INTEGER DEFAULT 0,
  mc_person TEXT,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS equipment (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  name TEXT,
  instrument TEXT,
  position INTEGER DEFAULT 0,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_live_event_id ON orders(live_event_id);
CREATE INDEX IF NOT EXISTS idx_members_order_id ON members(order_id);
CREATE INDEX IF NOT EXISTS idx_songs_order_id ON songs(order_id);
CREATE INDEX IF NOT EXISTS idx_equipment_order_id ON equipment(order_id);
