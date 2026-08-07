import { describe, expect, it } from 'vitest';
import type { AssetNode } from '../lib/types';
import type { AssetSortableRow } from './assetTableSort';
import { sortAssetTableRows } from './assetTableSort';

function row(asset: Partial<AssetNode>, extra: Partial<AssetSortableRow> = {}): AssetSortableRow {
  return {
    asset: {
      id: asset.id ?? asset.name ?? 'asset',
      name: asset.name ?? '',
      parentId: null,
      customerId: null,
      locationId: null,
      tagIds: [],
      createdAt: asset.createdAt ?? '2026-01-01T00:00:00.000Z',
      updatedAt: asset.updatedAt ?? '2026-01-01T00:00:00.000Z',
      ...asset,
    } as AssetNode,
    depth: 0,
    isMatch: false,
    parentName: extra.parentName ?? '',
    customerName: extra.customerName ?? '',
    assetTypeLabel: extra.assetTypeLabel ?? '',
    constructionText: extra.constructionText ?? '',
    tagText: extra.tagText ?? '',
  };
}

describe('asset table sorting', () => {
  it('sorts text columns naturally and case-insensitively', () => {
    const sorted = sortAssetTableRows(
      [row({ name: 'Trafo 10' }), row({ name: 'trafo 2' }), row({ name: 'Anlage A' })],
      { key: 'name', direction: 'asc' },
    );

    expect(sorted.map((item) => item.asset.name)).toEqual(['Anlage A', 'trafo 2', 'Trafo 10']);
  });

  it('sorts numeric and date columns with empty values at the end', () => {
    const rows = [
      row({ name: 'ohne', buildYear: undefined, createdAt: undefined }),
      row({ name: 'neu', buildYear: 2020, createdAt: '2026-06-18T10:00:00.000Z' }),
      row({ name: 'alt', buildYear: 1980, createdAt: '2024-01-01T10:00:00.000Z' }),
    ];

    expect(sortAssetTableRows(rows, { key: 'buildYear', direction: 'asc' }).map((item) => item.asset.name)).toEqual(['alt', 'neu', 'ohne']);
    expect(sortAssetTableRows(rows, { key: 'createdAt', direction: 'desc' }).map((item) => item.asset.name)).toEqual(['neu', 'alt', 'ohne']);
  });

  it('sorts relation-derived columns such as customer and tags', () => {
    const rows = [
      row({ name: 'B' }, { customerName: 'Zeta', tagText: 'Wartung' }),
      row({ name: 'A' }, { customerName: 'Alpha', tagText: 'Prüfung' }),
    ];

    expect(sortAssetTableRows(rows, { key: 'customer', direction: 'asc' }).map((item) => item.customerName)).toEqual(['Alpha', 'Zeta']);
    expect(sortAssetTableRows(rows, { key: 'tags', direction: 'desc' }).map((item) => item.tagText)).toEqual(['Wartung', 'Prüfung']);
  });
});
