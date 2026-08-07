-- Inquiry numbers
-- Adds a visible Anfrage-Nr. and a default configurable number circle.

SET search_path TO public;

ALTER TABLE inquiries
  ADD COLUMN IF NOT EXISTS inquiry_number TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS inquiries_inquiry_number_idx
  ON inquiries(inquiry_number)
  WHERE inquiry_number IS NOT NULL;

INSERT INTO number_circles
  (key, label, prefix, format_template, padding, next_value, reset_yearly, last_year, is_active)
VALUES
  ('inquiries', 'Anfragen', 'ANF-{YYYY}', '{PREFIX}-{NUMBER}', 4, 1, TRUE, EXTRACT(YEAR FROM NOW())::INTEGER, TRUE)
ON CONFLICT (key) DO NOTHING;

WITH numbered AS (
  SELECT
    id,
    ROW_NUMBER() OVER (ORDER BY created_at ASC, id ASC) AS rn,
    EXTRACT(YEAR FROM COALESCE(received_at, created_at, NOW()))::INTEGER AS inquiry_year
  FROM inquiries
  WHERE inquiry_number IS NULL
)
UPDATE inquiries AS i
SET inquiry_number = 'ANF-' || numbered.inquiry_year || '-' || LPAD(numbered.rn::TEXT, 4, '0')
FROM numbered
WHERE i.id = numbered.id;

UPDATE number_circles
SET next_value = GREATEST(next_value, COALESCE((SELECT COUNT(*) + 1 FROM inquiries WHERE inquiry_number IS NOT NULL), 1)),
    last_year = EXTRACT(YEAR FROM NOW())::INTEGER,
    updated_at = NOW()
WHERE key = 'inquiries';
