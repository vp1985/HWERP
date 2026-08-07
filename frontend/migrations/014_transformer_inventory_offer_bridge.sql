-- Migration 014: Stabile Lagerreferenz an Kalkulationspositionen
-- Ermöglicht Angebots-/Kalkulationspositionen aus asset-basierten Lagertrafos.

ALTER TABLE calculation_line_items
  ADD COLUMN IF NOT EXISTS inventory_position TEXT;

CREATE INDEX IF NOT EXISTS idx_calculation_line_items_inventory_position
  ON calculation_line_items(inventory_position);
