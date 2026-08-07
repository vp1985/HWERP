SET search_path TO public;

ALTER TABLE customer_contact_persons
  ADD COLUMN IF NOT EXISTS is_primary BOOLEAN NOT NULL DEFAULT FALSE;

CREATE UNIQUE INDEX IF NOT EXISTS customer_contact_persons_one_primary_per_contact_idx
  ON customer_contact_persons (contact_person_id)
  WHERE is_primary IS TRUE;
