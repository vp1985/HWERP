import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve(__dirname, 'AssetDetailPage.tsx'), 'utf8');

describe('AssetDetailPage asset classification contract', () => {
  it('loads seedable Asset-Typen and renders an Assettyp dropdown before tag classification', () => {
    expect(source).toContain('pgAssetTypeStore.seedIfEmpty');
    expect(source).toContain('pgAssetTypeStore.getAll');
    expect(source).toContain('id="assetTypeId"');
    expect(source).toContain('Assettyp');
  });

  it('persists assetTypeId separately from tagIds while keeping ASSETS tags for flexible traits', () => {
    expect(source).toContain('assetTypeId: assetTypeId || null');
    expect(source).toContain('setAssetTypeId(existingAsset.assetTypeId ||');
    expect(source).toContain('context="ASSETS"');
    expect(source).toContain('TagPicker');
  });
});
