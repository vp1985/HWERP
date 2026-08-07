-- Anfragekategorien für das HWERP-Anfragemodul
-- Migration: 017_inquiry_categories.sql

SET search_path TO public;

CREATE TABLE IF NOT EXISTS inquiry_master_data_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS inquiry_master_data_categories_name_idx
  ON inquiry_master_data_categories (LOWER(name));
CREATE INDEX IF NOT EXISTS inquiry_master_data_categories_active_sort_idx
  ON inquiry_master_data_categories (active, sort_order, name);

ALTER TABLE inquiries
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES inquiry_master_data_categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS inquiries_category_id_idx ON inquiries(category_id);

INSERT INTO inquiry_master_data_categories
  (id, name, description, active, sort_order)
VALUES
  ('00000000-0000-0000-0000-000000170001', 'Stationswartung', 'Wartung, Prüfung und Service an Stationen oder Transformatoren vor Ort.', TRUE, 10),
  ('00000000-0000-0000-0000-000000170002', 'Störung / Eilfall', 'Akute Störungen, Ausfälle oder dringende technische Klärungen.', TRUE, 20),
  ('00000000-0000-0000-0000-000000170003', 'Reparatur / Instandsetzung', 'Reparatur, Instandsetzung oder Werkstattklärung.', TRUE, 30),
  ('00000000-0000-0000-0000-000000170004', 'Lieferung / Ersatztrafo', 'Lieferanfragen, Ersatzgeräte und Transformatorbereitstellung.', TRUE, 40),
  ('00000000-0000-0000-0000-000000170005', 'Prüfung / Messung', 'Technische Prüfungen, Messungen und Dokumentationsanforderungen.', TRUE, 50),
  ('00000000-0000-0000-0000-000000170099', 'Sonstiges', 'Nicht eindeutig zugeordnete Anfrage.', TRUE, 990)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  active = EXCLUDED.active,
  sort_order = EXCLUDED.sort_order,
  updated_at = NOW();
