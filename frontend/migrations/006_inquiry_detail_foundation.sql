-- Inquiry Detail Foundation
-- Migration: 006_inquiry_detail_foundation.sql
-- Anhänge und externe Verknüpfungen für die Anfrage-Detailansicht

SET search_path TO public;

CREATE TABLE IF NOT EXISTS inquiry_attachments (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id            UUID NOT NULL REFERENCES inquiries(id) ON DELETE CASCADE,
  message_id            UUID REFERENCES inquiry_messages(id) ON DELETE SET NULL,
  source                TEXT NOT NULL DEFAULT 'manual',
  file_name             TEXT NOT NULL,
  mime_type             TEXT,
  file_size             INTEGER,
  storage_provider      TEXT NOT NULL DEFAULT 'local',
  storage_url           TEXT NOT NULL,
  thumbnail_url         TEXT,
  uploaded_by_user_id   TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT inquiry_attachments_source_check CHECK (source IN ('email', 'telegram', 'whatsapp', 'web', 'manual')),
  CONSTRAINT inquiry_attachments_storage_provider_check CHECK (storage_provider IN ('local', 'sharepoint', 'onedrive', 'external'))
);

CREATE INDEX IF NOT EXISTS inquiry_attachments_inquiry_id_idx ON inquiry_attachments(inquiry_id);
CREATE INDEX IF NOT EXISTS inquiry_attachments_message_id_idx ON inquiry_attachments(message_id);

CREATE TABLE IF NOT EXISTS inquiry_external_links (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id            UUID NOT NULL REFERENCES inquiries(id) ON DELETE CASCADE,
  kind                  TEXT NOT NULL DEFAULT 'other',
  label                 TEXT NOT NULL,
  url                   TEXT,
  target_id             TEXT,
  created_by_user_id    TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT inquiry_external_links_kind_check CHECK (kind IN (
    'hwerp_customer', 'hwerp_asset', 'hwerp_calculation', 'hwerp_offer',
    'lexoffice_customer', 'lexoffice_offer', 'sharepoint_folder', 'other'
  )),
  CONSTRAINT inquiry_external_links_target_check CHECK (url IS NOT NULL OR target_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS inquiry_external_links_inquiry_id_idx ON inquiry_external_links(inquiry_id);
CREATE INDEX IF NOT EXISTS inquiry_external_links_kind_idx ON inquiry_external_links(kind);
