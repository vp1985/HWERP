import type { ChecklistItemAction, Service, WorkshopCardTask } from './types';

const WORKSHOP_TASK_SOURCE_PREFIX = 'checklist-suggestion-task';

interface BuildChecklistSuggestionWorkshopTaskOptions {
  action: ChecklistItemAction;
  cardId: string;
  services: Service[];
  sortOrder: number;
  id: string;
  now: string;
}

function sourceMarker(action: ChecklistItemAction): string | null {
  if (action.actionType !== 'create_task') return null;
  const targetPart = action.targetId ? `service:${action.targetId}` : 'free';
  return `${WORKSHOP_TASK_SOURCE_PREFIX}:${action.id}:${targetPart}`;
}

export function getChecklistSuggestionWorkshopTaskKey(action: ChecklistItemAction, cardId: string): string | null {
  const marker = sourceMarker(action);
  return marker ? `${cardId}:${marker}` : null;
}

export function getChecklistSuggestionWorkshopTaskKeyForTask(task: WorkshopCardTask): string | null {
  const marker = task.blockedReason?.startsWith(WORKSHOP_TASK_SOURCE_PREFIX) ? task.blockedReason : null;
  return marker ? `${task.cardId}:${marker}` : null;
}

export function buildChecklistSuggestionWorkshopTask(options: BuildChecklistSuggestionWorkshopTaskOptions): WorkshopCardTask | null {
  const { action, cardId, services, sortOrder, id, now } = options;
  const marker = sourceMarker(action);
  if (!marker) return null;

  const service = action.targetId ? services.find((entry) => entry.id === action.targetId) : null;
  const label = (action.payload as { label?: string } | undefined)?.label?.trim();
  const title = label || service?.name || 'Aufgabe aus Checkliste';

  return {
    id,
    cardId,
    templateId: null,
    serviceId: service?.id ?? null,
    title,
    sortOrder,
    status: 'open',
    required: true,
    photoRequired: service?.workshopPhotoRequired ?? false,
    protocolRequired: service?.workshopProtocolRequired ?? false,
    blockedByTaskId: null,
    blockedReason: marker,
    startedAt: null,
    finishedAt: null,
    employeeCode: null,
    signatureName: null,
    notes: 'Aus Checklisten-Vorschlag übernommen.',
    measurementSummary: null,
    materialSummary: null,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}
