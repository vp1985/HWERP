import { describe, expect, it } from 'vitest';
import { buildAcceptedChecklistSuggestionRun, isChecklistSuggestionAccepted } from './checklistSuggestionChecklistRuns';
import type { ChecklistItemAction, ChecklistRun, ChecklistTemplate, ChecklistTemplateGroup, ChecklistTemplateItem } from './types';

const action = (overrides: Partial<ChecklistItemAction> = {}): ChecklistItemAction => ({
  id: 'action-1',
  templateItemId: 'source-item-1',
  conditionOperator: 'equals',
  conditionValue: 'yes',
  actionType: 'suggest_checklist',
  targetType: 'free',
  targetId: 'template-1',
  targetContext: 'order_preparation',
  triggerMode: 'suggest',
  payload: {},
  active: true,
  sortOrder: 10,
  createdAt: '2026-06-20T00:00:00.000Z',
  updatedAt: '2026-06-20T00:00:00.000Z',
  ...overrides,
});

const template = (overrides: Partial<ChecklistTemplate> = {}): ChecklistTemplate => ({
  id: 'template-1',
  name: 'AV prüfen',
  description: null,
  templateType: 'order_preparation',
  status: 'active',
  visibilityGroupKeys: [],
  verificationRequired: false,
  autoApplyRules: {},
  createdBy: null,
  updatedBy: null,
  createdAt: '2026-06-20T00:00:00.000Z',
  updatedAt: '2026-06-20T00:00:00.000Z',
  ...overrides,
});

const group = (): ChecklistTemplateGroup => ({
  id: 'group-1',
  templateId: 'template-1',
  title: 'Vorbereitung',
  sortOrder: 10,
  visibilityGroupKeys: [],
  createdAt: '2026-06-20T00:00:00.000Z',
  updatedAt: '2026-06-20T00:00:00.000Z',
});

const item = (): ChecklistTemplateItem => ({
  id: 'item-1',
  templateId: 'template-1',
  groupId: 'group-1',
  title: 'Daten prüfen',
  description: null,
  sortOrder: 10,
  required: true,
  quantity: null,
  unit: null,
  photoRequired: false,
  documentRequired: false,
  noteMode: 'none',
  measurementMode: 'none',
  employeeCodeRequired: false,
  signatureRequired: false,
  timeRequired: false,
  materialEntryEnabled: false,
  responseType: 'check',
  choiceOptions: [],
  visibilityGroupKeys: [],
  dependsOnItemIds: [],
  createdAt: '2026-06-20T00:00:00.000Z',
  updatedAt: '2026-06-20T00:00:00.000Z',
});

describe('checklist suggestion checklist runs', () => {
  it('builds an inquiry-linked checklist run from an active suggested template', () => {
    const ids = ['run-1', 'link-1', 'run-item-1'];
    const result = buildAcceptedChecklistSuggestionRun({
      action: action(),
      targetId: 'inquiry-1',
      templates: [template()],
      groups: [group()],
      items: [item()],
      now: '2026-06-20T01:00:00.000Z',
      idFactory: () => ids.shift() ?? 'fallback',
    });

    expect(result?.run).toMatchObject({ id: 'run-1', templateId: 'template-1', title: 'AV prüfen', runType: 'order_preparation' });
    expect(result?.links).toEqual([expect.objectContaining({ id: 'link-1', runId: 'run-1', targetType: 'inquiry', targetId: 'inquiry-1' })]);
    expect(result?.runItems).toEqual([expect.objectContaining({ id: 'run-item-1', runId: 'run-1', templateItemId: 'item-1', title: 'Daten prüfen' })]);
  });

  it('does not build for missing, archived, or non-checklist suggestions', () => {
    const base = { targetId: 'inquiry-1', templates: [template({ status: 'archived' })], groups: [group()], items: [item()], now: '2026-06-20T01:00:00.000Z', idFactory: () => 'id' };

    expect(buildAcceptedChecklistSuggestionRun({ ...base, action: action() })).toBeNull();
    expect(buildAcceptedChecklistSuggestionRun({ ...base, templates: [], action: action() })).toBeNull();
    expect(buildAcceptedChecklistSuggestionRun({ ...base, templates: [template()], action: action({ actionType: 'suggest_material' }) })).toBeNull();
  });

  it('detects accepted suggestions from existing inquiry runs', () => {
    const runs = [{ id: 'run-1', templateId: 'template-1' } as ChecklistRun];

    expect(isChecklistSuggestionAccepted(action(), runs)).toBe(true);
    expect(isChecklistSuggestionAccepted(action({ targetId: 'template-2' }), runs)).toBe(false);
    expect(isChecklistSuggestionAccepted(action({ actionType: 'create_task' }), runs)).toBe(false);
  });
});
