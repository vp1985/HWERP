import type { Material, Service, ServicePackage, ServicePackageItem } from './types';
import { uuid } from './utils';

const EMPTY_TIMESTAMPS = { createdAt: '', updatedAt: '' };

function normalizeQuantity(quantity: number): number {
  return Number.isFinite(quantity) ? Math.max(0, quantity) : 0;
}

function normalizePrice(price: number | null | undefined): number {
  return Number.isFinite(price) ? Math.max(0, Number(price)) : 0;
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateServicePackagePrice(pkg: ServicePackage, items: ServicePackageItem[]): number {
  if (pkg.priceMode === 'fixed') {
    return roundMoney(normalizePrice(pkg.fixedPrice));
  }

  return roundMoney(
    items.reduce((sum, item) => {
      if (item.type === 'info') return sum;
      return sum + normalizeQuantity(item.quantity) * normalizePrice(item.unitPriceSnapshot);
    }, 0),
  );
}

export function buildServicePackageItemFromService(
  service: Service,
  packageId: string,
  quantity = 1,
  sortOrder = 100,
): ServicePackageItem {
  return {
    id: uuid(),
    packageId,
    type: 'service',
    serviceId: service.id,
    materialId: null,
    descriptionSnapshot: service.name,
    quantity: normalizeQuantity(quantity),
    unitSnapshot: service.unit,
    unitPriceSnapshot: normalizePrice(service.price),
    sortOrder,
    ...EMPTY_TIMESTAMPS,
  };
}

export function buildServicePackageItemFromMaterial(
  material: Material,
  packageId: string,
  quantity = 1,
  sortOrder = 100,
): ServicePackageItem {
  return {
    id: uuid(),
    packageId,
    type: 'material',
    serviceId: null,
    materialId: material.id,
    descriptionSnapshot: material.name,
    quantity: normalizeQuantity(quantity),
    unitSnapshot: material.unit,
    unitPriceSnapshot: normalizePrice(material.price),
    sortOrder,
    ...EMPTY_TIMESTAMPS,
  };
}

export function buildServicePackageInfoItem(
  text: string,
  packageId: string,
  sortOrder = 100,
): ServicePackageItem {
  return {
    id: uuid(),
    packageId,
    type: 'info',
    serviceId: null,
    materialId: null,
    descriptionSnapshot: text.trim(),
    quantity: 0,
    unitSnapshot: '',
    unitPriceSnapshot: 0,
    sortOrder,
    ...EMPTY_TIMESTAMPS,
  };
}

export function sortServicePackageItems(items: ServicePackageItem[]): ServicePackageItem[] {
  return [...items].sort((a, b) => a.sortOrder - b.sortOrder || a.descriptionSnapshot.localeCompare(b.descriptionSnapshot));
}
