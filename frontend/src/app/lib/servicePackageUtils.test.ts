import { describe, expect, it } from 'vitest';
import type { Material, Service, ServicePackage, ServicePackageItem } from './types';
import {
  buildServicePackageInfoItem,
  buildServicePackageItemFromMaterial,
  buildServicePackageItemFromService,
  calculateServicePackagePrice,
} from './servicePackageUtils';

const baseTimestamps = {
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const service: Service = {
  id: 'service-1',
  serviceNumber: 'SL0001',
  name: 'Sichtprüfung',
  description: 'Sichtprüfung Beschreibung',
  unit: 'Pauschal',
  price: 120,
  category: 'Trafo-Standsätze',
  active: true,
  availableInWorkshopCards: true,
  workshopCategory: 'Trafo-Standsätze',
  workshopRequired: true,
  workshopPhotoRequired: false,
  workshopProtocolRequired: false,
  workshopMeasurementsRequired: false,
  workshopMaterialEntryEnabled: false,
  sortOrder: 100,
  ...baseTimestamps,
};

const material: Material = {
  id: 'material-1',
  articleNumber: 'MAT-001',
  name: 'Ölprobe-Set',
  description: null,
  unit: 'Set',
  price: 18.5,
  supplier: 'Labor',
  category: 'Prüfung',
  ...baseTimestamps,
};

const packageBase: ServicePackage = {
  id: 'package-1',
  packageNumber: 'LP00001',
  name: 'Trafo-Standardprüfung',
  description: null,
  category: 'Trafo',
  active: true,
  priceMode: 'sum',
  fixedPrice: null,
  hintText: 'Anlage vor Prüfung spannungsfrei melden.',
  customerNote: 'Standardprüfung inkl. Dokumentation.',
  ...baseTimestamps,
};

const makeItem = (overrides: Partial<ServicePackageItem>): ServicePackageItem => ({
  id: 'item-1',
  packageId: 'package-1',
  type: 'service',
  serviceId: null,
  materialId: null,
  descriptionSnapshot: 'Position',
  quantity: 1,
  unitSnapshot: 'Stk',
  unitPriceSnapshot: 10,
  sortOrder: 100,
  ...baseTimestamps,
  ...overrides,
});

describe('service package utils', () => {
  it('builds package items from services, materials and free hint texts', () => {
    expect(buildServicePackageItemFromService(service, 'package-1', 2, 10)).toMatchObject({
      packageId: 'package-1',
      type: 'service',
      serviceId: 'service-1',
      materialId: null,
      descriptionSnapshot: 'Sichtprüfung',
      quantity: 2,
      unitSnapshot: 'Pauschal',
      unitPriceSnapshot: 120,
      sortOrder: 10,
    });

    expect(buildServicePackageItemFromMaterial(material, 'package-1', 3, 20)).toMatchObject({
      packageId: 'package-1',
      type: 'material',
      serviceId: null,
      materialId: 'material-1',
      descriptionSnapshot: 'Ölprobe-Set',
      quantity: 3,
      unitSnapshot: 'Set',
      unitPriceSnapshot: 18.5,
      sortOrder: 20,
    });

    expect(buildServicePackageInfoItem('Fotos vom Typenschild beifügen', 'package-1', 30)).toMatchObject({
      packageId: 'package-1',
      type: 'info',
      serviceId: null,
      materialId: null,
      descriptionSnapshot: 'Fotos vom Typenschild beifügen',
      quantity: 0,
      unitSnapshot: '',
      unitPriceSnapshot: 0,
      sortOrder: 30,
    });
  });

  it('calculates package price from service and material positions while ignoring hint text lines', () => {
    const items = [
      makeItem({ id: 'service-line', type: 'service', quantity: 2, unitPriceSnapshot: 120, sortOrder: 20 }),
      makeItem({ id: 'material-line', type: 'material', quantity: 3, unitPriceSnapshot: 18.5, sortOrder: 10 }),
      makeItem({ id: 'hint-line', type: 'info', quantity: 0, unitPriceSnapshot: 0, sortOrder: 15 }),
    ];

    expect(calculateServicePackagePrice(packageBase, items)).toBe(295.5);
  });

  it('uses fixed package price when configured', () => {
    expect(calculateServicePackagePrice({ ...packageBase, priceMode: 'fixed', fixedPrice: 249 }, [
      makeItem({ quantity: 10, unitPriceSnapshot: 999 }),
    ])).toBe(249);
  });
});
