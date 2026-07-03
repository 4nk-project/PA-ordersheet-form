ALTER TABLE orders ADD COLUMN performance_order INTEGER;

UPDATE orders
SET performance_order = (
  SELECT COUNT(*)
  FROM orders AS earlier
  WHERE earlier.live_event_id = orders.live_event_id
    AND (
      earlier.created_at < orders.created_at
      OR (earlier.created_at = orders.created_at AND earlier.id <= orders.id)
    )
)
WHERE live_event_id IS NOT NULL
  AND live_event_id != '';

CREATE INDEX IF NOT EXISTS idx_orders_live_event_performance_order ON orders(live_event_id, performance_order);
