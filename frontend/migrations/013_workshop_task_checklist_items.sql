-- Manuelle Checklistpunkte direkt an Werkstattkarten-Aufgaben.
-- Diese Punkte sind konkrete Karten-/Aufgaben-Snapshots und werden nicht mehr
-- automatisch aus den Leistung-Stammdaten erzeugt.

CREATE TABLE IF NOT EXISTS workshop_card_task_checklist_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id          UUID NOT NULL REFERENCES workshop_card_tasks(id) ON DELETE CASCADE,
  title            TEXT NOT NULL,
  sort_order       INTEGER NOT NULL DEFAULT 100,
  status           TEXT NOT NULL DEFAULT 'open',
  required         BOOLEAN NOT NULL DEFAULT TRUE,
  notes            TEXT,
  started_at       TEXT,
  finished_at      TEXT,
  employee_code    TEXT,
  completed_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT workshop_card_task_checklist_items_status_check CHECK (status IN ('open', 'done'))
);

CREATE INDEX IF NOT EXISTS workshop_card_task_checklist_items_task_sort_idx
  ON workshop_card_task_checklist_items(task_id, sort_order, title);

CREATE INDEX IF NOT EXISTS workshop_card_task_checklist_items_status_idx
  ON workshop_card_task_checklist_items(status);
