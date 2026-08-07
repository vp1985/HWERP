import { describe, expect, it } from 'vitest';
import type { ServiceReport } from './types';
import {
  duplicateReportDraft,
  pathForServiceTab,
  serviceTabFromPath,
  validateReportForm,
} from './utils';
import { demoCustomers, demoReports } from './data/demoData';

const baseReport: ServiceReport = {
  id: 'r-test',
  reportNumber: 'LS-2026-000150-KOPIE',
  type: 'measurement_protocol',
  customerId: 'c1',
  locationId: 'l1',
  assetId: 'a1',
  values: { reportNumber: 'LS-2026-000150-KOPIE' },
  status: 'bereit zum Sync',
  syncStatus: 'synced',
  createdBy: 'Tim Wagner',
  createdAt: '2026-05-18T12:00:00.000Z',
};

describe('service report helpers', () => {
  it('maps service tabs to stable route paths and back', () => {
    expect(pathForServiceTab('dashboard')).toBe('/service');
    expect(pathForServiceTab('reports')).toBe('/service/reports');
    expect(pathForServiceTab('sync')).toBe('/service/sync');
    expect(serviceTabFromPath('/service/reports')).toBe('reports');
    expect(serviceTabFromPath('/unknown')).toBe('dashboard');
  });

  it('duplicates reports without chaining copy suffixes and resets draft/sync state', () => {
    const copy = duplicateReportDraft(baseReport, 'copy-1', '2026-05-18T13:00:00.000Z');

    expect(copy.reportNumber).toBe('LS-2026-000150-KOPIE');
    expect(copy.values.reportNumber).toBe('LS-2026-000150-KOPIE');
    expect(copy.status).toBe('Entwurf');
    expect(copy.syncStatus).toBe('pending');
    expect(copy.createdAt).toBe('2026-05-18T13:00:00.000Z');
  });

  it('validates required fields, existing references, duplicates and numeric measurement values', () => {
    const errors = validateReportForm(
      'measurement_protocol',
      {
        reportNumber: 'LS-2026-000121',
        customerId: 'c1',
        locationId: 'l1',
        assetId: 'missing-asset',
        technician: 'Tim Wagner',
        date: '2026-04-24',
        contactResistance: 'abc',
        tripTime: '43',
        insulationResistance: '520',
      },
      demoCustomers,
      demoReports,
    );

    expect(errors).toContain('Berichtnummer ist bereits vorhanden.');
    expect(errors).toContain('Asset-ID ist am Standort nicht vorhanden.');
    expect(errors).toContain('Kontaktwiderstand muss eine Zahl sein.');
  });

  it('accepts a complete maintenance report', () => {
    const errors = validateReportForm(
      'maintenance_report',
      {
        reportNumber: 'WB-2026-QA001',
        customerId: 'c1',
        locationId: 'l1',
        assetId: 'a1',
        technician: 'Tim Wagner',
        date: '2026-04-24',
        workDone: 'Wartung geprüft',
      },
      demoCustomers,
      demoReports,
    );

    expect(errors).toEqual([]);
  });
});
