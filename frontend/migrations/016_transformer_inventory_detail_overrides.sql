-- Migration 016: Manuelle Trafo-Lager Detail-Overrides
-- Import-/Excelwerte bleiben unverändert; HWERP speichert Bearbeitungen als Overlay per HT-Nummer.

CREATE TABLE IF NOT EXISTS transformer_inventory_detail_overrides (
  id UUID PRIMARY KEY,
  inventory_position TEXT NOT NULL UNIQUE,
  fields JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by_user_id TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_transformer_inventory_detail_overrides_position
  ON transformer_inventory_detail_overrides(inventory_position);
