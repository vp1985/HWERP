import type { AssetNode } from '../../lib/types';
import type { TransformerInventoryItem } from './types';

export type ManualTransformerOwnership = 'own' | 'external';

export interface TransformerAssetDraft {
  ownership: ManualTransformerOwnership;
  position: string;
  customerId?: string | null;
  inventoryOrigin?: string;
  manufacturer?: string;
  powerKva?: string | number;
  primaryVoltageKv?: string | number;
  secondaryVoltageV?: string | number;
  vectorGroup?: string;
  serialNumber?: string;
  constructionYear?: string | number;
  constructionType?: string;
  weightKg?: string | number;
  connectionType?: string;
  priceNote?: string;
  note?: string;
  forSale?: boolean;
}

export interface BuildTransformerAssetOptions {
  id: string;
  now: string;
  assetTypeId?: string | null;
}

function clean(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function parseOptionalNumber(value: string | number | null | undefined): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseOptionalNullableNumber(value: string | number | null | undefined): number | null {
  return parseOptionalNumber(value) ?? null;
}

function detectOilSystem(constructionType: string): AssetNode['oilSystem'] {
  const normalized = constructionType.toLowerCase();
  if (normalized.includes('hermetik') || normalized.includes('hermetisch')) return 'hermetic';
  if (normalized.includes('ausdehner') || normalized.includes('konservator')) return 'conservator';
  if (normalized.includes('gießharz') || normalized.includes('giessharz') || normalized.includes('trocken')) return undefined;
  return constructionType ? 'other' : undefined;
}

function detectTrafoKind(constructionType: string): AssetNode['trafoKind'] {
  const normalized = constructionType.toLowerCase();
  if (normalized.includes('gießharz') || normalized.includes('giessharz') || normalized.includes('trocken')) return 'cast_resin';
  return constructionType ? 'oil' : 'oil';
}

function formatAssetName(position: string, manufacturer: string, powerKva?: number): string {
  const parts = [position || 'Trafo', manufacturer, powerKva ? `${powerKva} kVA` : ''].filter(Boolean);
  return parts.join(' · ');
}

export function buildTransformerAssetFromDraft(
  draft: TransformerAssetDraft,
  options: BuildTransformerAssetOptions,
): AssetNode {
  const position = clean(draft.position).toUpperCase();
  const manufacturer = clean(draft.manufacturer);
  const serialNumber = clean(draft.serialNumber);
  const constructionType = clean(draft.constructionType);
  const powerKva = parseOptionalNumber(draft.powerKva);
  const primaryVoltageKv = parseOptionalNumber(draft.primaryVoltageKv);
  const secondaryVoltageV = parseOptionalNumber(draft.secondaryVoltageV);
  const weightKg = parseOptionalNumber(draft.weightKg);
  const buildYear = parseOptionalNumber(draft.constructionYear);
  const origin = clean(draft.inventoryOrigin) || (draft.ownership === 'own' ? 'HT-VOLTEQ' : 'Fremdtrafo');
  const trafoKind = detectTrafoKind(constructionType);
  const oilSystem = trafoKind === 'oil' ? detectOilSystem(constructionType) : undefined;

  return {
    id: options.id,
    name: formatAssetName(position, manufacturer, powerKva),
    parentId: null,
    customerId: draft.ownership === 'external' ? draft.customerId || null : null,
    locationId: null,
    tagIds: [],
    assetTypeId: options.assetTypeId ?? null,
    notes: clean(draft.note) || undefined,
    internalAssetId: position,
    buildYear,
    totalWeight: weightKg,
    manufacturer: manufacturer || undefined,
    serialNumber: serialNumber || undefined,
    powerKva,
    trafoKind,
    oilSystem,
    windingCount: '2w',
    secondaryVoltage1: secondaryVoltageV ? `${secondaryVoltageV} V` : undefined,
    inventoryOwnerType: draft.ownership,
    inventoryOrigin: origin,
    stockStatus: 'available',
    forSale: Boolean(draft.forSale),
    primaryVoltageKv,
    secondaryVoltageV,
    vectorGroup: clean(draft.vectorGroup) || undefined,
    constructionType: constructionType || undefined,
    connectionType: clean(draft.connectionType) || undefined,
    priceNote: clean(draft.priceNote) || undefined,
    createdAt: options.now,
    updatedAt: options.now,
  };
}

export function transformerAssetToInventoryItem(asset: AssetNode): TransformerInventoryItem | null {
  if (asset.inventoryOwnerType !== 'own' && asset.inventoryOwnerType !== 'external') return null;
  const position = clean(asset.internalAssetId) || `ASSET-${asset.id.slice(0, 8).toUpperCase()}`;
  const stockStatus = asset.stockStatus ?? 'unchecked';
  const isSold = stockStatus === 'sold';
  const isScrapped = stockStatus === 'scrapped';
  const forSale = Boolean(asset.forSale);

  return {
    position,
    manufacturer: asset.manufacturer ?? '',
    powerKva: parseOptionalNullableNumber(asset.powerKva),
    primaryVoltageKv: parseOptionalNullableNumber(asset.primaryVoltageKv),
    secondaryVoltageV: parseOptionalNullableNumber(asset.secondaryVoltageV ?? asset.secondaryVoltage1?.replace(/[^0-9.,-]/g, '').replace(',', '.')),
    vectorGroup: asset.vectorGroup ?? '',
    serialNumber: asset.serialNumber ?? '',
    constructionYear: parseOptionalNullableNumber(asset.buildYear),
    constructionType: asset.constructionType ?? '',
    weightKg: parseOptionalNullableNumber(asset.totalWeight),
    origin: asset.inventoryOrigin ?? (asset.inventoryOwnerType === 'own' ? 'HT-VOLTEQ' : 'Fremdtrafo'),
    connectionType: asset.connectionType ?? '',
    note: asset.notes ?? '',
    soldTo: isScrapped ? 'Verschrottet' : isSold ? 'Verkauft' : '',
    invoiceNumber: '',
    exportListed: false,
    availableListed: forSale,
    resaleListed: forSale,
    maschinensucherListed: false,
    priceNote: asset.priceNote ?? '',
  };
}

function inventoryPositionKey(position: string): string {
  return clean(position).toUpperCase();
}

export function buildTransformerInventoryRows(assets: AssetNode[]): TransformerInventoryItem[] {
  const rowsByPosition = new Map<string, TransformerInventoryItem>();

  assets
    .map((asset) => transformerAssetToInventoryItem(asset))
    .filter((item): item is TransformerInventoryItem => Boolean(item))
    .forEach((item) => {
      rowsByPosition.set(inventoryPositionKey(item.position), item);
    });

  return [...rowsByPosition.values()]
    .sort((left, right) => inventoryPositionKey(left.position).localeCompare(inventoryPositionKey(right.position), 'de', { numeric: true, sensitivity: 'base' }));
}

function positionNumber(position: string, prefix: string): number | null {
  const match = position.toUpperCase().match(new RegExp(`^${prefix}(\\d+)$`));
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

export function deriveNextManualTransformerPosition(
  assets: AssetNode[],
  ownership: ManualTransformerOwnership,
): string {
  const prefix = ownership === 'own' ? 'HT' : 'FT';
  const assetNumbers = assets.map((asset) => positionNumber(asset.internalAssetId ?? '', prefix)).filter((value): value is number => value !== null);
  const next = Math.max(0, ...assetNumbers) + 1;
  return `${prefix}${String(next).padStart(4, '0')}`;
}
