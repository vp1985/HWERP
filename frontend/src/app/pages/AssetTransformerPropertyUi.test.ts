import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const detailSource = () => readFileSync('src/app/pages/AssetDetailPage.tsx', 'utf8');
const listSource = () => readFileSync('src/app/pages/Assets.tsx', 'utf8');

describe('asset transformer property UI source contracts', () => {
  it('renders Assettyp before Tags and stores it separately from tagIds', () => {
    const source = detailSource();

    expect(source.indexOf('Assettyp')).toBeGreaterThan(-1);
    expect(source.indexOf('Assettyp')).toBeLessThan(source.indexOf('Tags'));
    expect(source).toContain('assetTypeId: assetTypeId || null');
    expect(source).toContain('setAssetTypeId(existingAsset.assetTypeId || null)');
  });

  it('asks transformer Bauart, Ölsystem, Wicklungen and secondary voltages in Trafo-Daten', () => {
    const source = detailSource();

    expect(source).toContain('Bauart');
    expect(source).toContain("getSelectOptionsForList(selectOptions, 'asset.trafoKind')");
    expect(source).toContain('Ölsystem');
    expect(source).toContain("getSelectOptionsForList(selectOptions, 'asset.oilSystem')");
    expect(source).toContain('Wicklungen');
    expect(source).toContain("getSelectOptionsForList(selectOptions, 'asset.windingCount')");
    expect(source).toContain('NS1');
    expect(source).toContain('NS2');
  });

  it('uses transformer properties and asset types in the asset list search/display', () => {
    const source = listSource();

    expect(source).toContain('buildAssetSearchText');
    expect(source).toContain('assetTypes');
    expect(source).toContain('Bauart');
    expect(source).toContain('formatTransformerProperties(asset, selectOptions)');
  });

  it('shows created and updated timestamps in the asset overview table', () => {
    const source = listSource();

    expect(source).toContain('Angelegt am');
    expect(source).toContain('Geändert am');
    expect(source).toContain('formatAssetTimestamp(asset.createdAt)');
    expect(source).toContain('formatAssetTimestamp(asset.updatedAt)');
    expect(source).toContain('whitespace-nowrap');
  });

  it('makes asset table data columns sortable', () => {
    const source = listSource();

    expect(source).toContain('sortAssetTableRows');
    expect(source).toContain('loadAssetSortConfig');
    expect(source).toContain('handleSort');
    expect(source).toContain('handleSortColumnSelect');
    expect(source).toContain('Sortieren nach:');
    expect(source).toContain('asset-sort-column');
    expect(source).toContain('renderSortableHeader');
    expect(source).toContain("hwerp.assets.sortConfig");
    expect(source).toContain("renderSortableHeader('Name', 'name')");
    expect(source).toContain("renderSortableHeader('Kunde', 'customer')");
    expect(source).toContain("renderSortableHeader('Baujahr', 'buildYear')");
    expect(source).toContain("renderSortableHeader('Angelegt am', 'createdAt')");
    expect(source).toContain("aria-sort");
  });

  it('offers a column picker for showing and hiding asset table columns', () => {
    const source = listSource();

    expect(source).toContain('Columns2');
    expect(source).toContain('Spalten auswählen');
    expect(source).toContain('Spalten anzeigen');
    expect(source).toContain('visibleColumnKeys');
    expect(source).toContain('toggleColumnVisibility');
    expect(source).toContain("isColumnVisible('manufacturer')");
    expect(source).toContain("hwerp.assets.visibleColumns");
  });
});
