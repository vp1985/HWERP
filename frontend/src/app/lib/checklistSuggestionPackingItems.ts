import type { ChecklistItemAction, ChecklistRunItem, Material } from './types';

const PACKING_ITEM_SOURCE_PREFIX = 'checklist-suggestion';

interface BuildChecklistSuggestionPackingItemOptions {
  action: ChecklistItemAction;
  runId: string;
  materials: Material[];
  sortOrder: number;
  id: string;
  now: string;
}

function sourceMarker(action: ChecklistItemAction): string | null {
  if (action.actionType !== 'create_packing_item' || !action.targetId) return null;
  return `${PACKING_ITEM_SOURCE_PREFIX}:${action.id}:material:${action.targetId}`;
}

export function getChecklistSuggestionPackingItemKey(action: ChecklistItemAction, runId: string): string | null {
  const marker = sourceMarker(action);
  return marker ? `${runId}:${marker}` : null;
}

export function getChecklistSuggestionPackingItemKeyForItem(item: ChecklistRunItem): string | null {
  const marker = item.blockedReason?.startsWith(PACKING_ITEM_SOURCE_PREFIX) ? item.blockedReason : null;
  return marker ? `${item.runId}:${marker}` : null;
}

export function buildChecklistSuggestionPackingItem(options: BuildChecklistSuggestionPackingItemOptions): ChecklistRunItem | null {
  const { action, runId, materials, sortOrder, id, now } = options;
  const marker = sourceMarker(action);
  if (!marker || !action.targetId) return null;

  const material = materials.find((entry) => entry.id === action.targetId);
  if (!material) return null;

  const label = (action.payload as { label?: string } | undefined)?.label?.trim();
  return {
    id,
    runId,
    templateItemId: null,
    groupTitleSnapshot: 'Material / Ersatzteile',
    title: label || material.name,
    description: material.description,
    sortOrder,
    required: true,
    status: 'open',
    quantity: 1,
    unit: material.unit,
    note: 'Aus Checklisten-Vorschlag übernommen.',
    measurementValue: null,
    employeeCode: null,
    signatureName: null,
    startedAt: null,
    finishedAt: null,
    completedAt: null,
    completedBy: null,
    blockedReason: marker,
    responseType: 'check',
    choiceOptions: [],
    selectedChoice: null,
    dependsOnTemplateItemIds: [],
    createdAt: now,
    updatedAt: now,
  };
}
