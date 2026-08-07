import { createChecklistRunFromTemplate } from '../features/checklists/checklists';
import type { ChecklistItemAction, ChecklistRun, ChecklistRunItem, ChecklistRunLink, ChecklistTemplate, ChecklistTemplateGroup, ChecklistTemplateItem } from './types';

export interface BuildAcceptedChecklistSuggestionRunInput {
  action: ChecklistItemAction;
  targetId: string;
  templates: ChecklistTemplate[];
  groups: ChecklistTemplateGroup[];
  items: ChecklistTemplateItem[];
  now: string;
  idFactory: () => string;
}

export interface AcceptedChecklistSuggestionRun {
  run: ChecklistRun;
  links: ChecklistRunLink[];
  runItems: ChecklistRunItem[];
}

export function buildAcceptedChecklistSuggestionRun(input: BuildAcceptedChecklistSuggestionRunInput): AcceptedChecklistSuggestionRun | null {
  const { action, targetId, templates, groups, items, now, idFactory } = input;
  if (action.actionType !== 'suggest_checklist' || !action.targetId) return null;

  const template = templates.find((entry) => entry.id === action.targetId && entry.status === 'active');
  if (!template) return null;

  return createChecklistRunFromTemplate({
    template,
    groups: groups.filter((group) => group.templateId === template.id),
    items: items.filter((item) => item.templateId === template.id),
    links: [{ targetType: 'inquiry', targetId }],
    now,
    idFactory,
  });
}

export function isChecklistSuggestionAccepted(action: ChecklistItemAction, runs: ChecklistRun[]): boolean {
  return action.actionType === 'suggest_checklist'
    && Boolean(action.targetId)
    && runs.some((run) => run.templateId === action.targetId);
}
