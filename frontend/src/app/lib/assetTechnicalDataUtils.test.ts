import { describe, expect, it } from 'vitest';
import type { AssetNode, Customer } from './types';
import type { Tag } from '../types/tag';
import type { AssetType } from './assetTypeStorage';
import {
  buildAssetSearchText,
  formatTransformerProperties,
  isTransformerAssetType,
  shouldShowOilSystemFields,
  shouldShowThreeWindingFields,
} from './assetTechnicalDataUtils';

const baseAsset = (overrides: Partial<AssetNode> = {}): AssetNode => ({
  id: 'asset-1',
  name: 'Trafo 1',
  parentId: null,
  customerId: null,
  locationId: null,
  tagIds: [],
  assetTypeId: null,
  createdAt: '2026-06-04T00:00:00.000Z',
  updatedAt: '2026-06-04T00:00:00.000Z',
  ...overrides,
});

const assetType = (overrides: Partial<AssetType>): AssetType => ({
  id: 'type-1',
  code: 'trafo',
  label: 'Transformator',
  short: 'Trafo',
  parentTypeId: null,
  sortOrder: 1,
  icon: null,
  isActive: true,
  createdAt: '2026-06-04T00:00:00.000Z',
  updatedAt: '2026-06-04T00:00:00.000Z',
  ...overrides,
});

describe('assetTechnicalDataUtils', () => {
  it('detects standard and 3W transformer asset types without treating 2W as a separate marker', () => {
    expect(isTransformerAssetType(assetType({ code: 'trafo' }))).toBe(true);
    expect(isTransformerAssetType(assetType({ code: 'trafo_3w', label: 'Transformator – Dreiwickler' }))).toBe(true);
    expect(isTransformerAssetType(assetType({ code: 'leistungsschalter', label: 'Leistungsschalter' }))).toBe(false);
  });

  it('shows oil system fields only for oil transformers', () => {
    expect(shouldShowOilSystemFields(baseAsset({ trafoKind: 'oil' }))).toBe(true);
    expect(shouldShowOilSystemFields(baseAsset({ trafoKind: 'cast_resin', oilSystem: 'hermetic' }))).toBe(false);
  });

  it('shows multi-secondary-voltage fields for explicit 3W transformers only', () => {
    expect(shouldShowThreeWindingFields(baseAsset({ windingCount: '3w' }))).toBe(true);
    expect(shouldShowThreeWindingFields(baseAsset({ windingCount: '2w' }))).toBe(false);
  });

  it('formats transformer properties as compact searchable labels', () => {
    expect(
      formatTransformerProperties(baseAsset({
        trafoKind: 'oil',
        oilSystem: 'conservator',
        windingCount: '3w',
        secondaryVoltage1: '400 V',
        secondaryVoltage2: '690 V',
      })),
    ).toEqual(['Öltransformator', 'Ausdehner', '3W', 'NS1 400 V', 'NS2 690 V']);
  });

  it('includes transformer properties, asset type, customer and tags in asset search text', () => {
    const tag: Tag = {
      id: 'tag-1',
      name: 'Reserve',
      code: 'RES',
      color: '#ccc',
      suggestedContexts: ['ASSETS'],
      blockedContexts: [],
      createdAt: '2026-06-04T00:00:00.000Z',
      updatedAt: '2026-06-04T00:00:00.000Z',
    };
    const customer: Customer = {
      id: 'customer-1',
      name: 'HT Volteq',
      createdAt: '2026-06-04T00:00:00.000Z',
      updatedAt: '2026-06-04T00:00:00.000Z',
    };

    const text = buildAssetSearchText(
      baseAsset({
        customerId: customer.id,
        tagIds: [tag.id],
        assetTypeId: 'type-1',
        trafoKind: 'cast_resin',
        windingCount: '2w',
        oilSystem: 'hermetic',
      }),
      [tag],
      customer,
      assetType({ id: 'type-1', code: 'trafo', label: 'Transformator' }),
    );

    expect(text).toContain('ht volteq');
    expect(text).toContain('reserve');
    expect(text).toContain('transformator');
    expect(text).toContain('gießharztransformator');
    expect(text).toContain('2w');
    expect(text).not.toContain('hermetisch');
  });
});
