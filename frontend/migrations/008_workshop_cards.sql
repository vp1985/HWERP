-- Arbeitsvorbereitung / Trafo-Werkstattkarten Postgres foundation
-- Migration: 008_workshop_cards.sql
-- Persistiert Werkstattkarten und je-Karte-Leistungen server-/DB-seitig.
-- Die auswählbaren Leistungen liegen als Stammdaten in der bestehenden Tabelle services.

SET search_path TO public;

-- Stammdaten: Services sind in HWERP die Leistungen. Diese Zusatzfelder steuern,
-- ob und wie eine Leistung in Trafo-Werkstattkarten verfügbar ist.
ALTER TABLE services ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE services ADD COLUMN IF NOT EXISTS available_in_workshop_cards BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE services ADD COLUMN IF NOT EXISTS workshop_category TEXT;
ALTER TABLE services ADD COLUMN IF NOT EXISTS workshop_required BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE services ADD COLUMN IF NOT EXISTS workshop_photo_required BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE services ADD COLUMN IF NOT EXISTS workshop_protocol_required BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE services ADD COLUMN IF NOT EXISTS workshop_measurements_required BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE services ADD COLUMN IF NOT EXISTS workshop_material_entry_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE services ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 100;
ALTER TABLE services ADD COLUMN IF NOT EXISTS checklist_template_ids TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS services_workshop_available_idx
  ON services(active, available_in_workshop_cards, category, sort_order, name);

INSERT INTO services
  (
    service_number,
    name,
    description,
    unit,
    price,
    category,
    active,
    available_in_workshop_cards,
    workshop_category,
    workshop_required,
    workshop_photo_required,
    workshop_protocol_required,
    workshop_measurements_required,
    workshop_material_entry_enabled,
    sort_order
  )
VALUES
  ('SL0001', 'Eingangsprüfung', 'Standard-Leistung für Trafo-Werkstattkarten', 'Pauschal', 0, 'TX-Standsätze', TRUE, TRUE, 'Prüfung', TRUE, FALSE, TRUE, TRUE, FALSE, 10),
  ('SL0002', 'Sichtprüfung', 'Sichtprüfung mit optionaler Fotodokumentation', 'Pauschal', 0, 'TX-Standsätze', TRUE, TRUE, 'Prüfung', TRUE, TRUE, FALSE, FALSE, FALSE, 20),
  ('SL0003', 'Elektrische Prüfung', 'Elektrische Prüfung mit Messwerten und Protokoll', 'Pauschal', 0, 'TX-Standsätze', TRUE, TRUE, 'Prüfung', TRUE, FALSE, TRUE, TRUE, FALSE, 30),
  ('SL0004', 'Hochspannungsprüfung', 'Hochspannungsprüfung mit Prüfprotokoll', 'Pauschal', 0, 'TX-Standsätze', TRUE, TRUE, 'Prüfung', TRUE, FALSE, TRUE, TRUE, FALSE, 40),
  ('SL0005', 'Ausgangsprüfung', 'Abschlussprüfung vor Rückgabe oder Versand', 'Pauschal', 0, 'TX-Standsätze', TRUE, TRUE, 'Prüfung', TRUE, FALSE, TRUE, TRUE, FALSE, 50),
  ('SL0006', 'Reinigung', 'Werkstattleistung Reinigung', 'Pauschal', 0, 'TX-Standsätze', TRUE, TRUE, 'Werkstatt', FALSE, FALSE, FALSE, FALSE, TRUE, 60),
  ('SL0007', 'Ölprobe', 'Ölprobe mit Foto-/Protokollpflicht bei Bedarf', 'Pauschal', 0, 'TX-Standsätze', TRUE, TRUE, 'Prüfung', FALSE, TRUE, TRUE, TRUE, FALSE, 70),
  ('SL0008', 'Fotodokumentation', 'Fotodokumentation der Werkstattkarte', 'Pauschal', 0, 'TX-Standsätze', TRUE, TRUE, 'Dokumentation', FALSE, TRUE, FALSE, FALSE, FALSE, 80)
ON CONFLICT (service_number) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  unit = EXCLUDED.unit,
  category = EXCLUDED.category,
  active = EXCLUDED.active,
  available_in_workshop_cards = EXCLUDED.available_in_workshop_cards,
  workshop_category = EXCLUDED.workshop_category,
  workshop_required = EXCLUDED.workshop_required,
  workshop_photo_required = EXCLUDED.workshop_photo_required,
  workshop_protocol_required = EXCLUDED.workshop_protocol_required,
  workshop_measurements_required = EXCLUDED.workshop_measurements_required,
  workshop_material_entry_enabled = EXCLUDED.workshop_material_entry_enabled,
  sort_order = EXCLUDED.sort_order,
  updated_at = NOW();

-- Legacy-kompatible Vorlagentabelle bleibt leer/optional. Source of truth sind services.
CREATE TABLE IF NOT EXISTS workshop_task_templates (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                     TEXT NOT NULL,
  category                 TEXT NOT NULL DEFAULT 'Allgemein',
  sort_order               INTEGER NOT NULL DEFAULT 100,
  required                 BOOLEAN NOT NULL DEFAULT TRUE,
  photo_required           BOOLEAN NOT NULL DEFAULT FALSE,
  protocol_required        BOOLEAN NOT NULL DEFAULT FALSE,
  measurements_required    BOOLEAN NOT NULL DEFAULT FALSE,
  material_entry_enabled   BOOLEAN NOT NULL DEFAULT FALSE,
  active                   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS workshop_task_templates_active_sort_idx
  ON workshop_task_templates(active, sort_order, name);

CREATE TABLE IF NOT EXISTS workshop_cards (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_number          TEXT NOT NULL UNIQUE,
  title                TEXT NOT NULL,
  order_number         TEXT NOT NULL,
  asset_id             UUID REFERENCES assets(id) ON DELETE SET NULL,
  customer_id          UUID REFERENCES customers(id) ON DELETE SET NULL,
  status               TEXT NOT NULL DEFAULT 'draft',
  assignee_codes       TEXT[] NOT NULL DEFAULT '{}',
  qr_code_token        TEXT NOT NULL DEFAULT gen_random_uuid()::TEXT,
  notes                TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT workshop_cards_status_check CHECK (status IN (
    'draft', 'prepared', 'in_progress', 'done', 'checked', 'archived'
  ))
);

CREATE INDEX IF NOT EXISTS workshop_cards_status_idx ON workshop_cards(status);
CREATE INDEX IF NOT EXISTS workshop_cards_order_number_idx ON workshop_cards(order_number);
CREATE INDEX IF NOT EXISTS workshop_cards_asset_id_idx ON workshop_cards(asset_id);

CREATE TABLE IF NOT EXISTS workshop_card_tasks (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id                UUID NOT NULL REFERENCES workshop_cards(id) ON DELETE CASCADE,
  template_id            UUID REFERENCES workshop_task_templates(id) ON DELETE SET NULL,
  service_id             UUID REFERENCES services(id) ON DELETE SET NULL,
  title                  TEXT NOT NULL,
  sort_order             INTEGER NOT NULL DEFAULT 100,
  status                 TEXT NOT NULL DEFAULT 'open',
  required               BOOLEAN NOT NULL DEFAULT TRUE,
  photo_required         BOOLEAN NOT NULL DEFAULT FALSE,
  protocol_required      BOOLEAN NOT NULL DEFAULT FALSE,
  blocked_by_task_id     UUID REFERENCES workshop_card_tasks(id) ON DELETE SET NULL,
  blocked_reason         TEXT,
  started_at             TIMESTAMPTZ,
  finished_at            TIMESTAMPTZ,
  employee_code          TEXT,
  signature_name         TEXT,
  notes                  TEXT,
  measurement_summary    TEXT,
  material_summary       TEXT,
  completed_at           TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT workshop_card_tasks_status_check CHECK (status IN ('open', 'blocked', 'done')),
  CONSTRAINT workshop_card_tasks_time_order_check CHECK (
    started_at IS NULL OR finished_at IS NULL OR finished_at >= started_at
  )
);

CREATE INDEX IF NOT EXISTS workshop_card_tasks_card_sort_idx ON workshop_card_tasks(card_id, sort_order, title);
CREATE INDEX IF NOT EXISTS workshop_card_tasks_status_idx ON workshop_card_tasks(status);
CREATE INDEX IF NOT EXISTS workshop_card_tasks_service_id_idx ON workshop_card_tasks(service_id);
