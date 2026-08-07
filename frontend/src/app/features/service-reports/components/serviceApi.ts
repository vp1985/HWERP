import { ServiceOrder, ServiceReport } from '../types';

/**
 * API-Adapter für spätere Backend-Integration.
 * Aktuell bewusst nur Prototyp-Stub mit Promise-Signatur.
 */
export async function fetchServiceOrders(): Promise<ServiceOrder[]> {
  return Promise.resolve([]);
}

export async function createServiceReport(report: ServiceReport): Promise<ServiceReport> {
  return Promise.resolve(report);
}

export async function syncServiceReports(reports: ServiceReport[]): Promise<{ syncedIds: string[] }> {
  return Promise.resolve({ syncedIds: reports.map((report) => report.id) });
}
