-- Nummernkreise mit optionalem Jahreswechsel-Reset

SET search_path TO public;

CREATE TABLE IF NOT EXISTS number_circles (
  key              TEXT PRIMARY KEY,
  label            TEXT NOT NULL,
  prefix           TEXT NOT NULL DEFAULT '',
  format_template  TEXT NOT NULL DEFAULT '{PREFIX}-{NUMBER}',
  padding          INTEGER NOT NULL DEFAULT 6 CHECK (padding >= 1 AND padding <= 20),
  next_value       INTEGER NOT NULL DEFAULT 1 CHECK (next_value >= 1),
  reset_yearly     BOOLEAN NOT NULL DEFAULT FALSE,
  last_year        INTEGER,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO number_circles
  (key, label, prefix, format_template, padding, next_value, reset_yearly, last_year, is_active)
VALUES
  (
    'calculations',
    'Kalkulationen',
    'K',
    '{PREFIX}-{NUMBER}',
    6,
    COALESCE((SELECT next_value FROM sequences LIMIT 1), 1),
    FALSE,
    EXTRACT(YEAR FROM NOW())::INTEGER,
    TRUE
  ),
  ('service_ls', 'Servicebericht LS', 'LS-{YYYY}', '{PREFIX}-{NUMBER}', 6, 1, TRUE, EXTRACT(YEAR FROM NOW())::INTEGER, TRUE),
  ('service_wb', 'Wartungsbericht WB', 'WB-{YYYY}', '{PREFIX}-{NUMBER}', 6, 1, TRUE, EXTRACT(YEAR FROM NOW())::INTEGER, TRUE),
  ('service_dguv', 'DGUV-Prüfung', 'DGUV-{YYYY}', '{PREFIX}-{NUMBER}', 6, 1, TRUE, EXTRACT(YEAR FROM NOW())::INTEGER, TRUE),
  ('inquiries', 'Anfragen', 'ANF-{YYYY}', '{PREFIX}-{NUMBER}', 4, 1, TRUE, EXTRACT(YEAR FROM NOW())::INTEGER, TRUE),
  ('workshop_cards', 'Werkstattkarten', 'WK', '{PREFIX}-{NUMBER}', 5, 1, FALSE, EXTRACT(YEAR FROM NOW())::INTEGER, TRUE),
  ('transfer_receipts', 'Übernahmebelege', 'ÜB', '{PREFIX}-{NUMBER}', 6, 1, FALSE, EXTRACT(YEAR FROM NOW())::INTEGER, TRUE)
ON CONFLICT (key) DO NOTHING;
