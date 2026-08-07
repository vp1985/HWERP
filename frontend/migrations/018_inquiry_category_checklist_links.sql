-- Link central checklist templates to inquiry categories.
-- Categories keep history; links are editable master data.

SET search_path TO public;

ALTER TABLE inquiry_master_data_categories
  ADD COLUMN IF NOT EXISTS checklist_template_ids UUID[] NOT NULL DEFAULT ARRAY[]::UUID[];

CREATE INDEX IF NOT EXISTS inquiry_master_data_categories_checklists_gin_idx
  ON inquiry_master_data_categories USING GIN (checklist_template_ids);
