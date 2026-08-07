-- Transfer receipts / Übernahmebelege
-- Migration: 023_transfer_receipts.sql
-- PDF-only MVP: receipts + editable item snapshots + generic asset document links.

SET search_path TO public;

CREATE TABLE IF NOT EXISTS transfer_receipts (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number             TEXT NOT NULL UNIQUE,
  type               TEXT NOT NULL CHECK (type IN ('used_devices', 'sf6_switchgear', 'oil_containing_parts')),
  status             TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'final')),
  customer_id         UUID REFERENCES customers(id) ON DELETE SET NULL,
  location_id         UUID REFERENCES locations(id) ON DELETE SET NULL,
  service_date        DATE NOT NULL DEFAULT CURRENT_DATE,
  own_reference       TEXT NOT NULL DEFAULT '',
  customer_reference  TEXT NOT NULL DEFAULT '',
  waste_category      TEXT NOT NULL DEFAULT '16 02 Elektrische und elektronische Geräte und deren Bauteile',
  waste_code          TEXT NOT NULL DEFAULT '16 02 14 Gebrauchte Geräte mit Ausnahme derjenigen, die unter 16 02 09 bis 16 02 13 fallen',
  signed_by           TEXT NOT NULL DEFAULT 'Valentin Polinski',
  signed_place        TEXT NOT NULL DEFAULT 'Cloppenburg',
  signed_date         DATE NOT NULL DEFAULT CURRENT_DATE,
  producer_snapshot   JSONB,
  disposer_snapshot   JSONB,
  finalized_at        TIMESTAMPTZ,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transfer_receipt_items (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id            UUID NOT NULL REFERENCES transfer_receipts(id) ON DELETE CASCADE,
  asset_id              UUID REFERENCES assets(id) ON DELETE SET NULL,
  sort_order            INTEGER NOT NULL DEFAULT 100,
  quantity              NUMERIC(12, 3) NOT NULL DEFAULT 1,
  description           TEXT NOT NULL DEFAULT '',
  manufacturer          TEXT NOT NULL DEFAULT '',
  type_model            TEXT NOT NULL DEFAULT '',
  nominal_power_kva     NUMERIC(10, 3),
  insulating_medium     TEXT NOT NULL DEFAULT '',
  serial_number         TEXT NOT NULL DEFAULT '',
  construction_year     INTEGER,
  total_weight_kg       NUMERIC(12, 3),
  fields_count          INTEGER,
  free_text             TEXT NOT NULL DEFAULT '',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS asset_documents (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id            UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  kind                TEXT NOT NULL CHECK (kind IN ('transfer_receipt', 'photo', 'datasheet', 'test_report', 'protocol', 'invoice', 'delivery_note', 'other')),
  source_entity_type  TEXT,
  source_entity_id    UUID,
  title               TEXT NOT NULL,
  document_number     TEXT,
  status              TEXT NOT NULL DEFAULT 'final' CHECK (status IN ('draft', 'final', 'uploaded')),
  file_url            TEXT,
  metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS transfer_receipts_customer_id_idx ON transfer_receipts(customer_id);
CREATE INDEX IF NOT EXISTS transfer_receipts_location_id_idx ON transfer_receipts(location_id);
CREATE INDEX IF NOT EXISTS transfer_receipt_items_receipt_id_idx ON transfer_receipt_items(receipt_id);
CREATE INDEX IF NOT EXISTS transfer_receipt_items_asset_id_idx ON transfer_receipt_items(asset_id);
CREATE INDEX IF NOT EXISTS asset_documents_asset_id_idx ON asset_documents(asset_id);

CREATE UNIQUE INDEX IF NOT EXISTS asset_documents_transfer_receipt_asset_unique
  ON asset_documents(asset_id, source_entity_id)
  WHERE kind = 'transfer_receipt' AND source_entity_type = 'transferReceipt';
