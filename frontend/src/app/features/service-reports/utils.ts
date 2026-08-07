import { ReportType, ServiceCustomer, ServiceOrder, ServiceReport } from './types';

export type ServiceTab = 'dashboard' | 'orders' | 'numbers' | 'reports' | 'templates' | 'sync';

const TAB_PATHS: Record<ServiceTab, string> = {
  dashboard: '/service',
  orders: '/service/orders',
  numbers: '/service/numbers',
  reports: '/service/reports',
  templates: '/service/templates',
  sync: '/service/sync',
};

export function pathForServiceTab(tab: ServiceTab) {
  return TAB_PATHS[tab];
}

export function serviceTabFromPath(path: string): ServiceTab {
  return (Object.entries(TAB_PATHS).find(([, value]) => value === path)?.[0] as ServiceTab | undefined) ?? 'dashboard';
}

export const reportTypeLabel: Record<ServiceReport['type'], string> = {
  measurement_protocol: 'Messprotokoll Leistungsschalter',
  maintenance_report: 'Wartungsbericht allgemein',
  checklist: 'Checkliste',
};

export function findCustomer(customers: ServiceCustomer[], customerId: string) {
  return customers.find((customer) => customer.id === customerId);
}

export function findLocation(customers: ServiceCustomer[], customerId: string, locationId: string) {
  return findCustomer(customers, customerId)?.locations.find((location) => location.id === locationId);
}

export function allAssets(customers: ServiceCustomer[]) {
  return customers.flatMap((customer) => customer.locations.flatMap((location) => location.assets));
}

export function nextNumbersForCircle(circle: string, quantity: number, existing: string[]) {
  const parsedMax = existing
    .filter((value) => value.startsWith(circle))
    .map((value) => Number(value.split('-').at(-1)))
    .filter((value) => Number.isFinite(value));

  let current = parsedMax.length > 0 ? Math.max(...parsedMax) : 0;
  const created: string[] = [];

  for (let i = 0; i < quantity; i += 1) {
    current += 1;
    created.push(`${circle}-${String(current).padStart(6, '0')}`);
  }

  return created;
}

export function reportToExport(report: ServiceReport, customers: ServiceCustomer[]) {
  const customer = findCustomer(customers, report.customerId);
  const location = customer?.locations.find((item) => item.id === report.locationId);
  const asset = location?.assets.find((item) => item.id === report.assetId);

  return {
    reportNumber: report.reportNumber,
    type: report.type,
    customer: customer?.name ?? '',
    location: location?.name ?? '',
    asset: asset?.name ?? '',
    orderNumber: report.orderNumber ?? '',
    values: report.values,
    syncStatus: report.syncStatus,
  };
}

export function lastSyncText(isOnline: boolean, reports: ServiceReport[]) {
  if (!isOnline) return 'Offline – letzte Synchronisation pausiert';
  const pending = reports.filter((report) => report.syncStatus === 'pending').length;
  return pending === 0 ? 'Alle Berichte synchronisiert' : `${pending} Bericht(e) warten auf Synchronisation`;
}

export function orderLabel(orders: ServiceOrder[], orderId: string) {
  return orders.find((order) => order.id === orderId)?.orderNumber ?? '–';
}

export function duplicateReportDraft(report: ServiceReport, id: string, createdAt: string): ServiceReport {
  const baseReportNumber = report.reportNumber.replace(/(?:-KOPIE)+$/, '');
  const reportNumber = `${baseReportNumber}-KOPIE`;

  return {
    ...report,
    id,
    reportNumber,
    values: { ...report.values, reportNumber },
    status: 'Entwurf',
    syncStatus: 'pending',
    createdAt,
  };
}

export function validateReportForm(
  type: ReportType,
  values: Record<string, string | boolean | string[]>,
  customers: ServiceCustomer[],
  existingReports: ServiceReport[],
) {
  const errors: string[] = [];
  const text = (key: string) => String(values[key] ?? '').trim();
  const requireText = (key: string, label: string) => {
    if (!text(key)) errors.push(`${label} ist erforderlich.`);
  };
  const requireNumber = (key: string, label: string) => {
    const value = text(key).replace(',', '.');
    if (!value) {
      errors.push(`${label} ist erforderlich.`);
      return;
    }
    if (!Number.isFinite(Number(value))) errors.push(`${label} muss eine Zahl sein.`);
  };

  requireText('reportNumber', 'Berichtnummer');
  requireText('customerId', 'Kunde-ID');
  requireText('locationId', 'Standort-ID');
  requireText('technician', 'Techniker');
  requireText('date', 'Datum');

  const reportNumber = text('reportNumber');
  if (reportNumber && existingReports.some((report) => report.reportNumber === reportNumber)) {
    errors.push('Berichtnummer ist bereits vorhanden.');
  }

  const customer = findCustomer(customers, text('customerId'));
  if (text('customerId') && !customer) {
    errors.push('Kunde-ID ist nicht vorhanden.');
  }

  const location = customer?.locations.find((item) => item.id === text('locationId'));
  if (text('locationId') && customer && !location) {
    errors.push('Standort-ID ist beim Kunden nicht vorhanden.');
  }

  const assetId = text('assetId');
  if (assetId && location && !location.assets.some((asset) => asset.id === assetId)) {
    errors.push('Asset-ID ist am Standort nicht vorhanden.');
  }

  if (type === 'measurement_protocol') {
    requireText('visualInspectionPassed', 'Sichtprüfung');
    requireNumber('contactResistance', 'Kontaktwiderstand');
    requireNumber('tripTime', 'Auslösezeit');
    requireNumber('insulationResistance', 'Isolationswiderstand');
  }

  if (type === 'maintenance_report') {
    requireText('workDone', 'Ausgeführte Arbeiten');
  }

  if (type === 'checklist') {
    requireText('checklistName', 'Checklistenname');
    requireText('checkpoints', 'Prüfpunkte');
  }

  return errors;
}
