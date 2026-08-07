import type { CalculationLineItem } from './types';
import type { TransformerInventoryItem } from '../features/transformer-inventory/types';

interface BuildInfoCalculationLineItemOptions {
  id: string;
  calculationId: string;
  description: string;
  assetHeaderId?: string | null;
  now?: string;
}

interface BuildInventorySaleLineItemOptions {
  id: string;
  calculationId: string;
  inventoryItem: TransformerInventoryItem;
  price?: number;
  now?: string;
}

function formatInventorySaleDescription(item: TransformerInventoryItem): string {
  const voltage = [
    item.primaryVoltageKv ? `${item.primaryVoltageKv} kV` : null,
    item.secondaryVoltageV ? `${item.secondaryVoltageV} V` : null,
  ]
    .filter(Boolean)
    .join(' / ');

  return [
    item.position,
    item.manufacturer || null,
    item.powerKva ? `${item.powerKva} kVA` : null,
    voltage || null,
    item.vectorGroup || null,
    item.serialNumber ? `SN ${item.serialNumber}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

export function buildInventorySaleLineItem(options: BuildInventorySaleLineItemOptions): CalculationLineItem {
  const now = options.now ?? new Date().toISOString();
  const price = options.price ?? 0;

  return {
    id: options.id,
    calculationId: options.calculationId,
    positionNumber: null,
    assetHeaderId: null,
    type: 'asset_header',
    materialId: null,
    serviceId: null,
    assetNodeId: null,
    inventoryPosition: `own:${options.inventoryItem.position}`,
    description: formatInventorySaleDescription(options.inventoryItem),
    quantity: 1,
    unit: 'Stk',
    unitPrice: price,
    totalPrice: price,
    createdAt: now,
    updatedAt: now,
  };
}

export function buildInfoCalculationLineItem(options: BuildInfoCalculationLineItemOptions): CalculationLineItem {
  const now = options.now ?? new Date().toISOString();

  return {
    id: options.id,
    calculationId: options.calculationId,
    positionNumber: null,
    assetHeaderId: options.assetHeaderId ?? null,
    type: 'info',
    materialId: null,
    serviceId: null,
    assetNodeId: null,
    description: options.description,
    quantity: 0,
    unit: '',
    unitPrice: 0,
    totalPrice: 0,
    createdAt: now,
    updatedAt: now,
  };
}
