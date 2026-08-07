import { describe, expect, it } from 'vitest';
import {
  buildNextWorkshopCardNumber,
  calculateWorkshopCardTotalMinutes,
  getTaskCompletionBlocker,
  makeInitialWorkshopCardTasks,
  reserveNextWorkshopCardNumber,
} from './workshopCards';
import type { Service, WorkshopCardTask } from '../../lib/types';

const baseTask = (overrides: Partial<WorkshopCardTask>): WorkshopCardTask => ({
  id: overrides.id ?? 'task-1',
  cardId: overrides.cardId ?? 'card-1',
  templateId: overrides.templateId ?? null,
  serviceId: overrides.serviceId ?? null,
  title: overrides.title ?? 'Eingangsprüfung',
  sortOrder: overrides.sortOrder ?? 10,
  status: overrides.status ?? 'open',
  required: overrides.required ?? true,
  photoRequired: overrides.photoRequired ?? false,
  protocolRequired: overrides.protocolRequired ?? false,
  blockedByTaskId: overrides.blockedByTaskId ?? null,
  blockedReason: overrides.blockedReason ?? null,
  startedAt: overrides.startedAt ?? null,
  finishedAt: overrides.finishedAt ?? null,
  employeeCode: overrides.employeeCode ?? null,
  signatureName: overrides.signatureName ?? null,
  notes: overrides.notes ?? null,
  measurementSummary: overrides.measurementSummary ?? null,
  materialSummary: overrides.materialSummary ?? null,
  completedAt: overrides.completedAt ?? null,
  createdAt: overrides.createdAt ?? '2026-06-03T08:00:00.000Z',
  updatedAt: overrides.updatedAt ?? '2026-06-03T08:00:00.000Z',
});

const baseService = (overrides: Partial<Service>): Service => ({
  id: overrides.id ?? 'srv-1',
  serviceNumber: overrides.serviceNumber ?? 'SL0001',
  name: overrides.name ?? 'Eingangsprüfung',
  description: overrides.description ?? null,
  unit: overrides.unit ?? 'Pauschal',
  price: overrides.price ?? 0,
  category: overrides.category ?? 'TX-Standsätze',
  active: overrides.active ?? true,
  availableInWorkshopCards: overrides.availableInWorkshopCards ?? true,
  workshopCategory: overrides.workshopCategory ?? 'TX-Standsätze',
  workshopRequired: overrides.workshopRequired ?? true,
  workshopPhotoRequired: overrides.workshopPhotoRequired ?? false,
  workshopProtocolRequired: overrides.workshopProtocolRequired ?? false,
  workshopMeasurementsRequired: overrides.workshopMeasurementsRequired ?? false,
  workshopMaterialEntryEnabled: overrides.workshopMaterialEntryEnabled ?? false,
  sortOrder: overrides.sortOrder ?? 10,
  createdAt: overrides.createdAt ?? '2026-06-03T08:00:00.000Z',
  updatedAt: overrides.updatedAt ?? '2026-06-03T08:00:00.000Z',
});

describe('Trafo-Werkstattkarten domain helpers', () => {
  it('builds and reserves card numbers from the central Werkstattkarten number range', () => {
    const ranges = [
      { id: 'workshop-cards', label: 'Werkstattkarten', prefix: 'WK-', digits: 5, nextNumber: 1, suffix: '-26' },
    ];

    expect(buildNextWorkshopCardNumber(ranges)).toBe('WK-00001-26');
    expect(reserveNextWorkshopCardNumber(ranges)).toEqual({
      cardNumber: 'WK-00001-26',
      numberRanges: [
        { id: 'workshop-cards', label: 'Werkstattkarten', prefix: 'WK-', digits: 5, nextNumber: 2, suffix: '-26' },
      ],
    });
  });

  it('calculates total card time from per-task from/to timestamps', () => {
    const tasks = [
      baseTask({ id: 't1', startedAt: '2026-06-03T08:00:00.000Z', finishedAt: '2026-06-03T09:15:00.000Z' }),
      baseTask({ id: 't2', startedAt: '2026-06-03T10:00:00.000Z', finishedAt: '2026-06-03T10:30:00.000Z' }),
      baseTask({ id: 't3', startedAt: '2026-06-03T11:00:00.000Z', finishedAt: null }),
    ];

    expect(calculateWorkshopCardTotalMinutes(tasks)).toBe(105);
  });

  it('hard-blocks dependent tasks until their prerequisite task is done', () => {
    const tasks = [
      baseTask({ id: 'entry', title: 'Eingangsprüfung', status: 'open' }),
      baseTask({ id: 'hv', title: 'Hochspannungsprüfung', blockedByTaskId: 'entry' }),
    ];

    expect(getTaskCompletionBlocker(tasks[1], tasks, [])).toBe('Gesperrt: Eingangsprüfung fehlt');
  });

  it('requires employee code, signature and protocol attachment before completing configured inspection tasks', () => {
    const task = baseTask({
      employeeCode: 'VL',
      signatureName: null,
      protocolRequired: true,
    });

    expect(getTaskCompletionBlocker(task, [task], [])).toBe('Unterschrift fehlt');
    expect(getTaskCompletionBlocker({ ...task, signatureName: 'Vale' }, [task], [])).toBe('Prüfprotokoll fehlt');
    expect(getTaskCompletionBlocker({ ...task, signatureName: 'Vale' }, [task], [{ taskId: task.id, kind: 'protocol' }])).toBeNull();
  });

  it('turns active workshop-enabled Leistungen into ordered card tasks for Postgres persistence', () => {
    const services: Service[] = [
      baseService({ id: 'srv-photo', name: 'Fotodokumentation', sortOrder: 80, workshopRequired: false, workshopPhotoRequired: true }),
      baseService({ id: 'srv-disabled', name: 'Alt', sortOrder: 5, active: false }),
      baseService({ id: 'srv-not-workshop', name: 'Kalkulation', sortOrder: 1, availableInWorkshopCards: false }),
    ];

    expect(makeInitialWorkshopCardTasks('card-1', services, '2026-06-03T09:00:00.000Z')).toEqual([
      expect.objectContaining({
        cardId: 'card-1',
        serviceId: 'srv-photo',
        templateId: null,
        title: 'Fotodokumentation',
        sortOrder: 80,
        status: 'open',
        required: false,
        photoRequired: true,
      }),
    ]);
  });
});
