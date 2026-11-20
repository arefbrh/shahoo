-- Batch 09 final remediation: retain the callback/provider reference used
-- for a verification retry without treating it as a verified settlement ref.
ALTER TABLE payment_attempts
  ADD COLUMN IF NOT EXISTS verification_payment_ref_id BIGINT;
