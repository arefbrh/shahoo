-- Batch 05: additive customer profile and saved-address recipient fields.
-- Existing customer/address data is preserved; optional demographics stay NULL.
ALTER TABLE customers
  ADD COLUMN first_name TEXT NOT NULL DEFAULT '',
  ADD COLUMN last_name TEXT NOT NULL DEFAULT '',
  ADD COLUMN gender TEXT,
  ADD COLUMN age_group TEXT;

ALTER TABLE customers
  ADD CONSTRAINT customers_gender_check
    CHECK (gender IS NULL OR gender IN ('female', 'male', 'prefer_not_to_say')),
  ADD CONSTRAINT customers_age_group_check
    CHECK (age_group IS NULL OR age_group IN ('under_18', '18_24', '25_34', '35_44', '45_54', '55_plus', 'prefer_not_to_say'));

ALTER TABLE customer_addresses
  ADD COLUMN recipient_name TEXT NOT NULL DEFAULT '',
  ADD COLUMN recipient_mobile TEXT NOT NULL DEFAULT '';

-- Repair legacy duplicate defaults deterministically before enforcing at most one live default.
WITH ranked AS (
  SELECT id,
         row_number() OVER (PARTITION BY customer_id ORDER BY updated_at DESC, created_at DESC, id) AS rank
  FROM customer_addresses
  WHERE is_default = TRUE AND deleted_at IS NULL
)
UPDATE customer_addresses AS address
SET is_default = FALSE
FROM ranked
WHERE address.id = ranked.id AND ranked.rank > 1;

CREATE UNIQUE INDEX customer_addresses_one_default_idx
  ON customer_addresses (customer_id)
  WHERE is_default = TRUE AND deleted_at IS NULL;
