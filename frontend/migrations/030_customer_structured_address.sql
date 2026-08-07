-- Store customer/contact addresses as structured fields instead of one free-text blob.
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS street_line TEXT,
  ADD COLUMN IF NOT EXISTS postal_code TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS country TEXT NOT NULL DEFAULT 'Deutschland';

-- Intentionally no fallback/migration from old customers.address: only clean structured data going forward.
ALTER TABLE customers
  DROP COLUMN IF EXISTS address;
