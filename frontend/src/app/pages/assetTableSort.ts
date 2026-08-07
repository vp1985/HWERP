import type { AssetNode } from '../lib/types';

export type AssetSortKey =
  | 'name'
  | 'customer'
  | 'assetType'
  | 'construction'
  | 'customerAssetId'
  | 'internalAssetId'
  | 'manufacturer'
  | 'buildYear'
  | 'totalWeight'
  | 'parent'
  | 'tags'
  | 'createdAt'
  | 'updatedAt';

export type AssetSortDirection = 'asc' | 'desc';

export interface AssetSortConfig {
  key: AssetSortKey | null;
  direction: AssetSortDirection;
}

export interface AssetSortableRow {
  asset: AssetNode;
  depth: number;
  isMatch: boolean;
  parentName: string;
  customerName: string;
  assetTypeLabel: string;
  constructionText: string;
  tagText: string;
}

function isEmptySortValue(value: unknown): boolean {
  return value === null || value === undefined || value === '';
}

function normalizeString(value: unknown): string {
  return String(value ?? '').toLocaleLowerCase('de-DE');
}

export function getAssetSortValue(row: AssetSortableRow, key: AssetSortKey): string | number | null | undefined {
  switch (key) {
    case 'name':
      return row.asset.name;
    case 'customer':
      return row.customerName;
    case 'assetType':
      return row.assetTypeLabel;
    case 'construction':
      return row.constructionText;
    case 'customerAssetId':
      return row.asset.customerAssetId;
    case 'internalAssetId':
      return row.asset.internalAssetId;
    case 'manufacturer':
      return row.asset.manufacturer;
    case 'buildYear':
      return row.asset.buildYear;
    case 'totalWeight':
      return row.asset.totalWeight;
    case 'parent':
      return row.parentName;
    case 'tags':
      return row.tagText;
    case 'createdAt':
      return row.asset.createdAt ? Date.parse(row.asset.createdAt) : null;
    case 'updatedAt':
      return row.asset.updatedAt ? Date.parse(row.asset.updatedAt) : null;
    default:
      return '';
  }
}

export function compareAssetSortValues(left: unknown, right: unknown, direction: AssetSortDirection): number {
  const leftEmpty = isEmptySortValue(left);
  const rightEmpty = isEmptySortValue(right);
  if (leftEmpty && rightEmpty) return 0;
  if (leftEmpty) return 1;
  if (rightEmpty) return -1;

  let result: number;
  if (typeof left === 'number' && typeof right === 'number') {
    result = left - right;
  } else {
    result = normalizeString(left).localeCompare(normalizeString(right), 'de-DE', {
      numeric: true,
      sensitivity: 'base',
    });
  }

  return direction === 'asc' ? result : -result;
}

export function sortAssetTableRows<T extends AssetSortableRow>(rows: T[], sortConfig: AssetSortConfig): T[] {
  if (!sortConfig.key) return rows;

  return [...rows].sort((left, right) => {
    const result = compareAssetSortValues(
      getAssetSortValue(left, sortConfig.key!),
      getAssetSortValue(right, sortConfig.key!),
      sortConfig.direction,
    );
    if (result !== 0) return result;
    return normalizeString(left.asset.name).localeCompare(normalizeString(right.asset.name), 'de-DE', {
      numeric: true,
      sensitivity: 'base',
    });
  });
}
