-- Wiederverwendbare Nummern aus online bestätigten Rückgaben

SET search_path TO public;

CREATE TABLE IF NOT EXISTS number_circle_returned_numbers (
  circle_key   TEXT NOT NULL REFERENCES number_circles(key) ON DELETE CASCADE,
  number       TEXT NOT NULL,
  returned_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (circle_key, number)
);

CREATE INDEX IF NOT EXISTS idx_number_circle_returned_numbers_circle_key
  ON number_circle_returned_numbers (circle_key, number);
