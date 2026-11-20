-- Batch 09 correction: persist the provider-unit amount and prevent
-- concurrent unresolved PayPing attempts for one order.
ALTER TABLE payment_attempts ADD COLUMN IF NOT EXISTS provider_amount_toman bigint;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM payment_attempts WHERE amount_irr <= 0 OR amount_irr % 10 <> 0) THEN
    RAISE EXCEPTION 'payment_attempts contains non-divisible IRR amounts; reconcile before enabling PayPing';
  END IF;
END $$;

UPDATE payment_attempts
SET provider_amount_toman = amount_irr / 10
WHERE provider_amount_toman IS NULL;

ALTER TABLE payment_attempts ALTER COLUMN provider_amount_toman SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS payment_attempts_one_active_order_idx
  ON payment_attempts(order_id)
  WHERE state IN ('initiated', 'redirect_pending', 'provider_outcome_unknown', 'provider_verified', 'local_settlement_pending', 'settling');
