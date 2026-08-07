-- Add order-specific execution window notes to inquiries.

SET search_path TO public;

ALTER TABLE inquiries
  ADD COLUMN IF NOT EXISTS execution_possible_weekdays BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS execution_possible_friday_afternoon BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS execution_possible_saturday BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS execution_possible_sunday BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS execution_possible_after_hours BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS execution_possible_planned_shutdown_only BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS execution_info TEXT;
