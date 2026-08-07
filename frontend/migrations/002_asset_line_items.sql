-- Migration 002: Asset-LineItems in Kalkulationen
-- Erweitert calculation_line_items um 'asset_header' und 'info' Typen
-- sowie eine asset_node_id Spalte für Verknüpfung mit dem Asset-Baum

-- 1. Alten type CHECK entfernen und durch erweiterten ersetzen
ALTER TABLE calculation_line_items
  DROP CONSTRAINT IF EXISTS calculation_line_items_type_check;

ALTER TABLE calculation_line_items
  ADD CONSTRAINT calculation_line_items_type_check
  CHECK (type IN ('material', 'service', 'manual', 'text', 'asset_header', 'info'));

-- 2. Neue Spalte: Verknüpfung zum Asset (nur für type='asset_header')
ALTER TABLE calculation_line_items
  ADD COLUMN IF NOT EXISTS asset_node_id UUID REFERENCES assets(id) ON DELETE SET NULL;
