-- 017_asset_inventory_transformer_fields.sql
-- Asset-kompatible Trafo-Lager-/Fremdlager-Schnellanlage.
-- Manuell im Trafo-Lager erfasste Trafos bleiben echte Assets und können später Kunden/Standorten zugeordnet werden.

ALTER TABLE assets
  ADD COLUMN IF NOT EXISTS inventory_owner_type TEXT CHECK (inventory_owner_type IS NULL OR inventory_owner_type IN ('own', 'external')),
  ADD COLUMN IF NOT EXISTS inventory_origin TEXT,
  ADD COLUMN IF NOT EXISTS primary_voltage_kv NUMERIC(10,3),
  ADD COLUMN IF NOT EXISTS secondary_voltage_v NUMERIC(10,3),
  ADD COLUMN IF NOT EXISTS vector_group TEXT,
  ADD COLUMN IF NOT EXISTS construction_type TEXT,
  ADD COLUMN IF NOT EXISTS connection_type TEXT,
  ADD COLUMN IF NOT EXISTS price_note TEXT;

CREATE INDEX IF NOT EXISTS idx_assets_inventory_owner_type ON assets(inventory_owner_type);
CREATE INDEX IF NOT EXISTS idx_assets_internal_asset_id ON assets(internal_asset_id);
