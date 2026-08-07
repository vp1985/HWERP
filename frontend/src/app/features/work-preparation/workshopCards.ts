import {
  type EditableNumberRangeConfig,
  WORKSHOP_CARD_NUMBER_RANGE_ID,
  buildNextNumber,
  findNumberRangeByIdOrLabel,
  reserveNextNumberFromRange,
} from '../../lib/numberRangeUtils';
import type { Service, WorkshopCardTask } from '../../lib/types';

export interface WorkshopTaskAttachmentHint {
  taskId: string;
  kind: 'photo' | 'protocol' | 'other';
}

export function buildNextWorkshopCardNumber(numberRanges: EditableNumberRangeConfig[]): string {
  return buildNextNumber(
    findNumberRangeByIdOrLabel(numberRanges, WORKSHOP_CARD_NUMBER_RANGE_ID, 'Werkstattkarten'),
  );
}

export function reserveNextWorkshopCardNumber(
  numberRanges: EditableNumberRangeConfig[],
): { cardNumber: string; numberRanges: EditableNumberRangeConfig[] } {
  const reserved = reserveNextNumberFromRange(numberRanges, WORKSHOP_CARD_NUMBER_RANGE_ID, 'Werkstattkarten');
  return { cardNumber: reserved.number, numberRanges: reserved.numberRanges };
}

function parseTimestamp(value: string | null): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

export function calculateWorkshopCardTotalMinutes(tasks: Pick<WorkshopCardTask, 'startedAt' | 'finishedAt'>[]): number {
  return tasks.reduce((total, task) => {
    const startedAt = parseTimestamp(task.startedAt);
    const finishedAt = parseTimestamp(task.finishedAt);
    if (startedAt === null || finishedAt === null || finishedAt <= startedAt) return total;
    return total + Math.round((finishedAt - startedAt) / 60000);
  }, 0);
}

export function getTaskCompletionBlocker(
  task: WorkshopCardTask,
  allTasks: WorkshopCardTask[],
  attachments: WorkshopTaskAttachmentHint[] = [],
): string | null {
  if (task.blockedByTaskId) {
    const prerequisite = allTasks.find((item) => item.id === task.blockedByTaskId);
    if (!prerequisite || prerequisite.status !== 'done') {
      const label = prerequisite?.title ?? task.blockedReason ?? 'Voraussetzung';
      return `Gesperrt: ${label} fehlt`;
    }
  }

  if (!task.employeeCode?.trim()) return 'Mitarbeiterkürzel fehlt';
  if (!task.signatureName?.trim()) return 'Unterschrift fehlt';
  if (task.photoRequired && !attachments.some((item) => item.taskId === task.id && item.kind === 'photo')) {
    return 'Pflichtfoto fehlt';
  }
  if (task.protocolRequired && !attachments.some((item) => item.taskId === task.id && item.kind === 'protocol')) {
    return 'Prüfprotokoll fehlt';
  }

  return null;
}

function newUuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (char) =>
    (Number(char) ^ (Math.random() * 16) >> (Number(char) / 4)).toString(16),
  );
}

export function makeInitialWorkshopCardTasks(
  cardId: string,
  services: Service[],
  now = new Date().toISOString(),
): WorkshopCardTask[] {
  return services
    .filter((service) => (service.active ?? true) && service.availableInWorkshopCards)
    .sort((left, right) => (left.sortOrder ?? 100) - (right.sortOrder ?? 100) || left.name.localeCompare(right.name, 'de'))
    .map((service) => ({
      id: newUuid(),
      cardId,
      templateId: null,
      serviceId: service.id,
      title: service.name,
      sortOrder: service.sortOrder ?? 100,
      status: 'open',
      required: service.workshopRequired ?? true,
      photoRequired: service.workshopPhotoRequired ?? false,
      protocolRequired: service.workshopProtocolRequired ?? false,
      blockedByTaskId: null,
      blockedReason: null,
      startedAt: null,
      finishedAt: null,
      employeeCode: null,
      signatureName: null,
      notes: null,
      measurementSummary: null,
      materialSummary: null,
      completedAt: null,
      createdAt: now,
      updatedAt: now,
    }));
}

export function formatWorkshopMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  if (rest === 0) return `${hours} h`;
  return `${hours} h ${rest} min`;
}
