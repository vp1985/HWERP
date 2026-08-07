-- Migration 004: Hierarchische Positionsstruktur
-- - asset_header_id: explizite Parent-Referenz
-- - position_number: INTEGER → TEXT (für hierarchische Nummern wie "1.1")

-- 1. asset_header_id Spalte hinzufügen
ALTER TABLE calculation_line_items
  ADD COLUMN IF NOT EXISTS asset_header_id UUID
    REFERENCES calculation_line_items(id) ON DELETE SET NULL;

-- 2. position_number: INTEGER → TEXT
--    Schritt A: neue TEXT-Spalte anlegen
ALTER TABLE calculation_line_items
  ADD COLUMN IF NOT EXISTS position_number_text TEXT;

--    Schritt B: Daten migrieren (bestehende Zahlen als String)
UPDATE calculation_line_items
  SET position_number_text = position_number::TEXT
  WHERE position_number IS NOT NULL;

--    Schritt C: alte Spalte löschen, neue umbenennen
ALTER TABLE calculation_line_items DROP COLUMN position_number;
ALTER TABLE calculation_line_items RENAME COLUMN position_number_text TO position_number;

-- 3. Backfill asset_header_id aus impliziter Reihenfolge
--    (pro calculation_id: jedes Non-Header-Item bekommt den letzten Header vor ihm)
WITH ordered AS (
  SELECT
    id,
    calculation_id,
    type,
    (ROW_NUMBER() OVER (
      PARTITION BY calculation_id
      ORDER BY position_number::int NULLS LAST, created_at
    )) AS rn
  FROM calculation_line_items
),
headers AS (
  SELECT id, calculation_id, rn FROM ordered WHERE type = 'asset_header'
),
assignments AS (
  SELECT
    o.id,
    (SELECT h.id FROM headers h
     WHERE h.calculation_id = o.calculation_id AND h.rn < o.rn
     ORDER BY h.rn DESC LIMIT 1) AS header_id
  FROM ordered o
  WHERE o.type != 'asset_header'
)
UPDATE calculation_line_items c
  SET asset_header_id = a.header_id
  FROM assignments a
  WHERE c.id = a.id;
