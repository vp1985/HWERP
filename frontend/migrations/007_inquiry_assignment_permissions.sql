-- Inquiry Assignment Permissions
-- Migration: 007_inquiry_assignment_permissions.sql
-- Server-seitig absicherbare Board-Zuweisungen mit eigenem Anfrage-Rollenmodell

SET search_path TO public;

ALTER TABLE inquiries
  ADD COLUMN IF NOT EXISTS assignee_user_id TEXT,
  ADD COLUMN IF NOT EXISTS assigned_by_user_id TEXT,
  ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_by_user_id TEXT;

CREATE INDEX IF NOT EXISTS inquiries_assignee_user_id_idx ON inquiries(assignee_user_id);
CREATE INDEX IF NOT EXISTS inquiries_assigned_at_idx ON inquiries(assigned_at DESC);

CREATE TABLE IF NOT EXISTS inquiry_users (
  id                         TEXT PRIMARY KEY,
  name                       TEXT NOT NULL,
  email                      TEXT,
  active                     BOOLEAN NOT NULL DEFAULT TRUE,
  role                       TEXT NOT NULL DEFAULT 'employee',
  can_view_all_inquiries     BOOLEAN NOT NULL DEFAULT FALSE,
  can_assign_inquiries       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT inquiry_users_role_check CHECK (role IN ('employee', 'dispatcher', 'admin'))
);

CREATE INDEX IF NOT EXISTS inquiry_users_active_idx ON inquiry_users(active);
CREATE INDEX IF NOT EXISTS inquiry_users_role_idx ON inquiry_users(role);
