CREATE TABLE IF NOT EXISTS order_fulfillment_work (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  picked_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  picker_name TEXT NOT NULL DEFAULT '',
  checker_name TEXT NOT NULL DEFAULT '',
  package_count INTEGER NOT NULL DEFAULT 1 CHECK (package_count BETWEEN 1 AND 100),
  weight_grams INTEGER CHECK (weight_grams IS NULL OR weight_grams BETWEEN 0 AND 100000),
  discrepancy_note TEXT NOT NULL DEFAULT '',
  updated_by TEXT REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS order_fulfillment_work_updated_idx ON order_fulfillment_work(updated_at DESC);
