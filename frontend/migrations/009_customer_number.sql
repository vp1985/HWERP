-- Add customer number generated from the central Kundennummer number range.
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS customer_number TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS customers_customer_number_unique
  ON customers (customer_number)
  WHERE customer_number IS NOT NULL;
