-- Migration 015: Trafo-Lager Overlays für Kalkulationen, Reservierungen, manuelle Details und Anhänge
-- Dynamische HWERP-Workflows hängen per inventory_position am Asset-basierten Lagerbestand.

CREATE TABLE IF NOT EXISTS transformer_inventory_calculation_links (
  id UUID PRIMARY KEY,
  inventory_position TEXT NOT NULL,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  calculation_id UUID NOT NULL REFERENCES calculations(id) ON DELETE CASCADE,
  calculated_at TIMESTAMPTZ NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_transformer_inventory_calculation_links_position
  ON transformer_inventory_calculation_links(inventory_position);

CREATE TABLE IF NOT EXISTS transformer_inventory_reservations (
  id UUID PRIMARY KEY,
  inventory_position TEXT NOT NULL,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  calculation_id UUID REFERENCES calculations(id) ON DELETE SET NULL,
  reserved_from DATE NOT NULL,
  reserved_until DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'released', 'cancelled')),
  note TEXT,
  created_by_user_id TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  CHECK (reserved_until >= reserved_from)
);

CREATE INDEX IF NOT EXISTS idx_transformer_inventory_reservations_position_dates
  ON transformer_inventory_reservations(inventory_position, reserved_from, reserved_until);

CREATE TABLE IF NOT EXISTS transformer_inventory_detail_overrides (
  id TEXT PRIMARY KEY,
  inventory_position TEXT NOT NULL UNIQUE,
  fields JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by_user_id TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS transformer_inventory_attachments (
  id TEXT PRIMARY KEY,
  inventory_position TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('photo', 'document')),
  file_name TEXT NOT NULL,
  mime_type TEXT,
  storage_key TEXT NOT NULL,
  caption TEXT,
  uploaded_by_user_id TEXT,
  uploaded_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_transformer_inventory_attachments_position
  ON transformer_inventory_attachments(inventory_position);
