import { describe, expect, it } from 'vitest';
import {
  buildChecklistSuggestionPackingItem,
  getChecklistSuggestionPackingItemKey,
  getChecklistSuggestionPackingItemKeyForItem,
} from './checklistSuggestionPackingItems';
import type { ChecklistItemAction, Material } from './types';

const now = '2026-06-20T00:00:00.000Z';

const material: Material = {
  id: 'mat-1',
  articleNumber: 'M-1',
  name: 'Auffangwanne',
  description: 'für Transport bereitlegen',
  unit: 'Stk',
  price: 120,
  supplier: null,
  category: 'Rüstliste',
  createdAt: now,
  updatedAt: now,
};

function action(overrides: Partial<ChecklistItemAction> = {}): ChecklistItemAction {
  return {
    id: 'action-1',
    templateItemId: 'item-1',
    conditionOperator: 'equals',
    conditionValue: 'yes',
    actionType: 'create_packing_item',
    targetType: 'material',
    targetId: 'mat-1',
    targetContext: 'packing_list',
    triggerMode: 'suggest',
    payload: {},
    active: true,
    sortOrder: 10,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('checklist suggestion packing item acceptance', () => {
  it('builds a price-free packing-list run item from a material suggestion', () => {
    const item = buildChecklistSuggestionPackingItem({
      action: action(),
      runId: 'run-1',
      materials: [material],
      sortOrder: 30,
      id: 'run-item-1',
      now,
    });

    expect(item).toMatchObject({
      id: 'run-item-1',
      runId: 'run-1',
      templateItemId: null,
      groupTitleSnapshot: 'Material / Ersatzteile',
      title: 'Auffangwanne',
      description: 'für Transport bereitlegen',
      sortOrder: 30,
      required: true,
      status: 'open',
      quantity: 1,
      unit: 'Stk',
      responseType: 'check',
    });
    expect(JSON.stringify(item)).not.toContain('120');
    expect(item?.note).toBe('Aus Checklisten-Vorschlag übernommen.');
    expect(item?.blockedReason).toBe('checklist-suggestion:action-1:material:mat-1');
  });

  it('uses an explicit payload label when maintained', () => {
    const item = buildChecklistSuggestionPackingItem({
      action: action({ payload: { label: 'Ölwanne ins Fahrzeug legen' } }),
      runId: 'run-1',
      materials: [material],
      sortOrder: 10,
      id: 'run-item-1',
      now,
    });

    expect(item?.title).toBe('Ölwanne ins Fahrzeug legen');
  });

  it('returns stable duplicate keys for suggestion and accepted item', () => {
    const suggestion = action();
    const item = buildChecklistSuggestionPackingItem({ action: suggestion, runId: 'run-1', materials: [material], sortOrder: 10, id: 'run-item-1', now });

    expect(getChecklistSuggestionPackingItemKey(suggestion, 'run-1')).toBe('run-1:checklist-suggestion:action-1:material:mat-1');
    expect(item && getChecklistSuggestionPackingItemKeyForItem(item)).toBe('run-1:checklist-suggestion:action-1:material:mat-1');
  });

  it('does not build non-packing suggestions', () => {
    const item = buildChecklistSuggestionPackingItem({
      action: action({ actionType: 'suggest_material', targetContext: 'calculation' }),
      runId: 'run-1',
      materials: [material],
      sortOrder: 10,
      id: 'run-item-1',
      now,
    });

    expect(item).toBeNull();
  });
});
