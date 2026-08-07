-- Antwortbasierte Checklisten-Regeln: externe Template-Links und Folgeaktionen.
-- Ermöglicht: Wenn Checklistenpunkt X mit Ja beantwortet wird, dann Service/Material/Rüstlistenpunkt vorschlagen oder erzeugen.

SET search_path TO public;

CREATE TABLE IF NOT EXISTS checklist_template_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES checklist_templates(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL,
  source_id TEXT,
  contexts TEXT[] NOT NULL DEFAULT '{}',
  trigger_mode TEXT NOT NULL DEFAULT 'suggest',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT checklist_template_links_source_type_check CHECK (source_type IN (
    'service', 'material', 'service_package', 'asset_type', 'asset', 'customer', 'order_type', 'workshop_card_type', 'free'
  )),
  CONSTRAINT checklist_template_links_trigger_mode_check CHECK (trigger_mode IN ('suggest', 'auto_create', 'required', 'manual'))
);

CREATE INDEX IF NOT EXISTS checklist_template_links_source_context_idx
  ON checklist_template_links(source_type, source_id, active, sort_order);
CREATE INDEX IF NOT EXISTS checklist_template_links_template_idx
  ON checklist_template_links(template_id);

CREATE TABLE IF NOT EXISTS checklist_item_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_item_id UUID NOT NULL REFERENCES checklist_template_items(id) ON DELETE CASCADE,
  condition_operator TEXT NOT NULL DEFAULT 'equals',
  condition_value TEXT,
  action_type TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  target_context TEXT NOT NULL,
  trigger_mode TEXT NOT NULL DEFAULT 'suggest',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT checklist_item_actions_condition_operator_check CHECK (condition_operator IN ('equals', 'not_equals', 'contains', 'exists')),
  CONSTRAINT checklist_item_actions_action_type_check CHECK (action_type IN (
    'suggest_service', 'suggest_material', 'suggest_checklist', 'create_task', 'create_packing_item', 'add_billing_note'
  )),
  CONSTRAINT checklist_item_actions_trigger_mode_check CHECK (trigger_mode IN ('suggest', 'auto_create', 'required', 'manual'))
);

CREATE INDEX IF NOT EXISTS checklist_item_actions_template_item_idx
  ON checklist_item_actions(template_item_id, active, sort_order);
