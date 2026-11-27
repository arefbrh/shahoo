-- Explicit product-to-encyclopedia mapping.
-- The knowledge schema is imported separately into oil_encyclopedia; this table
-- deliberately has no cross-schema FK so the storefront migrations stay usable
-- in PGlite and before the optional knowledge source is provisioned.

CREATE TABLE oil_product_links (
  product_id TEXT PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
  oil_id TEXT NOT NULL,
  mapping_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (mapping_status IN ('pending', 'approved', 'disabled')),
  mapping_note TEXT NOT NULL DEFAULT '',
  verified_by TEXT REFERENCES admin_users(id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT oil_product_links_approval_check
    CHECK (mapping_status <> 'approved' OR (verified_by IS NOT NULL AND verified_at IS NOT NULL))
);

CREATE UNIQUE INDEX oil_product_links_approved_oil_idx
  ON oil_product_links (oil_id)
  WHERE mapping_status = 'approved';

CREATE INDEX oil_product_links_status_idx
  ON oil_product_links (mapping_status);
