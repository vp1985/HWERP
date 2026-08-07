-- General checklist point response controls: yes/no, multiple choice, N/A and clarification.

SET search_path TO public;

ALTER TABLE checklist_template_items
  ADD COLUMN IF NOT EXISTS response_type TEXT NOT NULL DEFAULT 'check',
  ADD COLUMN IF NOT EXISTS choice_options TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE checklist_run_items
  ADD COLUMN IF NOT EXISTS response_type TEXT NOT NULL DEFAULT 'check',
  ADD COLUMN IF NOT EXISTS choice_options TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS selected_choice TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'checklist_template_items_response_type_check'
  ) THEN
    ALTER TABLE checklist_template_items
      ADD CONSTRAINT checklist_template_items_response_type_check
      CHECK (response_type IN ('check', 'yes_no', 'multiple_choice'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'checklist_run_items_response_type_check'
  ) THEN
    ALTER TABLE checklist_run_items
      ADD CONSTRAINT checklist_run_items_response_type_check
      CHECK (response_type IN ('check', 'yes_no', 'multiple_choice'));
  END IF;
END $$;

ALTER TABLE checklist_run_items
  DROP CONSTRAINT IF EXISTS checklist_run_items_status_check;

ALTER TABLE checklist_run_items
  ADD CONSTRAINT checklist_run_items_status_check
  CHECK (status IN ('open', 'done', 'not_applicable', 'needs_clarification', 'blocked'));

UPDATE checklist_template_items
SET response_type = 'yes_no', choice_options = ARRAY['Ja', 'Nein']
WHERE response_type = 'check'
  AND measurement_mode = 'none'
  AND note_mode IN ('optional', 'required');
