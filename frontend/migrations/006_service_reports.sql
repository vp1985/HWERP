-- Offlinefähige Serviceberichte. Screenshots/Anhänge bleiben in v1 lokal in IndexedDB.

SET search_path TO public;

CREATE TABLE IF NOT EXISTS service_reports (
  id             TEXT PRIMARY KEY,
  report_number  TEXT NOT NULL UNIQUE,
  type           TEXT NOT NULL,
  customer_id    TEXT NOT NULL,
  location_id    TEXT NOT NULL,
  asset_id       TEXT,
  order_number   TEXT,
  values         JSONB NOT NULL DEFAULT '{}'::jsonb,
  status         TEXT NOT NULL,
  sync_status    TEXT NOT NULL DEFAULT 'synced',
  sync_error     TEXT,
  created_by     TEXT NOT NULL DEFAULT '',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at   TIMESTAMPTZ,
  synced_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS service_reports_customer_idx ON service_reports (customer_id);
CREATE INDEX IF NOT EXISTS service_reports_created_at_idx ON service_reports (created_at DESC);
