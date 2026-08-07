-- Zentrales H-W-O-S Checklisten-System unter Stammdaten
-- Migration: 010_checklists.sql
-- Vorlagen, konkrete Läufe, Verknüpfungen und einzeln erledigbare Punkte.

SET search_path TO public;

CREATE TABLE IF NOT EXISTS checklist_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  template_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  visibility_group_keys TEXT[] NOT NULL DEFAULT '{}',
  verification_required BOOLEAN NOT NULL DEFAULT FALSE,
  auto_apply_rules JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT checklist_templates_status_check CHECK (status IN ('active', 'archived')),
  CONSTRAINT checklist_templates_type_check CHECK (template_type IN (
    'trafo_workshop_card', 'order_preparation', 'packing_list', 'calculation', 'general'
  ))
);

CREATE INDEX IF NOT EXISTS checklist_templates_status_type_idx
  ON checklist_templates(status, template_type, name);

CREATE TABLE IF NOT EXISTS checklist_template_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES checklist_templates(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 100,
  visibility_group_keys TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS checklist_template_groups_template_sort_idx
  ON checklist_template_groups(template_id, sort_order, title);

CREATE TABLE IF NOT EXISTS checklist_template_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES checklist_templates(id) ON DELETE CASCADE,
  group_id UUID REFERENCES checklist_template_groups(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 100,
  required BOOLEAN NOT NULL DEFAULT TRUE,
  quantity NUMERIC,
  unit TEXT,
  photo_required BOOLEAN NOT NULL DEFAULT FALSE,
  document_required BOOLEAN NOT NULL DEFAULT FALSE,
  note_mode TEXT NOT NULL DEFAULT 'optional',
  measurement_mode TEXT NOT NULL DEFAULT 'none',
  employee_code_required BOOLEAN NOT NULL DEFAULT FALSE,
  signature_required BOOLEAN NOT NULL DEFAULT FALSE,
  time_required BOOLEAN NOT NULL DEFAULT FALSE,
  material_entry_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  visibility_group_keys TEXT[] NOT NULL DEFAULT '{}',
  depends_on_item_ids TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT checklist_template_items_note_mode_check CHECK (note_mode IN ('none', 'optional', 'required')),
  CONSTRAINT checklist_template_items_measurement_mode_check CHECK (measurement_mode IN ('none', 'optional', 'required'))
);

CREATE INDEX IF NOT EXISTS checklist_template_items_template_sort_idx
  ON checklist_template_items(template_id, sort_order, title);

CREATE TABLE IF NOT EXISTS checklist_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES checklist_templates(id) ON DELETE SET NULL,
  template_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  title TEXT NOT NULL,
  run_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  verification_required BOOLEAN NOT NULL DEFAULT FALSE,
  verified_by TEXT,
  verified_at TIMESTAMPTZ,
  qr_code_token TEXT NOT NULL DEFAULT gen_random_uuid()::TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT checklist_runs_status_check CHECK (status IN ('open', 'in_progress', 'done', 'checked', 'archived')),
  CONSTRAINT checklist_runs_type_check CHECK (run_type IN (
    'trafo_workshop_card', 'order_preparation', 'packing_list', 'calculation', 'general'
  ))
);

CREATE INDEX IF NOT EXISTS checklist_runs_status_type_idx
  ON checklist_runs(status, run_type, title);
CREATE INDEX IF NOT EXISTS checklist_runs_qr_token_idx
  ON checklist_runs(qr_code_token);

CREATE TABLE IF NOT EXISTS checklist_run_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES checklist_runs(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL,
  target_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT checklist_run_links_target_type_check CHECK (target_type IN (
    'order', 'workshop_card', 'asset', 'customer', 'inquiry', 'calculation', 'service', 'service_package', 'free'
  ))
);

CREATE INDEX IF NOT EXISTS checklist_run_links_target_idx
  ON checklist_run_links(target_type, target_id);
CREATE INDEX IF NOT EXISTS checklist_run_links_run_idx
  ON checklist_run_links(run_id);

CREATE TABLE IF NOT EXISTS checklist_run_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES checklist_runs(id) ON DELETE CASCADE,
  template_item_id UUID REFERENCES checklist_template_items(id) ON DELETE SET NULL,
  group_title_snapshot TEXT,
  title TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 100,
  required BOOLEAN NOT NULL DEFAULT TRUE,
  status TEXT NOT NULL DEFAULT 'open',
  quantity NUMERIC,
  unit TEXT,
  note TEXT,
  measurement_value TEXT,
  employee_code TEXT,
  signature_name TEXT,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  completed_by TEXT,
  blocked_reason TEXT,
  depends_on_template_item_ids TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT checklist_run_items_status_check CHECK (status IN ('open', 'done', 'not_applicable', 'blocked')),
  CONSTRAINT checklist_run_items_time_order_check CHECK (
    started_at IS NULL OR finished_at IS NULL OR finished_at >= started_at
  )
);

CREATE INDEX IF NOT EXISTS checklist_run_items_run_sort_idx
  ON checklist_run_items(run_id, sort_order, title);
CREATE INDEX IF NOT EXISTS checklist_run_items_status_idx
  ON checklist_run_items(status);

-- Empfohlene Start-Vorlagen. Sie sind editierbare Stammdaten, keine Hartcodierung.
INSERT INTO checklist_templates
  (id, name, description, template_type, status, visibility_group_keys, verification_required, auto_apply_rules)
VALUES
  ('00000000-0000-0000-0000-000000010001', 'Trafo-Werkstattkarte', 'Startvorlage für Trafo-Werkstattkarten', 'trafo_workshop_card', 'active', ARRAY['admin','office','work_preparation','master'], FALSE, '{"workshopCard": true}'::jsonb),
  ('00000000-0000-0000-0000-000000010002', 'Auftragsvorbereitung', 'Standard-Checkliste vor Auftragsstart', 'order_preparation', 'active', ARRAY['admin','office','work_preparation','master'], TRUE, '{"orderPreparation": true}'::jsonb),
  ('00000000-0000-0000-0000-000000010003', 'Rüstliste', 'Standard-Rüstliste für Werkzeug, Geräte, PSA, Dokumente und Nachweise', 'packing_list', 'active', ARRAY['admin','work_preparation','master','field'], FALSE, '{"packingList": true}'::jsonb)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  template_type = EXCLUDED.template_type,
  status = EXCLUDED.status,
  visibility_group_keys = EXCLUDED.visibility_group_keys,
  verification_required = EXCLUDED.verification_required,
  auto_apply_rules = EXCLUDED.auto_apply_rules,
  updated_at = NOW();

INSERT INTO checklist_template_groups
  (id, template_id, title, sort_order, visibility_group_keys)
VALUES
  ('00000000-0000-0000-0000-000000020001', '00000000-0000-0000-0000-000000010001', 'Eingangsprüfung', 10, ARRAY['work_preparation','master']),
  ('00000000-0000-0000-0000-000000020002', '00000000-0000-0000-0000-000000010001', 'Prüfung / Dokumentation', 20, ARRAY['work_preparation','master']),
  ('00000000-0000-0000-0000-000000020003', '00000000-0000-0000-0000-000000010002', 'Auftrag / Unterlagen', 10, ARRAY['office','work_preparation','master']),
  ('00000000-0000-0000-0000-000000020004', '00000000-0000-0000-0000-000000010003', 'Werkzeug', 10, ARRAY['work_preparation','field','master']),
  ('00000000-0000-0000-0000-000000020005', '00000000-0000-0000-0000-000000010003', 'Messgeräte', 20, ARRAY['work_preparation','field','master']),
  ('00000000-0000-0000-0000-000000020006', '00000000-0000-0000-0000-000000010003', 'PSA / Dokumente / Nachweise', 30, ARRAY['work_preparation','field','master'])
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  sort_order = EXCLUDED.sort_order,
  visibility_group_keys = EXCLUDED.visibility_group_keys,
  updated_at = NOW();

INSERT INTO checklist_template_items
  (id, template_id, group_id, title, description, sort_order, required, photo_required, document_required, note_mode, measurement_mode, employee_code_required, signature_required, time_required, material_entry_enabled, visibility_group_keys, depends_on_item_ids)
VALUES
  ('00000000-0000-0000-0000-000000030001', '00000000-0000-0000-0000-000000010001', '00000000-0000-0000-0000-000000020001', 'Eingangsprüfung durchführen', NULL, 10, TRUE, FALSE, TRUE, 'optional', 'required', TRUE, TRUE, TRUE, FALSE, ARRAY['work_preparation','master'], ARRAY[]::TEXT[]),
  ('00000000-0000-0000-0000-000000030002', '00000000-0000-0000-0000-000000010001', '00000000-0000-0000-0000-000000020002', 'Hochspannungsprüfung dokumentieren', NULL, 20, TRUE, FALSE, TRUE, 'optional', 'required', TRUE, TRUE, TRUE, FALSE, ARRAY['master'], ARRAY['00000000-0000-0000-0000-000000030001']),
  ('00000000-0000-0000-0000-000000030003', '00000000-0000-0000-0000-000000010002', '00000000-0000-0000-0000-000000020003', 'Auftragsdaten vollständig prüfen', NULL, 10, TRUE, FALSE, FALSE, 'required', 'none', FALSE, FALSE, FALSE, FALSE, ARRAY['office','work_preparation','master'], ARRAY[]::TEXT[]),
  ('00000000-0000-0000-0000-000000030004', '00000000-0000-0000-0000-000000010003', '00000000-0000-0000-0000-000000020004', 'Werkzeug bereitstellen', NULL, 10, TRUE, FALSE, FALSE, 'optional', 'none', FALSE, FALSE, FALSE, FALSE, ARRAY['work_preparation','field','master'], ARRAY[]::TEXT[]),
  ('00000000-0000-0000-0000-000000030005', '00000000-0000-0000-0000-000000010003', '00000000-0000-0000-0000-000000020005', 'Messgeräte mit gültiger Prüffrist bereitstellen', NULL, 20, TRUE, FALSE, TRUE, 'optional', 'none', FALSE, FALSE, FALSE, FALSE, ARRAY['work_preparation','field','master'], ARRAY[]::TEXT[]),
  ('00000000-0000-0000-0000-000000030006', '00000000-0000-0000-0000-000000010003', '00000000-0000-0000-0000-000000020006', 'PSA, Unterlagen und Nachweise bereitlegen', NULL, 30, TRUE, FALSE, TRUE, 'optional', 'none', FALSE, FALSE, FALSE, FALSE, ARRAY['work_preparation','field','master'], ARRAY[]::TEXT[])
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order,
  required = EXCLUDED.required,
  photo_required = EXCLUDED.photo_required,
  document_required = EXCLUDED.document_required,
  note_mode = EXCLUDED.note_mode,
  measurement_mode = EXCLUDED.measurement_mode,
  employee_code_required = EXCLUDED.employee_code_required,
  signature_required = EXCLUDED.signature_required,
  time_required = EXCLUDED.time_required,
  material_entry_enabled = EXCLUDED.material_entry_enabled,
  visibility_group_keys = EXCLUDED.visibility_group_keys,
  depends_on_item_ids = EXCLUDED.depends_on_item_ids,
  updated_at = NOW();
