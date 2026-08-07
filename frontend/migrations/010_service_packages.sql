-- ============================================================
-- Migration: 010_service_packages.sql
-- Leistungspakete: wiederverwendbare Bündel aus Leistungen, Material und Hinweistexten.
-- ============================================================

SET search_path TO public;

CREATE TABLE IF NOT EXISTS service_packages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_number  TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  description     TEXT,
  category        TEXT,
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  price_mode      TEXT NOT NULL DEFAULT 'sum' CHECK (price_mode IN ('sum', 'fixed')),
  fixed_price     NUMERIC(12,2),
  hint_text       TEXT,
  customer_note   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  checklist_template_ids TEXT[] NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS service_packages_active_idx
  ON service_packages(active, category, name);

CREATE TABLE IF NOT EXISTS service_package_items (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id            UUID NOT NULL REFERENCES service_packages(id) ON DELETE CASCADE,
  type                  TEXT NOT NULL CHECK (type IN ('service', 'material', 'info')),
  service_id            UUID REFERENCES services(id) ON DELETE SET NULL,
  material_id           UUID REFERENCES materials(id) ON DELETE SET NULL,
  description_snapshot  TEXT NOT NULL,
  quantity              NUMERIC(12,4) NOT NULL DEFAULT 0,
  unit_snapshot         TEXT NOT NULL DEFAULT '',
  unit_price_snapshot   NUMERIC(12,2) NOT NULL DEFAULT 0,
  sort_order            INTEGER NOT NULL DEFAULT 100,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT service_package_items_type_ref_chk CHECK (
    (type = 'service' AND service_id IS NOT NULL AND material_id IS NULL)
    OR (type = 'material' AND material_id IS NOT NULL AND service_id IS NULL)
    OR (type = 'info' AND service_id IS NULL AND material_id IS NULL AND quantity = 0 AND unit_price_snapshot = 0)
  )
);

CREATE INDEX IF NOT EXISTS service_package_items_package_id_idx
  ON service_package_items(package_id, sort_order);
