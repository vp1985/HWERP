-- Inquiry Dashboard Schema
-- Migration: 005_inquiry_dashboard.sql
-- Mail-/Quellen-Inbox, Antwortentwürfe und HWERP-kompatible Anfragekarten

SET search_path TO public;

CREATE TABLE IF NOT EXISTS inquiries (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title                    TEXT NOT NULL,
  inquiry_number           TEXT,
  status                   TEXT NOT NULL DEFAULT 'new',
  priority                 TEXT NOT NULL DEFAULT 'normal',
  source                   TEXT NOT NULL DEFAULT 'manual',
  source_message_id         TEXT,
  sender_name              TEXT,
  sender_email             TEXT,
  sender_phone             TEXT,
  customer_id              UUID REFERENCES customers(id),
  site_customer_id         UUID REFERENCES customers(id),
  location_id              UUID REFERENCES locations(id),
  asset_id                 UUID REFERENCES assets(id),
  responsible_customer_id  UUID REFERENCES customers(id),
  responsible_contact_person_id UUID REFERENCES contact_persons(id),
  commission_relevant      BOOLEAN NOT NULL DEFAULT FALSE,
  switching_action_required TEXT DEFAULT 'unknown',
  switching_action_by_customer TEXT,
  switching_action_contact_person_id UUID REFERENCES contact_persons(id) ON DELETE SET NULL,
  execution_possible_weekdays BOOLEAN NOT NULL DEFAULT FALSE,
  execution_possible_friday_afternoon BOOLEAN NOT NULL DEFAULT FALSE,
  execution_possible_saturday BOOLEAN NOT NULL DEFAULT FALSE,
  execution_possible_sunday BOOLEAN NOT NULL DEFAULT FALSE,
  execution_possible_after_hours BOOLEAN NOT NULL DEFAULT FALSE,
  execution_possible_planned_shutdown_only BOOLEAN NOT NULL DEFAULT FALSE,
  execution_info TEXT,
  related_calculation_id   UUID REFERENCES calculations(id),
  summary                  TEXT,
  raw_text                 TEXT,
  received_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_action_at           TIMESTAMPTZ,
  next_action              TEXT,
  needs_attention          BOOLEAN NOT NULL DEFAULT FALSE,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT inquiries_status_check CHECK (status IN (
    'new', 'triage', 'waiting_for_customer', 'ready_for_calculation',
    'calculation_draft', 'offer_draft', 'sent', 'done', 'won', 'lost', 'archived'
  )),
  CONSTRAINT inquiries_priority_check CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  CONSTRAINT inquiries_source_check CHECK (source IN ('email', 'telegram', 'whatsapp', 'web', 'manual')),
  CONSTRAINT inquiries_switching_action_required_check CHECK (switching_action_required IN ('yes', 'no', 'unknown')),
  CONSTRAINT inquiries_switching_action_by_customer_check CHECK (switching_action_by_customer IS NULL OR switching_action_by_customer IN ('yes', 'no', 'unknown'))
);

CREATE UNIQUE INDEX IF NOT EXISTS inquiries_inquiry_number_idx
  ON inquiries(inquiry_number)
  WHERE inquiry_number IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS inquiries_source_message_id_idx
  ON inquiries(source_message_id)
  WHERE source_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS inquiries_status_idx ON inquiries(status);
CREATE INDEX IF NOT EXISTS inquiries_needs_attention_idx ON inquiries(needs_attention);
CREATE INDEX IF NOT EXISTS inquiries_received_at_idx ON inquiries(received_at DESC);
CREATE INDEX IF NOT EXISTS inquiries_switching_action_required_idx ON inquiries(switching_action_required);
CREATE INDEX IF NOT EXISTS inquiries_switching_action_contact_person_id_idx ON inquiries(switching_action_contact_person_id);

CREATE TABLE IF NOT EXISTS inquiry_messages (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id          UUID NOT NULL REFERENCES inquiries(id) ON DELETE CASCADE,
  source             TEXT NOT NULL DEFAULT 'manual',
  direction          TEXT NOT NULL DEFAULT 'inbound',
  subject            TEXT,
  body               TEXT NOT NULL,
  sender_name         TEXT,
  sender_email        TEXT,
  source_message_id   TEXT,
  thread_id           TEXT,
  attachment_ids      TEXT[] NOT NULL DEFAULT '{}',
  received_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT inquiry_messages_source_check CHECK (source IN ('email', 'telegram', 'whatsapp', 'web', 'manual')),
  CONSTRAINT inquiry_messages_direction_check CHECK (direction IN ('inbound', 'outbound', 'draft'))
);

CREATE UNIQUE INDEX IF NOT EXISTS inquiry_messages_source_message_id_idx
  ON inquiry_messages(source_message_id)
  WHERE source_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS inquiry_messages_inquiry_id_idx ON inquiry_messages(inquiry_id);

CREATE TABLE IF NOT EXISTS inquiry_response_drafts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id    UUID NOT NULL REFERENCES inquiries(id) ON DELETE CASCADE,
  kind         TEXT NOT NULL DEFAULT 'acknowledgement',
  subject      TEXT NOT NULL,
  body         TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'draft',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT inquiry_response_drafts_kind_check CHECK (kind IN (
    'clarification', 'acknowledgement', 'offer_intro', 'rejection', 'follow_up'
  )),
  CONSTRAINT inquiry_response_drafts_status_check CHECK (status IN ('draft', 'approved', 'sent', 'discarded'))
);

CREATE INDEX IF NOT EXISTS inquiry_response_drafts_inquiry_id_idx ON inquiry_response_drafts(inquiry_id);
CREATE INDEX IF NOT EXISTS inquiry_response_drafts_status_idx ON inquiry_response_drafts(status);
