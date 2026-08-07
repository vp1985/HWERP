-- Add a dedicated "done" status for completed inquiries.

SET search_path TO public;

ALTER TABLE inquiries
  DROP CONSTRAINT IF EXISTS inquiries_status_check;

ALTER TABLE inquiries
  ADD CONSTRAINT inquiries_status_check CHECK (status IN (
    'new', 'triage', 'waiting_for_customer', 'ready_for_calculation',
    'calculation_draft', 'offer_draft', 'sent', 'done', 'won', 'lost', 'archived'
  ));
