-- Asset-Historie für Zuordnungsänderungen, Dokumente und Wartungen
-- Migration: 027_asset_history.sql

SET search_path TO public;

CREATE TABLE IF NOT EXISTS asset_history_entries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id        UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  event_type      TEXT NOT NULL CHECK (event_type IN ('assignment', 'document', 'maintenance')),
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_name       TEXT,
  title           TEXT NOT NULL,
  description     TEXT,
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS asset_history_entries_asset_time_idx
  ON asset_history_entries(asset_id, occurred_at DESC);

-- Dokumentart Ölanalyse für Asset-Dokumente erlauben.
ALTER TABLE asset_documents DROP CONSTRAINT IF EXISTS asset_documents_kind_check;
ALTER TABLE asset_documents
  ADD CONSTRAINT asset_documents_kind_check CHECK (kind IN (
    'transfer_receipt',
    'photo',
    'datasheet',
    'oil_analysis',
    'test_report',
    'protocol',
    'invoice',
    'delivery_note',
    'other'
  ));
