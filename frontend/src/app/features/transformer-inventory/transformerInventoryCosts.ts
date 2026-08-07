import type { Material, Service, ServicePackage, ServicePackageItem } from '../../lib/types';
import { calculateServicePackagePrice } from '../../lib/servicePackageUtils';
import type { TransformerInventoryCostItem, TransformerInventoryCostItemType } from './types';

export interface TransformerCostBuildOptions {
  id: string;
  inventoryPosition: string;
  assetId?: string | null;
  quantity?: number | string;
  performedAt: string;
  note?: string | null;
  sortOrder: number;
  now: string;
}

function normalizeQuantity(value: number | string | null | undefined): number {
  if (value === null || value === undefined || value === '') return 1;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function normalizePrice(value: number | string | null | undefined): number {
  if (value === null || value === undefined || value === '') return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

export function roundTransformerMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function buildCostItem(input: {
  type: TransformerInventoryCostItemType;
  sourceId?: string | null;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  options: TransformerCostBuildOptions;
}): TransformerInventoryCostItem {
  const quantity = normalizeQuantity(input.quantity);
  const unitPrice = normalizePrice(input.unitPrice);
  return {
    id: input.options.id,
    inventoryPosition: input.options.inventoryPosition.trim().toUpperCase(),
    assetId: input.options.assetId ?? null,
    type: input.type,
    sourceId: input.sourceId ?? null,
    description: input.description.trim(),
    quantity,
    unit: input.unit,
    unitPrice,
    totalPrice: roundTransformerMoney(quantity * unitPrice),
    performedAt: input.options.performedAt,
    note: input.options.note?.trim() || null,
    sortOrder: input.options.sortOrder,
    createdAt: input.options.now,
    updatedAt: input.options.now,
  };
}

export function buildPurchaseCostItem(price: number | string, options: TransformerCostBuildOptions): TransformerInventoryCostItem {
  return buildCostItem({
    type: 'purchase',
    sourceId: null,
    description: 'Einkaufspreis',
    quantity: 1,
    unit: 'Pauschal',
    unitPrice: normalizePrice(price),
    options,
  });
}

export function buildTransformerCostItemFromService(service: Service, options: TransformerCostBuildOptions): TransformerInventoryCostItem {
  return buildCostItem({
    type: 'service',
    sourceId: service.id,
    description: service.name,
    quantity: normalizeQuantity(options.quantity),
    unit: service.unit,
    unitPrice: normalizePrice(service.price),
    options,
  });
}

export function buildTransformerCostItemFromMaterial(material: Material, options: TransformerCostBuildOptions): TransformerInventoryCostItem {
  return buildCostItem({
    type: 'material',
    sourceId: material.id,
    description: material.name,
    quantity: normalizeQuantity(options.quantity),
    unit: material.unit,
    unitPrice: normalizePrice(material.price),
    options,
  });
}

export function buildTransformerCostItemFromPackage(
  pkg: ServicePackage,
  packageItems: ServicePackageItem[],
  options: TransformerCostBuildOptions,
): TransformerInventoryCostItem {
  const price = calculateServicePackagePrice(pkg, packageItems.filter((item) => item.packageId === pkg.id));
  return buildCostItem({
    type: 'package',
    sourceId: pkg.id,
    description: pkg.name,
    quantity: normalizeQuantity(options.quantity),
    unit: 'Paket',
    unitPrice: price,
    options,
  });
}

export function buildManualTransformerCostItem(input: {
  type?: Extract<TransformerInventoryCostItemType, 'service' | 'material' | 'manual'>;
  description: string;
  unit?: string;
  unitPrice: number | string;
  options: TransformerCostBuildOptions;
}): TransformerInventoryCostItem {
  return buildCostItem({
    type: input.type ?? 'manual',
    sourceId: null,
    description: input.description,
    quantity: normalizeQuantity(input.options.quantity),
    unit: input.unit?.trim() || 'Pauschal',
    unitPrice: normalizePrice(input.unitPrice),
    options: input.options,
  });
}

export function calculateTransformerCostTotal(items: Pick<TransformerInventoryCostItem, 'totalPrice'>[]): number {
  return roundTransformerMoney(items.reduce((sum, item) => sum + normalizePrice(item.totalPrice), 0));
}

export function hasPurchaseCostItem(items: Pick<TransformerInventoryCostItem, 'type'>[]): boolean {
  return items.some((item) => item.type === 'purchase');
}
