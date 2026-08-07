import { describe, expect, it } from 'vitest';
import {
  buildChecklistSuggestionWorkshopTask,
  getChecklistSuggestionWorkshopTaskKey,
  getChecklistSuggestionWorkshopTaskKeyForTask,
} from './checklistSuggestionWorkshopTasks';
import type { ChecklistItemAction, Service } from './types';

const now = '2026-06-20T00:00:00.000Z';

const service: Service = {
  id: 'svc-1',
  serviceNumber: 'S-1',
  name: 'Ölprobe nehmen',
  description: null,
  unit: 'Stk',
  price: 95,
  category: null,
  active: true,
  availableInWorkshopCards: true,
  workshopCategory: null,
  workshopRequired: false,
  workshopPhotoRequired: true,
  workshopProtocolRequired: true,
  workshopMeasurementsRequired: false,
  workshopMaterialEntryEnabled: false,
  sortOrder: 20,
  checklistTemplateIds: [],
  createdAt: now,
  updatedAt: now,
};

function action(overrides: Partial<ChecklistItemAction> = {}): ChecklistItemAction {
  return {
    id: 'action-1',
    templateItemId: 'item-1',
    conditionOperator: 'equals',
    conditionValue: 'yes',
    actionType: 'create_task',
    targetType: 'service',
    targetId: null,
    targetContext: 'workshop_card',
    triggerMode: 'suggest',
    payload: { label: 'Kran bestellen' },
    active: true,
    sortOrder: 10,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('checklist suggestion workshop task acceptance', () => {
  it('builds a free workshop task from a checklist suggestion', () => {
    const task = buildChecklistSuggestionWorkshopTask({
      action: action(),
      cardId: 'card-1',
      services: [service],
      sortOrder: 30,
      id: 'task-1',
      now,
    });

    expect(task).toMatchObject({
      id: 'task-1',
      cardId: 'card-1',
      templateId: null,
      serviceId: null,
      title: 'Kran bestellen',
      sortOrder: 30,
      status: 'open',
      required: true,
      photoRequired: false,
      protocolRequired: false,
      notes: 'Aus Checklisten-Vorschlag übernommen.',
      blockedReason: 'checklist-suggestion-task:action-1:free',
    });
    expect(JSON.stringify(task)).not.toContain('95');
  });

  it('uses service workshop requirements when the suggestion references a service', () => {
    const task = buildChecklistSuggestionWorkshopTask({
      action: action({ targetId: 'svc-1', payload: {} }),
      cardId: 'card-1',
      services: [service],
      sortOrder: 10,
      id: 'task-1',
      now,
    });

    expect(task).toMatchObject({
      serviceId: 'svc-1',
      title: 'Ölprobe nehmen',
      photoRequired: true,
      protocolRequired: true,
    });
  });

  it('returns stable duplicate keys for suggestion and accepted task', () => {
    const suggestion = action({ targetId: 'svc-1' });
    const task = buildChecklistSuggestionWorkshopTask({ action: suggestion, cardId: 'card-1', services: [service], sortOrder: 10, id: 'task-1', now });

    expect(getChecklistSuggestionWorkshopTaskKey(suggestion, 'card-1')).toBe('card-1:checklist-suggestion-task:action-1:service:svc-1');
    expect(task && getChecklistSuggestionWorkshopTaskKeyForTask(task)).toBe('card-1:checklist-suggestion-task:action-1:service:svc-1');
  });

  it('does not build non-task suggestions', () => {
    const task = buildChecklistSuggestionWorkshopTask({
      action: action({ actionType: 'suggest_service' }),
      cardId: 'card-1',
      services: [service],
      sortOrder: 10,
      id: 'task-1',
      now,
    });

    expect(task).toBeNull();
  });
});
