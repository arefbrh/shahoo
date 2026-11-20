-- Batch 09: persist the distributed payment boundary independently of settlement.
-- Historical migrations remain untouched. Provider verification evidence must
-- survive a later local inventory/order transaction failure.
CREATE TABLE IF NOT EXISTS payment_attempts (
  id text PRIMARY KEY,
  order_id text NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  provider text NOT NULL,
  amount_irr bigint NOT NULL,
  currency text NOT NULL DEFAULT 'IRR',
  idempotency_key text NOT NULL UNIQUE,
  provider_request_ref text,
  provider_payment_code text UNIQUE,
  provider_reference_id text UNIQUE,
  state text NOT NULL DEFAULT 'initiated',
  verified_amount_irr bigint,
  verified_at timestamptz,
  settlement_error text,
  reconciliation_required boolean NOT NULL DEFAULT false,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payment_attempts_order_idx ON payment_attempts(order_id);
CREATE INDEX IF NOT EXISTS payment_attempts_state_idx ON payment_attempts(state);
