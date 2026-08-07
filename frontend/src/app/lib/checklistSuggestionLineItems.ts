import type { CalculationLineItem, ChecklistItemAction, Material, Service } from './types';

interface BuildChecklistSuggestionLineItemOptions {
  action: ChecklistItemAction;
  calculationId: string;
  materials: Material[];
  services: Service[];
  id: string;
  now: string;
}

function getBillingNoteText(action: ChecklistItemAction): string | null {
  const payload = action.payload as { note?: unknown; label?: unknown; text?: unknown } | undefined;
  const text = [payload?.note, payload?.label, payload?.text, action.targetId]
    .find((value): value is string => typeof value === 'string' && value.trim().length > 0);
  return text?.trim() ?? null;
}

export function getChecklistSuggestionLineItemKey(action: ChecklistItemAction, calculationId: string): string | null {
  if (action.actionType === 'suggest_material') {
    return action.targetId ? `${calculationId}:material:${action.targetId}` : null;
  }
  if (action.actionType === 'suggest_service') {
    return action.targetId ? `${calculationId}:service:${action.targetId}` : null;
  }
  if (action.actionType === 'add_billing_note') {
    const text = getBillingNoteText(action);
    return text ? `${calculationId}:billing_note:${text}` : null;
  }
  return null;
}

export function getChecklistSuggestionLineItemKeyForItem(item: CalculationLineItem): string | null {
  if (item.type === 'material' && item.materialId) {
    return `${item.calculationId}:material:${item.materialId}`;
  }
  if (item.type === 'service' && item.serviceId) {
    return `${item.calculationId}:service:${item.serviceId}`;
  }
  if (item.type === 'info' && item.description.trim().length > 0) {
    return `${item.calculationId}:billing_note:${item.description.trim()}`;
  }
  return null;
}

export function buildChecklistSuggestionLineItem(options: BuildChecklistSuggestionLineItemOptions): CalculationLineItem | null {
  const { action, calculationId, id, now } = options;

  if (action.actionType === 'suggest_material' && action.targetId) {
    const material = options.materials.find((entry) => entry.id === action.targetId);
    if (!material) return null;
    return {
      id,
      calculationId,
      positionNumber: null,
      assetHeaderId: null,
      type: 'material',
      materialId: material.id,
      serviceId: null,
      description: material.name,
      quantity: 1,
      unit: material.unit,
      unitPrice: material.price,
      totalPrice: material.price,
      createdAt: now,
      updatedAt: now,
    };
  }

  if (action.actionType === 'suggest_service' && action.targetId) {
    const service = options.services.find((entry) => entry.id === action.targetId);
    if (!service) return null;
    return {
      id,
      calculationId,
      positionNumber: null,
      assetHeaderId: null,
      type: 'service',
      materialId: null,
      serviceId: service.id,
      description: service.name,
      quantity: 1,
      unit: service.unit,
      unitPrice: service.price,
      totalPrice: service.price,
      createdAt: now,
      updatedAt: now,
    };
  }

  if (action.actionType === 'add_billing_note') {
    const description = getBillingNoteText(action);
    if (!description) return null;
    return {
      id,
      calculationId,
      positionNumber: null,
      assetHeaderId: null,
      type: 'info',
      materialId: null,
      serviceId: null,
      description,
      quantity: 0,
      unit: '',
      unitPrice: 0,
      totalPrice: 0,
      createdAt: now,
      updatedAt: now,
    };
  }

  return null;
}
