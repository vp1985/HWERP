-- Business partner roles: customers can also be suppliers.
-- Keep the existing customers table as the shared organisation table.

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS roles TEXT[] NOT NULL DEFAULT ARRAY['customer']::TEXT[],
  ADD COLUMN IF NOT EXISTS supplier_number TEXT,
  ADD COLUMN IF NOT EXISTS lexoffice_contact_id TEXT,
  ADD COLUMN IF NOT EXISTS lexoffice_customer_number TEXT,
  ADD COLUMN IF NOT EXISTS lexoffice_vendor_number TEXT;

UPDATE customers
SET roles = ARRAY['customer']::TEXT[]
WHERE roles IS NULL OR array_length(roles, 1) IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS customers_supplier_number_unique
  ON customers (supplier_number)
  WHERE supplier_number IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS customers_lexoffice_contact_id_unique
  ON customers (lexoffice_contact_id)
  WHERE lexoffice_contact_id IS NOT NULL;
