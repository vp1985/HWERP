-- 019_transformer_inventory_cost_items.sql
-- Erbrachte Leistungen/Kosten je Lagertrafo: Einkaufspreis, Leistungen, Material, Leistungspakete.

SET search_path TO public;

CREATE TABLE IF NOT EXISTS transformer_inventory_cost_items (
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

CREATE INDEX IF NOT EXISTS idx_transformer_inventory_cost_items_position
  ON transformer_inventory_cost_items(inventory_position, sort_order, performed_at);

CREATE INDEX IF NOT EXISTS idx_transformer_inventory_cost_items_asset
  ON transformer_inventory_cost_items(asset_id);
