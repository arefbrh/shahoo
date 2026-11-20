-- Batch 09 correction: unresolved manual-review attempts remain active and
-- must block a replacement payment for the same order.
DROP INDEX IF EXISTS payment_attempts_one_active_order_idx;
CREATE UNIQUE INDEX payment_attempts_one_active_order_idx
  ON payment_attempts(order_id)
  WHERE state IN ('initiated', 'redirect_pending', 'provider_outcome_unknown', 'provider_verified', 'local_settlement_pending', 'settling', 'manual_review');
