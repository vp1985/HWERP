-- Inquiry order-specific switching action fields
-- Migration: 023_inquiry_switching_actions.sql
-- Auftragsspezifische Klärung von Schalthandlungen in manuellen Anfragen

SET search_path TO public;

ALTER TABLE inquiries
  ADD COLUMN IF NOT EXISTS switching_action_required TEXT DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS switching_action_by_customer TEXT,
  ADD COLUMN IF NOT EXISTS switching_action_contact_person_id UUID REFERENCES contact_persons(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'inquiries_switching_action_required_check'
  ) THEN
    ALTER TABLE inquiries
      ADD CONSTRAINT inquiries_switching_action_required_check
      CHECK (switching_action_required IN ('yes', 'no', 'unknown'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'inquiries_switching_action_by_customer_check'
  ) THEN
    ALTER TABLE inquiries
      ADD CONSTRAINT inquiries_switching_action_by_customer_check
      CHECK (switching_action_by_customer IS NULL OR switching_action_by_customer IN ('yes', 'no', 'unknown'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS inquiries_switching_action_required_idx ON inquiries(switching_action_required);
CREATE INDEX IF NOT EXISTS inquiries_switching_action_contact_person_id_idx ON inquiries(switching_action_contact_person_id);
