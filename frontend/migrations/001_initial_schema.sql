-- hwerp Initial Schema
-- Migration: 001_initial_schema.sql
-- Erstellt alle Basistabellen für HWERP

SET search_path TO public;

-- 1. tags (keine Abhängigkeiten)
CREATE TABLE tags (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT NOT NULL,
  code                TEXT,
  color               TEXT,
  suggested_contexts  TEXT[] NOT NULL DEFAULT '{}',
  blocked_contexts    TEXT[] NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. customers
CREATE TABLE customers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  street_line   TEXT,
  postal_code   TEXT,
  city          TEXT,
  country       TEXT NOT NULL DEFAULT 'Deutschland',
  contact_name  TEXT,
  phone         TEXT,
  email         TEXT,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. contact_persons
CREATE TABLE contact_persons (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name      TEXT NOT NULL,
  last_name       TEXT NOT NULL,
  role            TEXT,
  email           TEXT,
  phone1          TEXT,
  phone2          TEXT,
  phone3          TEXT,
  birthday        DATE,
  personal_notes  TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. locations
CREATE TABLE locations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL,
  address_line      TEXT,
  gps_decimal_lat   DOUBLE PRECISION,
  gps_decimal_lng   DOUBLE PRECISION,
  gps_dms_lat       TEXT,
  gps_dms_lng       TEXT,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. asset_types (self-referencing hierarchy)
CREATE TABLE asset_types (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code            TEXT NOT NULL UNIQUE,
  label           TEXT NOT NULL,
  short           TEXT,
  parent_type_id  UUID REFERENCES asset_types(id),
  sort_order      INTEGER,
  icon            TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. assets (self-referencing hierarchy, TS: AssetNode)
CREATE TABLE assets (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT NOT NULL,
  parent_id           UUID REFERENCES assets(id),
  customer_id         UUID REFERENCES customers(id),
  location_id         UUID REFERENCES locations(id),
  asset_type_id       UUID REFERENCES asset_types(id),
  notes               TEXT,
  customer_asset_id   TEXT,
  internal_asset_id   TEXT,
  build_year          INTEGER,
  total_weight        NUMERIC(10,2),
  manufacturer        TEXT,
  serial_number       TEXT,
  type_model          TEXT,
  power_kva           NUMERIC(10,3),
  trafo_kind          TEXT CHECK (trafo_kind IS NULL OR trafo_kind IN ('oil', 'cast_resin', 'other')),
  oil_system          TEXT CHECK (oil_system IS NULL OR oil_system IN ('hermetic', 'conservator', 'other')),
  winding_count       TEXT CHECK (winding_count IS NULL OR winding_count IN ('2w', '3w', 'other')),
  secondary_voltage1  TEXT,
  secondary_voltage2  TEXT,
  secondary_voltage3  TEXT,
  inventory_owner_type TEXT CHECK (inventory_owner_type IS NULL OR inventory_owner_type IN ('own', 'external')),
  inventory_origin    TEXT,
  primary_voltage_kv  NUMERIC(10,3),
  secondary_voltage_v NUMERIC(10,3),
  vector_group        TEXT,
  construction_type   TEXT,
  connection_type     TEXT,
  price_note          TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. materials
CREATE TABLE materials (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_number  TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  description     TEXT,
  unit            TEXT NOT NULL,
  price           NUMERIC(12,2) NOT NULL,
  supplier        TEXT,
  category        TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. services
CREATE TABLE services (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_number  TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  description     TEXT,
  unit            TEXT NOT NULL,
  price           NUMERIC(12,2) NOT NULL,
  category        TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. calculations
CREATE TABLE calculations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number       TEXT NOT NULL UNIQUE,
  title        TEXT,
  description  TEXT,
  customer_id  UUID REFERENCES customers(id),
  location_id  UUID REFERENCES locations(id),
  asset_id     UUID REFERENCES assets(id),
  status       TEXT NOT NULL DEFAULT 'DRAFT',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. templates (Textvorlagen mit Kategorien)
CREATE TABLE templates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  content     TEXT NOT NULL,
  category    TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. calculation_line_items
-- type='material'  → material_id gesetzt, Preisfelder NOT NULL
-- type='service'   → service_id gesetzt, Preisfelder NOT NULL
-- type='manual'    → kein Katalogeintrag, Preisfelder optional (nullable = reiner Freitext)
-- type='text'      → reiner Freitext ohne Preis (z.B. aus Textvorlage), alle Preisfelder NULL
CREATE TABLE calculation_line_items (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  calculation_id   UUID NOT NULL REFERENCES calculations(id) ON DELETE CASCADE,
  position_number  INTEGER NOT NULL,
  type             TEXT NOT NULL CHECK (type IN ('material', 'service', 'manual', 'text')),
  material_id      UUID REFERENCES materials(id),
  service_id       UUID REFERENCES services(id),
  template_id      UUID REFERENCES templates(id),  -- optional: aus Vorlage eingefügt
  inventory_position TEXT,                         -- stabile Lagerreferenz, z.B. own:HT0001
  description      TEXT NOT NULL,
  quantity         NUMERIC(12,4),                  -- NULL bei type='text'
  unit             TEXT,                           -- NULL bei type='text'
  unit_price       NUMERIC(12,2),                  -- NULL bei type='text' oder manuellem Freitext
  total_price      NUMERIC(12,2),                  -- NULL bei type='text' oder manuellem Freitext
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. sequences (für Kalkulationsnummern, TS: Sequence)
CREATE TABLE sequences (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  next_value  INTEGER NOT NULL DEFAULT 1,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO sequences DEFAULT VALUES;

-- 13. app_settings (Einzelzeile)
CREATE TABLE app_settings (
  id                                          TEXT PRIMARY KEY DEFAULT 'app',
  inheritance_ask_on_customer_contact_change  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at                                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO app_settings DEFAULT VALUES;

-- === M:N-Verknüpfungstabellen ===

-- 14. location_customers
CREATE TABLE location_customers (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id  UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  customer_id  UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (location_id, customer_id)
);

-- 15. customer_contact_persons
CREATE TABLE customer_contact_persons (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id       UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  contact_person_id UUID NOT NULL REFERENCES contact_persons(id) ON DELETE CASCADE,
  is_primary        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (customer_id, contact_person_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS customer_contact_persons_one_primary_per_contact_idx
  ON customer_contact_persons (contact_person_id)
  WHERE is_primary IS TRUE;

-- 16. location_contact_overrides
CREATE TABLE location_contact_overrides (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id       UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  contact_person_id UUID NOT NULL REFERENCES contact_persons(id) ON DELETE CASCADE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (location_id, contact_person_id)
);

-- 17. asset_contact_overrides
CREATE TABLE asset_contact_overrides (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id          UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  contact_person_id UUID NOT NULL REFERENCES contact_persons(id) ON DELETE CASCADE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (asset_id, contact_person_id)
);

-- 18. transformer_inventory_cost_items
CREATE TABLE transformer_inventory_cost_items (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_position TEXT NOT NULL,
  asset_id           UUID REFERENCES assets(id) ON DELETE SET NULL,
  type               TEXT NOT NULL CHECK (type IN ('purchase', 'service', 'material', 'package', 'manual')),
  source_id          UUID,
  description        TEXT NOT NULL,
  quantity           NUMERIC(12,4) NOT NULL DEFAULT 1,
  unit               TEXT NOT NULL DEFAULT 'Pauschal',
  unit_price         NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_price        NUMERIC(12,2) NOT NULL DEFAULT 0,
  performed_at       DATE NOT NULL DEFAULT CURRENT_DATE,
  note               TEXT,
  sort_order         INTEGER NOT NULL DEFAULT 100,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 19. location_tags
CREATE TABLE location_tags (
  location_id  UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  tag_id       UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (location_id, tag_id)
);

-- 19. asset_tags
CREATE TABLE asset_tags (
  asset_id  UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  tag_id    UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (asset_id, tag_id)
);

-- 20. contact_person_tags
CREATE TABLE contact_person_tags (
  contact_person_id  UUID NOT NULL REFERENCES contact_persons(id) ON DELETE CASCADE,
  tag_id             UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (contact_person_id, tag_id)
);
