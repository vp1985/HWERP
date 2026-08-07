-- Asset Trafo-Eigenschaften
-- Öl/Gießharz/Hermetik/Ausdehner sind strukturierte Eigenschaften im Trafo-Datenmodul.
-- 2W bleibt Standard; 3W aktiviert zusätzliche NS-Felder.

ALTER TABLE assets
  ADD COLUMN IF NOT EXISTS trafo_kind TEXT,
  ADD COLUMN IF NOT EXISTS oil_system TEXT,
  ADD COLUMN IF NOT EXISTS winding_count TEXT,
  ADD COLUMN IF NOT EXISTS secondary_voltage1 TEXT,
  ADD COLUMN IF NOT EXISTS secondary_voltage2 TEXT,
  ADD COLUMN IF NOT EXISTS secondary_voltage3 TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'assets_trafo_kind_check') THEN
    ALTER TABLE assets
      ADD CONSTRAINT assets_trafo_kind_check
      CHECK (trafo_kind IS NULL OR trafo_kind IN ('oil', 'cast_resin', 'other'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'assets_oil_system_check') THEN
    ALTER TABLE assets
      ADD CONSTRAINT assets_oil_system_check
      CHECK (oil_system IS NULL OR oil_system IN ('hermetic', 'conservator', 'other'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'assets_winding_count_check') THEN
    ALTER TABLE assets
      ADD CONSTRAINT assets_winding_count_check
      CHECK (winding_count IS NULL OR winding_count IN ('2w', '3w', 'other'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_assets_asset_type_id ON assets(asset_type_id);
CREATE INDEX IF NOT EXISTS idx_assets_trafo_kind ON assets(trafo_kind);
CREATE INDEX IF NOT EXISTS idx_assets_oil_system ON assets(oil_system);
CREATE INDEX IF NOT EXISTS idx_assets_winding_count ON assets(winding_count);

-- Korrigiere bestehende Seed-Daten: 2W ist Standard im Trafo-Datenmodul, kein eigener Assettyp.
UPDATE asset_types
SET is_active = FALSE, updated_at = NOW()
WHERE code IN ('trafo_2w', 'trafo_4w');

INSERT INTO asset_types (id, code, label, short, parent_type_id, sort_order, is_active)
SELECT gen_random_uuid(), 'nshv', 'NSHV', 'NSHV', NULL, 5, TRUE
WHERE NOT EXISTS (SELECT 1 FROM asset_types WHERE code = 'nshv');
