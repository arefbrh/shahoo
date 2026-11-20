-- Batch 07: preserve verifiable inventory movement context going forward.
-- Existing history is intentionally not backfilled: prior on-hand/reserved
-- balances and order foreign keys cannot be reconstructed reliably from delta.
ALTER TABLE inventory_logs
  ADD COLUMN IF NOT EXISTS on_hand_before integer,
  ADD COLUMN IF NOT EXISTS on_hand_after integer,
  ADD COLUMN IF NOT EXISTS reserved_before integer,
  ADD COLUMN IF NOT EXISTS reserved_after integer,
  ADD COLUMN IF NOT EXISTS order_id text REFERENCES orders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS inventory_logs_order_idx ON inventory_logs(order_id);
