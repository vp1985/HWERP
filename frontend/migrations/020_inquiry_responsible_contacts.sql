-- Anfrage-Zuordnung: Auftraggeber, Standortkunde/Betreiber und Vermittler/Verantwortlicher

SET search_path TO public;

ALTER TABLE inquiries
  ADD COLUMN IF NOT EXISTS site_customer_id UUID REFERENCES customers(id),
  ADD COLUMN IF NOT EXISTS responsible_customer_id UUID REFERENCES customers(id),
  ADD COLUMN IF NOT EXISTS responsible_contact_person_id UUID REFERENCES contact_persons(id),
  ADD COLUMN IF NOT EXISTS commission_relevant BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS inquiries_site_customer_id_idx ON inquiries(site_customer_id);
CREATE INDEX IF NOT EXISTS inquiries_responsible_customer_id_idx ON inquiries(responsible_customer_id);
CREATE INDEX IF NOT EXISTS inquiries_responsible_contact_person_id_idx ON inquiries(responsible_contact_person_id);
