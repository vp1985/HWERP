-- Inquiry customer contact and reusable scope items
-- Migration: 021_inquiry_customer_contact_and_scope_items.sql
-- Speichert den Ansprechpartner des Rechnungsempfängers und mehrere Asset-/Leistungsabschnitte je Anfrage.

SET search_path TO public;

ALTER TABLE inquiries
  ADD COLUMN IF NOT EXISTS customer_contact_person_id UUID REFERENCES contact_persons(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS inquiry_scope_items (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id       UUID REFERENCES inquiries(id) ON DELETE CASCADE,
  position_number  TEXT,
  parent_id        UUID REFERENCES inquiry_scope_items(id) ON DELETE CASCADE,
  kind             TEXT NOT NULL CHECK (kind IN ('asset_section', 'material', 'service', 'note')),
  asset_id         UUID REFERENCES assets(id) ON DELETE SET NULL,
  material_id      UUID REFERENCES materials(id) ON DELETE SET NULL,
  service_id       UUID REFERENCES services(id) ON DELETE SET NULL,
  title            TEXT NOT NULL,
  quantity         NUMERIC(12, 3) NOT NULL DEFAULT 1,
  unit             TEXT NOT NULL DEFAULT '',
  note             TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS inquiry_scope_items_inquiry_id_idx ON inquiry_scope_items(inquiry_id);
CREATE INDEX IF NOT EXISTS inquiry_scope_items_parent_id_idx ON inquiry_scope_items(parent_id);
CREATE INDEX IF NOT EXISTS inquiry_scope_items_asset_id_idx ON inquiry_scope_items(asset_id);
