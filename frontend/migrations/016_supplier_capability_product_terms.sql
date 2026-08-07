-- Add concrete product/search terms to supplier capabilities.
-- Categories answer "which area?"; product_terms answer "which concrete product/variant?".

ALTER TABLE supplier_capabilities
  ADD COLUMN IF NOT EXISTS product_terms TEXT[] NOT NULL DEFAULT '{}';
