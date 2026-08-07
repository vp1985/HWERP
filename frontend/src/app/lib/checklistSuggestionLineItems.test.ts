import { describe, expect, it } from 'vitest';
import { buildChecklistSuggestionLineItem, getChecklistSuggestionLineItemKey, getChecklistSuggestionLineItemKeyForItem } from './checklistSuggestionLineItems';
import type { ChecklistItemAction, Material, Service } from './types';

const now = '2026-06-19T00:00:00.000Z';

const material: Material = {
  id: 'mat-1',
  articleNumber: 'M-1',
  name: 'Isolieröl',
  description: null,
  unit: 'L',
  price: 4.5,
  supplier: null,
  category: null,
  createdAt: now,
  updatedAt: now,
};

const service: Service = {
  id: 'svc-1',
  serviceNumber: 'S-1',
  name: 'Ölprobe',
  description: null,
  unit: 'Stk',
  price: 95,
  category: null,
  active: true,
  availableInWorkshopCards: true,
  workshopCategory: null,
  workshopRequired: false,
  workshopPhotoRequired: false,
  workshopProtocolRequired: false,
  workshopMeasurementsRequired: false,
  workshopMaterialEntryEnabled: false,
  sortOrder: 10,
  checklistTemplateIds: [],
  createdAt: now,
  updatedAt: now,
};

function action(overrides: Partial<ChecklistItemAction>): ChecklistItemAction {
  return {
    id: 'action-1',
    templateItemId: 'item-1',
    conditionOperator: 'equals',
    conditionValue: 'yes',
    actionType: 'suggest_material',
    targetType: 'material',
    targetId: 'mat-1',
    targetContext: 'calculation',
    triggerMode: 'suggest',
    payload: {},
    active: true,
    sortOrder: 10,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('checklist suggestion line item acceptance', () => {
  it('builds a material line item from a checklist suggestion', () => {
    const item = buildChecklistSuggestionLineItem({
      action: action({ actionType: 'suggest_material', targetType: 'material', targetId: 'mat-1' }),
      calculationId: 'calc-1',
      materials: [material],
      services: [service],
      id: 'line-1',
      now,
    });

    expect(item).toMatchObject({
      id: 'line-1',
      calculationId: 'calc-1',
      type: 'material',
      materialId: 'mat-1',
      serviceId: null,
      description: 'Isolieröl',
      quantity: 1,
      unit: 'L',
      unitPrice: 4.5,
      totalPrice: 4.5,
    });
  });

  it('builds a service line item from a checklist suggestion', () => {
    const item = buildChecklistSuggestionLineItem({
      action: action({ actionType: 'suggest_service', targetType: 'service', targetId: 'svc-1' }),
      calculationId: 'calc-1',
      materials: [material],
      services: [service],
      id: 'line-1',
      now,
    });

    expect(item).toMatchObject({
      type: 'service',
      materialId: null,
      serviceId: 'svc-1',
      description: 'Ölprobe',
      unit: 'Stk',
      unitPrice: 95,
      totalPrice: 95,
    });
  });

  it('returns stable duplicate-detection keys for suggestion and line item', () => {
    const suggestion = action({ actionType: 'suggest_material', targetId: 'mat-1' });
    const item = buildChecklistSuggestionLineItem({ action: suggestion, calculationId: 'calc-1', materials: [material], services: [service], id: 'line-1', now });

    expect(getChecklistSuggestionLineItemKey(suggestion, 'calc-1')).toBe('calc-1:material:mat-1');
    expect(item && getChecklistSuggestionLineItemKeyForItem(item)).toBe('calc-1:material:mat-1');
  });

  it('builds a billing note as a price-free info line item', () => {
    const suggestion = action({
      actionType: 'add_billing_note',
      targetType: 'calculation',
      targetId: null,
      targetContext: 'billing',
      payload: { note: 'Entsorgung separat aufführen' },
    });

    const item = buildChecklistSuggestionLineItem({ action: suggestion, calculationId: 'calc-1', materials: [material], services: [service], id: 'line-1', now });

    expect(item).toMatchObject({
      id: 'line-1',
      calculationId: 'calc-1',
      positionNumber: null,
      assetHeaderId: null,
      type: 'info',
      materialId: null,
      serviceId: null,
      description: 'Entsorgung separat aufführen',
      quantity: 0,
      unit: '',
      unitPrice: 0,
      totalPrice: 0,
    });
  });

  it('uses billing-note text for duplicate detection without exposing technical markers', () => {
    const suggestion = action({ actionType: 'add_billing_note', targetId: null, payload: { label: 'Expresszuschlag prüfen' } });
    const item = buildChecklistSuggestionLineItem({ action: suggestion, calculationId: 'calc-1', materials: [material], services: [service], id: 'line-1', now });

    expect(getChecklistSuggestionLineItemKey(suggestion, 'calc-1')).toBe('calc-1:billing_note:Expresszuschlag prüfen');
    expect(item && getChecklistSuggestionLineItemKeyForItem(item)).toBe('calc-1:billing_note:Expresszuschlag prüfen');
  });
});
