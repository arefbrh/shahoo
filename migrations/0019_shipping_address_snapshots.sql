ALTER TABLE shipping_logs
  ADD COLUMN IF NOT EXISTS sender_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS recipient_snapshot JSONB;
