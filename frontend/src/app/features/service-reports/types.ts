export const ORDER_STATUSES = ['geplant', 'offline verfügbar', 'in Bearbeitung', 'abgeschlossen', 'synchronisiert'] as const;
export const NUMBER_STATUSES = ['frei', 'reserviert', 'verwendet', 'zurückgegeben'] as const;
export const REPORT_STATUSES = ['Entwurf', 'abgeschlossen', 'bereit zum Sync'] as const;
export const SYNC_STATUSES = ['pending', 'synced'] as const;
export const REPORT_TYPES = ['measurement_protocol', 'maintenance_report', 'checklist'] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];
export type NumberStatus = (typeof NUMBER_STATUSES)[number];
export type ReportStatus = (typeof REPORT_STATUSES)[number];
export type SyncStatus = (typeof SYNC_STATUSES)[number];
export type ReportType = (typeof REPORT_TYPES)[number];

export interface ServiceAsset {
  id: string;
  name: string;
  assetNumber: string;
  type: string;
  locationName: string;
  lastInspectionStatus: string;
  nextInspectionDate: string;
  lastReportNumber: string;
}

export interface ServiceLocation {
  id: string;
  name: string;
  assets: ServiceAsset[];
}

export interface ServiceCustomer {
  id: string;
  customerNumber: string;
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  locations: ServiceLocation[];
}

export interface ServiceOrder {
  id: string;
  orderNumber: string;
  customerId: string;
  locationId: string;
  technician: string;
  plannedDate: string;
  description: string;
  assetIds: string[];
  reservedNumbers: string[];
  reportIds: string[];
  status: OrderStatus;
}

export interface ReservedNumber {
  id: string;
  numberCircle: string;
  value: string;
  orderId: string;
  customerId: string;
  status: NumberStatus;
}

export interface ServiceReport {
  id: string;
  reportNumber: string;
  type: ReportType;
  customerId: string;
  locationId: string;
  assetId?: string;
  orderNumber?: string;
  values: Record<string, string | boolean | string[]>;
  status: ReportStatus;
  syncStatus: SyncStatus;
  createdBy: string;
  createdAt: string;
}

export interface SyncQueueItem {
  reportId: string;
  reportNumber: string;
  queuedAt: string;
}
