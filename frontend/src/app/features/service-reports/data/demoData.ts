import { ReservedNumber, ServiceCustomer, ServiceOrder, ServiceReport, SyncQueueItem } from '../types';

export const SERVICE_TECHNICIANS = ['Tim Wagner', 'Lea Scholz', 'Murat Kaya', 'Alicia Berg'];
export const NUMBER_CIRCLES = ['LS-2026', 'WB-2026', 'DGUV-2026'];

export const demoCustomers: ServiceCustomer[] = [
  {
    id: 'c1',
    customerNumber: 'KD-1001',
    name: 'Musterbetrieb Nord GmbH',
    contactPerson: 'Demo Kontakt 01',
    email: 'service-01@example.com',
    phone: '+49 30 0000 01',
    locations: [
      {
        id: 'l1',
        name: 'Werk Hamburg Nord',
        assets: [
          { id: 'a1', name: 'Hauptverteilung HV-01', assetNumber: 'AST-0001', type: 'Hauptverteilung', locationName: 'Werk Hamburg Nord', lastInspectionStatus: 'i.O.', nextInspectionDate: '2026-07-12', lastReportNumber: 'LS-2026-000112' },
          { id: 'a2', name: 'Leistungsschalter LS-01', assetNumber: 'AST-0002', type: 'Leistungsschalter', locationName: 'Werk Hamburg Nord', lastInspectionStatus: 'Mangel', nextInspectionDate: '2026-05-08', lastReportNumber: 'LS-2026-000115' },
        ],
      },
    ],
  },
  {
    id: 'c2',
    customerNumber: 'KD-1002',
    name: 'Musterbetrieb West GmbH',
    contactPerson: 'Demo Kontakt 02',
    email: 'service-02@example.com',
    phone: '+49 30 0000 02',
    locations: [
      {
        id: 'l2',
        name: 'Büropark Bremen',
        assets: [
          { id: 'a3', name: 'Notbeleuchtung Ebene 2', assetNumber: 'AST-0103', type: 'Notbeleuchtung', locationName: 'Büropark Bremen', lastInspectionStatus: 'i.O.', nextInspectionDate: '2026-09-01', lastReportNumber: 'DGUV-2026-000031' },
          { id: 'a4', name: 'RWA-Zentrale', assetNumber: 'AST-0104', type: 'RWA', locationName: 'Büropark Bremen', lastInspectionStatus: 'i.O.', nextInspectionDate: '2026-08-17', lastReportNumber: 'WB-2026-000077' },
        ],
      },
    ],
  },
  {
    id: 'c3',
    customerNumber: 'KD-1003',
    name: 'Musterbetrieb Süd GmbH',
    contactPerson: 'Demo Kontakt 03',
    email: 'service-03@example.com',
    phone: '+49 30 0000 03',
    locations: [
      {
        id: 'l3',
        name: 'Filiale Hannover',
        assets: [
          { id: 'a5', name: 'Kompressorstation', assetNumber: 'AST-0222', type: 'Druckluft', locationName: 'Filiale Hannover', lastInspectionStatus: 'Wartung fällig', nextInspectionDate: '2026-05-02', lastReportNumber: 'WB-2026-000091' },
        ],
      },
    ],
  },
  {
    id: 'c4',
    customerNumber: 'KD-1004',
    name: 'Musterbetrieb Ost GmbH',
    contactPerson: 'Demo Kontakt 04',
    email: 'service-04@example.com',
    phone: '+49 30 0000 04',
    locations: [
      {
        id: 'l4',
        name: 'Umspannwerk Süd',
        assets: [
          { id: 'a6', name: 'Leistungsschalter LS-07', assetNumber: 'AST-0310', type: 'Leistungsschalter', locationName: 'Umspannwerk Süd', lastInspectionStatus: 'i.O.', nextInspectionDate: '2026-11-20', lastReportNumber: 'LS-2026-000098' },
        ],
      },
    ],
  },
];

export const demoOrders: ServiceOrder[] = [
  {
    id: 'o1',
    orderNumber: 'A-2026-0042',
    customerId: 'c1',
    locationId: 'l1',
    technician: 'Tim Wagner',
    plannedDate: '2026-04-28',
    description: 'DGUV V3 und Messung Leistungsschalter',
    assetIds: ['a1', 'a2'],
    reservedNumbers: ['LS-2026-000120', 'LS-2026-000121'],
    reportIds: ['r1'],
    status: 'in Bearbeitung',
  },
  {
    id: 'o2',
    orderNumber: 'A-2026-0043',
    customerId: 'c2',
    locationId: 'l2',
    technician: 'Lea Scholz',
    plannedDate: '2026-04-30',
    description: 'Wartung Notbeleuchtung und RWA',
    assetIds: ['a3', 'a4'],
    reservedNumbers: ['WB-2026-000145'],
    reportIds: ['r2'],
    status: 'offline verfügbar',
  },
  {
    id: 'o3',
    orderNumber: 'A-2026-0044',
    customerId: 'c3',
    locationId: 'l3',
    technician: 'Murat Kaya',
    plannedDate: '2026-05-03',
    description: 'Kompressorstation Sicht-Check',
    assetIds: ['a5'],
    reservedNumbers: [],
    reportIds: [],
    status: 'geplant',
  },
];

export const demoReservedNumbers: ReservedNumber[] = [
  { id: 'n1', numberCircle: 'LS-2026', value: 'LS-2026-000120', orderId: 'o1', customerId: 'c1', status: 'reserviert' },
  { id: 'n2', numberCircle: 'LS-2026', value: 'LS-2026-000121', orderId: 'o1', customerId: 'c1', status: 'verwendet' },
  { id: 'n3', numberCircle: 'WB-2026', value: 'WB-2026-000145', orderId: 'o2', customerId: 'c2', status: 'reserviert' },
  { id: 'n4', numberCircle: 'DGUV-2026', value: 'DGUV-2026-000031', orderId: 'o2', customerId: 'c2', status: 'verwendet' },
];

export const demoReports: ServiceReport[] = [
  {
    id: 'r1',
    reportNumber: 'LS-2026-000121',
    type: 'measurement_protocol',
    customerId: 'c1',
    locationId: 'l1',
    assetId: 'a2',
    orderNumber: 'A-2026-0042',
    values: { contactResistance: '0.18 mOhm', tripTime: '42 ms', insulationResistance: '2.3 MOhm', visualInspectionPassed: true },
    status: 'Entwurf',
    syncStatus: 'pending',
    createdBy: 'Tim Wagner',
    createdAt: '2026-04-23T08:15:00.000Z',
  },
  {
    id: 'r2',
    reportNumber: 'WB-2026-000145',
    type: 'maintenance_report',
    customerId: 'c2',
    locationId: 'l2',
    assetId: 'a4',
    orderNumber: 'A-2026-0043',
    values: { workDone: 'RWA-Steuerung gereinigt und getestet', workingTime: '2.5 h', defectsPresent: 'nein' },
    status: 'bereit zum Sync',
    syncStatus: 'pending',
    createdBy: 'Lea Scholz',
    createdAt: '2026-04-23T12:45:00.000Z',
  },
  {
    id: 'r3',
    reportNumber: 'DGUV-2026-000032',
    type: 'checklist',
    customerId: 'c4',
    locationId: 'l4',
    assetId: 'a6',
    values: { checklistName: 'Jahrescheck Umspannwerk', checkedItems: ['Sichtprüfung', 'Schutzrelais'], score: 'gut' },
    status: 'abgeschlossen',
    syncStatus: 'synced',
    createdBy: 'Alicia Berg',
    createdAt: '2026-04-20T09:30:00.000Z',
  },
];

export const demoSyncQueue: SyncQueueItem[] = [
  { reportId: 'r1', reportNumber: 'LS-2026-000121', queuedAt: '2026-04-23T08:15:00.000Z' },
  { reportId: 'r2', reportNumber: 'WB-2026-000145', queuedAt: '2026-04-23T12:45:00.000Z' },
];
