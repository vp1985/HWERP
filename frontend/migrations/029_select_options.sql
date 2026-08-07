-- Generische Auswahllisten für fachliche Dropdowns
-- Migration: 029_select_options.sql

SET search_path TO public;

CREATE TABLE IF NOT EXISTS select_options (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_key    TEXT NOT NULL,
  value       TEXT NOT NULL,
  label       TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 100,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  is_system   BOOLEAN NOT NULL DEFAULT FALSE,
  metadata    JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT select_options_list_value_unique UNIQUE (list_key, value)
);

CREATE INDEX IF NOT EXISTS select_options_list_sort_idx
  ON select_options(list_key, sort_order, label);

-- Diese Dropdowns sind nun Stammdaten-getrieben. Constraints entfernen,
-- damit neue fachliche Optionen ohne Code-/DB-Änderung speicherbar sind.
ALTER TABLE assets DROP CONSTRAINT IF EXISTS assets_trafo_kind_check;
ALTER TABLE assets DROP CONSTRAINT IF EXISTS assets_oil_system_check;
ALTER TABLE assets DROP CONSTRAINT IF EXISTS assets_winding_count_check;
ALTER TABLE asset_documents DROP CONSTRAINT IF EXISTS asset_documents_kind_check;

INSERT INTO select_options (list_key, value, label, sort_order, is_active, is_system, metadata)
VALUES
  ('asset.trafoKind', 'oil', 'Öltransformator', 10, TRUE, TRUE, '{"showOilSystem": true}'::jsonb),
  ('asset.trafoKind', 'cast_resin', 'Gießharztransformator', 20, TRUE, TRUE, '{"showOilSystem": false}'::jsonb),
  ('asset.trafoKind', 'other', 'Sonstige Bauart', 30, TRUE, TRUE, '{"showOilSystem": false}'::jsonb),
  ('asset.oilSystem', 'hermetic', 'Hermetisch verriegelt', 10, TRUE, TRUE, '{}'::jsonb),
  ('asset.oilSystem', 'conservator', 'Ausdehner', 20, TRUE, TRUE, '{}'::jsonb),
  ('asset.oilSystem', 'other', 'Sonstiges Ölsystem', 30, TRUE, TRUE, '{}'::jsonb),
  ('asset.windingCount', '2w', '2W / Zweiwickler Standard', 10, TRUE, TRUE, '{"showSecondaryVoltages": false}'::jsonb),
  ('asset.windingCount', '3w', '3W / Dreiwickler', 20, TRUE, TRUE, '{"showSecondaryVoltages": true}'::jsonb),
  ('asset.windingCount', 'other', 'Sonstige Wicklungszahl', 30, TRUE, TRUE, '{"showSecondaryVoltages": false}'::jsonb),
  ('assetDocument.kind', 'datasheet', 'Datenblatt', 10, TRUE, TRUE, '{}'::jsonb),
  ('assetDocument.kind', 'oil_analysis', 'Ölanalyse', 20, TRUE, TRUE, '{}'::jsonb),
  ('assetDocument.kind', 'test_report', 'Prüfbericht', 30, TRUE, TRUE, '{}'::jsonb),
  ('assetDocument.kind', 'protocol', 'Protokoll', 40, TRUE, TRUE, '{}'::jsonb),
  ('assetDocument.kind', 'invoice', 'Rechnung', 50, TRUE, TRUE, '{}'::jsonb),
  ('assetDocument.kind', 'delivery_note', 'Lieferschein', 60, TRUE, TRUE, '{}'::jsonb),
  ('assetDocument.kind', 'other', 'Sonstiges Dokument', 70, TRUE, TRUE, '{}'::jsonb),
  ('inquiry.status', 'new', 'Neu', 10, TRUE, TRUE, '{}'::jsonb),
  ('inquiry.status', 'triage', 'In Sichtung', 20, TRUE, TRUE, '{}'::jsonb),
  ('inquiry.status', 'waiting_for_customer', 'Warten auf Rückmeldung', 30, TRUE, TRUE, '{}'::jsonb),
  ('inquiry.status', 'ready_for_calculation', 'Bereit fürs Büro', 40, TRUE, TRUE, '{}'::jsonb),
  ('inquiry.status', 'done', 'Erledigt', 50, TRUE, TRUE, '{}'::jsonb),
  ('inquiry.status', 'lost', 'Abgelehnt', 60, TRUE, TRUE, '{}'::jsonb),
  ('inquiry.status', 'archived', 'Archiviert', 70, TRUE, TRUE, '{}'::jsonb),
  ('inquiry.category', '00000000-0000-0000-0000-000000170001', 'Stationswartung', 10, TRUE, TRUE, '{}'::jsonb),
  ('inquiry.category', '00000000-0000-0000-0000-000000170002', 'Störung / Eilfall', 20, TRUE, TRUE, '{}'::jsonb),
  ('inquiry.category', '00000000-0000-0000-0000-000000170003', 'Reparatur / Instandsetzung', 30, TRUE, TRUE, '{}'::jsonb),
  ('inquiry.category', '00000000-0000-0000-0000-000000170004', 'Lieferung / Ersatztrafo', 40, TRUE, TRUE, '{}'::jsonb),
  ('inquiry.category', '00000000-0000-0000-0000-000000170005', 'Prüfung / Messung', 50, TRUE, TRUE, '{}'::jsonb),
  ('inquiry.category', '00000000-0000-0000-0000-000000170099', 'Sonstiges', 990, TRUE, TRUE, '{}'::jsonb)
ON CONFLICT (list_key, value) DO UPDATE SET
  label = EXCLUDED.label,
  sort_order = EXCLUDED.sort_order,
  is_system = TRUE,
  metadata = COALESCE(NULLIF(select_options.metadata, '{}'::jsonb), EXCLUDED.metadata),
  updated_at = NOW();
