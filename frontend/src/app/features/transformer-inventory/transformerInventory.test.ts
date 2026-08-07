import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { sortDataTableRows } from '../../components/ui/DataTable';
import { buildTransformerInventoryColumns, getDefaultTransformerInventoryColumnKeys } from './tableConfig';
import type { AssetNode, Material, Service, ServicePackage, ServicePackageItem } from '../../lib/types';
import {
  buildTransformerAssetFromDraft,
  buildTransformerInventoryRows,
  deriveNextManualTransformerPosition,
  transformerAssetToInventoryItem,
} from './manualTransformerAssets';
import {
  buildPurchaseCostItem,
  buildTransformerCostItemFromMaterial,
  buildTransformerCostItemFromPackage,
  buildTransformerCostItemFromService,
  calculateTransformerCostTotal,
  hasPurchaseCostItem,
} from './transformerInventoryCosts';
import {
  allTransformerInventoryStatusFilters,
  deriveTransformerInventorySummary,
  filterTransformerInventory,
  findActiveTransformerReservation,
  getLatestCalculationLink,
  getTransformerStatus,
  hasReservationConflict,
  mergeInventoryDetailOverride,
  toggleTransformerStatusFilter,
  validateTransformerReservationRequest,
} from './utils';
import type {
  TransformerInventoryAttachment,
  TransformerInventoryCalculationLink,
  TransformerInventoryDetailOverride,
  TransformerInventoryItem,
  TransformerInventoryReservation,
} from './types';

const now = '2026-06-17T08:00:00.000Z';

function inventoryAsset(overrides: Partial<AssetNode> & Pick<AssetNode, 'id' | 'internalAssetId'>): AssetNode {
  return {
    id: overrides.id,
    name: overrides.name ?? overrides.internalAssetId ?? overrides.id,
    parentId: null,
    customerId: null,
    locationId: null,
    tagIds: [],
    internalAssetId: overrides.internalAssetId,
    inventoryOwnerType: 'own',
    inventoryOrigin: 'HT-VOLTEQ',
    manufacturer: '',
    stockStatus: 'available',
    forSale: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

const transformerInventoryAssets: AssetNode[] = [
  inventoryAsset({ id: 'asset-ht9001', internalAssetId: 'HT9001', manufacturer: 'Demo Alpha', powerKva: 250, primaryVoltageKv: 10, secondaryVoltageV: 400, vectorGroup: 'Dyn5', serialNumber: 'DEMO-SN-9001', buildYear: 1993, constructionType: 'Hermetik' }),
  inventoryAsset({ id: 'asset-ht9002', internalAssetId: 'HT9002', manufacturer: 'Demo Alpha', powerKva: 250, primaryVoltageKv: 20, secondaryVoltageV: 400, vectorGroup: 'Dyn5', serialNumber: 'DEMO-SN-9002', buildYear: 1998, stockStatus: 'scrapped', forSale: false, notes: 'nicht vollständig' }),
  inventoryAsset({ id: 'asset-ht9003', internalAssetId: 'HT9003', manufacturer: 'Demo Beta', powerKva: 250, primaryVoltageKv: 10, secondaryVoltageV: 400, vectorGroup: 'Dyn5', serialNumber: 'DEMO-SN-9003', buildYear: 2014, stockStatus: 'sold', forSale: false, notes: 'verkauft' }),
  inventoryAsset({ id: 'asset-ht9004', internalAssetId: 'HT9004', manufacturer: 'Demo Gamma', powerKva: 400, primaryVoltageKv: 20, secondaryVoltageV: 400, vectorGroup: 'Dyn5', serialNumber: 'DEMO-SN-9004', buildYear: 2001 }),
  inventoryAsset({ id: 'asset-ht9005', internalAssetId: 'HT9005', manufacturer: 'Demo Delta', powerKva: 630, primaryVoltageKv: 20, secondaryVoltageV: 400, vectorGroup: 'Dyn5', serialNumber: 'DEMO-SN-9005', buildYear: 2005 }),
  inventoryAsset({ id: 'asset-ht9006', internalAssetId: 'HT9006', manufacturer: 'Demo Epsilon', powerKva: 800, primaryVoltageKv: 20, secondaryVoltageV: 400, vectorGroup: 'Dyn5', serialNumber: 'DEMO-SN-9006', buildYear: 2011, connectionType: 'Stecker', inventoryOrigin: 'Demo-Lieferant', stockStatus: 'unchecked', forSale: false, notes: 'ungeprüft' }),
];

const transformerInventoryItems: TransformerInventoryItem[] = buildTransformerInventoryRows(transformerInventoryAssets);

describe('transformer inventory list', () => {
  it('uses asset-backed warehouse transformers as the inventory source of truth', () => {
    expect(transformerInventoryItems).toHaveLength(6);
    expect(transformerInventoryItems[0]).toMatchObject({
      position: 'HT9001',
      manufacturer: 'Demo Alpha',
      powerKva: 250,
      primaryVoltageKv: 10,
      secondaryVoltageV: 400,
      vectorGroup: 'Dyn5',
      serialNumber: 'DEMO-SN-9001',
      constructionYear: 1993,
      constructionType: 'Hermetik',
    });
    expect(transformerInventoryItems.at(-1)).toMatchObject({
      position: 'HT9006',
      manufacturer: 'Demo Epsilon',
      powerKva: 800,
      primaryVoltageKv: 20,
      secondaryVoltageV: 400,
      connectionType: 'Stecker',
    });
  });

  it('derives operational status chips without treating prices as normal warehouse data', () => {
    expect(getTransformerStatus(transformerInventoryItems.find((item) => item.position === 'HT9001')!)).toBe('available');
    expect(getTransformerStatus(transformerInventoryItems.find((item) => item.position === 'HT9002')!)).toBe('scrapped');
    expect(getTransformerStatus(transformerInventoryItems.find((item) => item.position === 'HT9003')!)).toBe('sold');
    expect(getTransformerStatus(transformerInventoryItems.find((item) => item.position === 'HT9006')!)).toBe('unchecked');

    expect(deriveTransformerInventorySummary(transformerInventoryItems)).toEqual({
      total: 6,
      available: 3,
      reserved: 0,
      sold: 1,
      scrapped: 1,
      unchecked: 1,
    });
  });

  it('filters by HT number, manufacturer, serial number and technical values', () => {
    expect(filterTransformerInventory(transformerInventoryItems, 'HT9004')).toHaveLength(1);
    expect(filterTransformerInventory(transformerInventoryItems, 'DEMO-SN-9004')[0].position).toBe('HT9004');
    expect(filterTransformerInventory(transformerInventoryItems, 'Demo Delta DEMO-SN-9005')[0].position).toBe('HT9005');
    expect(filterTransformerInventory(transformerInventoryItems, '20/400 Dyn5').length).toBeGreaterThan(1);
  });

  it('filters by selectable status chips and combines the status chips with search', () => {
    expect(allTransformerInventoryStatusFilters).toEqual(['available', 'reserved', 'sold', 'scrapped', 'unchecked']);

    const withoutSold = toggleTransformerStatusFilter(allTransformerInventoryStatusFilters, 'sold');
    expect(withoutSold).toEqual(['available', 'reserved', 'scrapped', 'unchecked']);
    expect(toggleTransformerStatusFilter(withoutSold, 'sold')).toEqual(allTransformerInventoryStatusFilters);

    expect(filterTransformerInventory(transformerInventoryItems, '', ['available'])).toHaveLength(3);
    expect(filterTransformerInventory(transformerInventoryItems, '', withoutSold)).toHaveLength(5);
    expect(filterTransformerInventory(transformerInventoryItems, 'HT9003', ['available'])).toHaveLength(0);
    expect(filterTransformerInventory(transformerInventoryItems, 'HT9003', ['sold'])[0].position).toBe('HT9003');
  });

  it('builds warehouse rows directly from assets without duplicate positions', () => {
    const rows = buildTransformerInventoryRows([transformerInventoryAssets[5], transformerInventoryAssets[0], transformerInventoryAssets[5]]);
    const matchingRows = filterTransformerInventory(rows, 'HT9006');

    expect(rows.map((item) => item.position)).toEqual(['HT9001', 'HT9006']);
    expect(matchingRows).toHaveLength(1);
    expect(matchingRows[0]).toMatchObject({ position: 'HT9006', manufacturer: 'Demo Epsilon', serialNumber: 'DEMO-SN-9006' });
  });

  it('uses the shared DataTable contract with separated warehouse columns', () => {
    const columns = buildTransformerInventoryColumns({ canViewPrices: true, hidePrices: false, revealPrices: false });
    expect(columns.map((column) => column.key)).toEqual([
      'position',
      'manufacturer',
      'powerKva',
      'primaryVoltageKv',
      'secondaryVoltageV',
      'vectorGroup',
      'serialNumber',
      'origin',
      'constructionYear',
      'constructionType',
      'status',
      'channels',
      'note',
      'priceNote',
    ]);
    expect(getDefaultTransformerInventoryColumnKeys(true)).toEqual([
      'position',
      'manufacturer',
      'powerKva',
      'primaryVoltageKv',
      'secondaryVoltageV',
      'vectorGroup',
      'serialNumber',
      'origin',
      'constructionYear',
      'status',
      'channels',
      'note',
      'priceNote',
    ]);
    expect(buildTransformerInventoryColumns({ canViewPrices: false, hidePrices: false, revealPrices: false }).some((column) => column.key === 'priceNote')).toBe(false);
    expect(getDefaultTransformerInventoryColumnKeys(false)).not.toContain('priceNote');
  });

  it('does not duplicate separated technical values inside the manufacturer column', () => {
    const tableConfigSource = readFileSync(resolve(__dirname, 'tableConfig.tsx'), 'utf8');
    const pageSource = readFileSync(resolve(__dirname, 'pages/TransformerInventoryPage.tsx'), 'utf8');

    expect(tableConfigSource).not.toContain('formatTransformerTitle(item)');
    expect(tableConfigSource).not.toContain('SN {item.serialNumber');
    expect(tableConfigSource).toContain("key: 'manufacturer'");
    expect(tableConfigSource).toContain("key: 'serialNumber'");
    expect(tableConfigSource).toContain("key: 'origin'");
    expect(pageSource).toContain("storageKey: 'datatable.transformer-inventory.v2'");
  });

  it('sorts inventory rows by position and construction year in the DataTable template', () => {
    const rows = [
      transformerInventoryItems.find((item) => item.position === 'HT9004')!,
      transformerInventoryItems.find((item) => item.position === 'HT9001')!,
      transformerInventoryItems.find((item) => item.position === 'HT9006')!,
    ];
    const columns = buildTransformerInventoryColumns({ canViewPrices: true, hidePrices: false, revealPrices: false });

    expect(sortDataTableRows(rows, columns, { key: 'position', direction: 'asc' }).map((item) => item.position)).toEqual(['HT9001', 'HT9004', 'HT9006']);
    expect(sortDataTableRows(rows, columns, { key: 'position', direction: 'desc' }).map((item) => item.position)).toEqual(['HT9006', 'HT9004', 'HT9001']);
    expect(sortDataTableRows(rows, columns, { key: 'constructionYear', direction: 'asc' }).map((item) => item.position)).toEqual(['HT9001', 'HT9004', 'HT9006']);
    expect(sortDataTableRows(rows, columns, { key: 'constructionYear', direction: 'desc' }).map((item) => item.position)).toEqual(['HT9006', 'HT9004', 'HT9001']);
  });

  it('keeps the inventory header compact and moves status filtering into the status table header', () => {
    const pageSource = readFileSync(resolve(__dirname, 'pages/TransformerInventoryPage.tsx'), 'utf8');
    const tableConfigSource = readFileSync(resolve(__dirname, 'tableConfig.tsx'), 'utf8');
    const dataTableSource = readFileSync(resolve(__dirname, '../../components/ui/DataTable.tsx'), 'utf8');

    expect(pageSource).not.toContain('SummaryCard');
    expect(pageSource).not.toContain('summaryMeta');
    expect(pageSource).not.toContain('Lagerliste');
    expect(pageSource).not.toContain('Trafo-Lager</h1>');
    expect(pageSource).not.toContain('Importierte DB-Lagerliste');
    expect(pageSource).not.toContain('Statusfilter');
    expect(pageSource).not.toContain('Alle aktivieren');

    expect(dataTableSource).toContain('headerContent');
    expect(dataTableSource).toContain('h-full min-h-0');
    expect(dataTableSource).not.toContain('max-h-[700px]');
    expect(tableConfigSource).toContain('statusFilter');
    expect(tableConfigSource).toContain('Statusfilter öffnen');
    expect(tableConfigSource).toContain('aria-pressed');
    expect(tableConfigSource).toContain('Alle Status aktivieren');
    expect(pageSource).toContain('statusFilter:');
    expect(pageSource).toContain('toggleTransformerStatusFilter');
  });

  it('uses the full available content width instead of a centered max-width container', () => {
    const pageSource = readFileSync(resolve(__dirname, 'pages/TransformerInventoryPage.tsx'), 'utf8');
    expect(pageSource).toContain('w-full max-w-none');
    expect(pageSource).not.toContain('container max-w-7xl mx-auto');
  });

  it('renders the inventory page through the shared DataTable template instead of a custom table', () => {
    const pageSource = readFileSync(resolve(__dirname, 'pages/TransformerInventoryPage.tsx'), 'utf8');
    expect(pageSource).toContain("from '../../../components/ui/DataTable'");
    expect(pageSource).toContain('<DataTable');
    expect(pageSource).not.toContain('<table');
    expect(pageSource).not.toContain('<thead');
  });

  it('offers stock transformers from both inventory list and calculation detail as offer line items', () => {
    const pageSource = readFileSync(resolve(__dirname, 'pages/TransformerInventoryPage.tsx'), 'utf8');
    const tableConfigSource = readFileSync(resolve(__dirname, 'tableConfig.tsx'), 'utf8');
    const calculationPageSource = readFileSync(resolve(__dirname, '../../pages/CalculationDetailPage.tsx'), 'utf8');

    expect(tableConfigSource).toContain('onOpenDetail');
    expect(tableConfigSource).toContain('HT-Nummer öffnen');
    expect(pageSource).toContain('handleOpenDetail');
    expect(pageSource).toContain('handleCreateCalculation');
    expect(pageSource).toContain('/calculations/new?inventoryPosition=');
    expect(pageSource).toContain('transformerInventoryCalculationLinks');
    expect(calculationPageSource).toContain('Lagertrafo hinzufügen');
    expect(calculationPageSource).toContain('showInventoryDialog');
    expect(calculationPageSource).toContain('buildInventorySaleLineItem');
  });

  it('derives reserved status from active reservations without treating it as sold', () => {
    const item = transformerInventoryItems.find((row) => row.position === 'HT9001')!;
    const reservations: TransformerInventoryReservation[] = [
      {
        id: 'res-1',
        inventoryPosition: 'HT9001',
        customerId: 'cust-1',
        calculationId: null,
        reservedFrom: '2026-06-01',
        reservedUntil: '2026-06-30',
        status: 'active',
        note: 'Projekt Meyer',
        createdByUserId: 'vale',
        createdAt: '2026-06-09T08:00:00.000Z',
        updatedAt: '2026-06-09T08:00:00.000Z',
      },
    ];

    expect(allTransformerInventoryStatusFilters).toContain('reserved');
    expect(getTransformerStatus(item, reservations, '2026-06-09')).toBe('reserved');
    expect(deriveTransformerInventorySummary([item], reservations, '2026-06-09')).toEqual({
      total: 1,
      available: 0,
      reserved: 1,
      sold: 0,
      scrapped: 0,
      unchecked: 0,
    });
    expect(findActiveTransformerReservation('HT9001', reservations, '2026-07-01')).toBeNull();
  });

  it('keeps sold and scrapped status above reservations', () => {
    const soldItem = transformerInventoryItems.find((row) => row.position === 'HT9003')!;
    const scrappedItem = transformerInventoryItems.find((row) => row.position === 'HT9002')!;
    const reservations: TransformerInventoryReservation[] = [
      { id: 'res-sold', inventoryPosition: 'HT9003', customerId: 'cust-1', calculationId: null, reservedFrom: '2026-06-01', reservedUntil: '2026-06-30', status: 'active', note: null, createdByUserId: null, createdAt: '2026-06-09T08:00:00.000Z', updatedAt: '2026-06-09T08:00:00.000Z' },
      { id: 'res-scrap', inventoryPosition: 'HT9002', customerId: 'cust-1', calculationId: null, reservedFrom: '2026-06-01', reservedUntil: '2026-06-30', status: 'active', note: null, createdByUserId: null, createdAt: '2026-06-09T08:00:00.000Z', updatedAt: '2026-06-09T08:00:00.000Z' },
    ];

    expect(getTransformerStatus(soldItem, reservations, '2026-06-09')).toBe('sold');
    expect(getTransformerStatus(scrappedItem, reservations, '2026-06-09')).toBe('scrapped');
  });

  it('blocks overlapping active reservations but allows adjacent or cancelled reservations', () => {
    const existing: TransformerInventoryReservation[] = [
      { id: 'res-1', inventoryPosition: 'HT0042', customerId: 'cust-1', calculationId: null, reservedFrom: '2026-06-10', reservedUntil: '2026-06-20', status: 'active', note: null, createdByUserId: null, createdAt: '2026-06-09T08:00:00.000Z', updatedAt: '2026-06-09T08:00:00.000Z' },
      { id: 'res-cancelled', inventoryPosition: 'HT0042', customerId: 'cust-2', calculationId: null, reservedFrom: '2026-07-01', reservedUntil: '2026-07-10', status: 'cancelled', note: null, createdByUserId: null, createdAt: '2026-06-09T08:00:00.000Z', updatedAt: '2026-06-09T08:00:00.000Z' },
    ];

    expect(hasReservationConflict(existing, { inventoryPosition: 'HT0042', reservedFrom: '2026-06-15', reservedUntil: '2026-06-25' })).toBe(true);
    expect(hasReservationConflict(existing, { inventoryPosition: 'HT0042', reservedFrom: '2026-06-21', reservedUntil: '2026-06-25' })).toBe(false);
    expect(hasReservationConflict(existing, { inventoryPosition: 'HT0042', reservedFrom: '2026-07-02', reservedUntil: '2026-07-05' })).toBe(false);
  });

  it('validates reservation date order and stock status', () => {
    const item = transformerInventoryItems.find((row) => row.position === 'HT9001')!;
    const soldItem = transformerInventoryItems.find((row) => row.position === 'HT9003')!;

    expect(validateTransformerReservationRequest(item, [], { customerId: 'cust-1', reservedFrom: '2026-06-20', reservedUntil: '2026-06-10' })).toEqual({
      valid: false,
      reason: 'Das Bis-Datum darf nicht vor dem Von-Datum liegen.',
    });
    expect(validateTransformerReservationRequest(soldItem, [], { customerId: 'cust-1', reservedFrom: '2026-06-10', reservedUntil: '2026-06-20' })).toEqual({
      valid: false,
      reason: 'Verkaufte oder verschrottete Trafos können nicht reserviert werden.',
    });
    expect(validateTransformerReservationRequest(item, [], { customerId: 'cust-1', reservedFrom: '2026-06-10', reservedUntil: '2026-06-20' })).toEqual({ valid: true });
  });

  it('merges manual detail overrides over asset row values without mutating the source row', () => {
    const item = transformerInventoryItems.find((row) => row.position === 'HT9001')!;
    const override: TransformerInventoryDetailOverride = {
      id: 'override-1',
      inventoryPosition: 'HT9001',
      fields: { secondaryVoltageV: 690, vectorGroup: '', note: 'manuell geprüft' },
      updatedByUserId: 'vale',
      createdAt: '2026-06-09T08:00:00.000Z',
      updatedAt: '2026-06-09T08:00:00.000Z',
    };

    const merged = mergeInventoryDetailOverride(item, override);
    expect(merged.secondaryVoltageV).toBe(690);
    expect(merged.vectorGroup).toBe(item.vectorGroup);
    expect(merged.note).toBe('manuell geprüft');
    expect(item.secondaryVoltageV).toBe(400);
  });

  it('selects the newest calculation link and stores attachment metadata by HT position', () => {
    const links: TransformerInventoryCalculationLink[] = [
      { id: 'old', inventoryPosition: 'HT9001', customerId: 'cust-1', calculationId: 'calc-old', calculatedAt: '2026-06-01T08:00:00.000Z', note: null, createdAt: '2026-06-01T08:00:00.000Z', updatedAt: '2026-06-01T08:00:00.000Z' },
      { id: 'new', inventoryPosition: 'HT9001', customerId: 'cust-2', calculationId: 'calc-new', calculatedAt: '2026-06-09T08:00:00.000Z', note: null, createdAt: '2026-06-09T08:00:00.000Z', updatedAt: '2026-06-09T08:00:00.000Z' },
    ];
    const attachment: TransformerInventoryAttachment = {
      id: 'att-1',
      inventoryPosition: 'HT9001',
      type: 'photo',
      fileName: 'typenschild.jpg',
      mimeType: 'image/jpeg',
      storageKey: 'data:image/jpeg;base64,abc',
      caption: 'Typenschild',
      uploadedByUserId: 'vale',
      uploadedAt: '2026-06-09T08:00:00.000Z',
      createdAt: '2026-06-09T08:00:00.000Z',
      updatedAt: '2026-06-09T08:00:00.000Z',
    };

    expect(getLatestCalculationLink('HT9001', links)?.id).toBe('new');
    expect(attachment.inventoryPosition).toBe('HT9001');
    expect(attachment.storageKey).toMatch(/^data:image\//);
  });

  it('builds new inventory transformers as asset-compatible records with owner type', () => {
    const asset = buildTransformerAssetFromDraft({
      ownership: 'own',
      position: 'HT9007',
      manufacturer: 'Demo Epsilon',
      powerKva: '630',
      primaryVoltageKv: '20',
      secondaryVoltageV: '400',
      vectorGroup: 'Dyn5',
      serialNumber: 'SN-167',
      constructionYear: '2020',
      constructionType: 'Hermetik',
      weightKg: '1880',
      note: 'aus Modal',
    }, {
      id: 'asset-9007',
      now: '2026-06-11T10:00:00.000Z',
      assetTypeId: 'trafo-type',
    });

    expect(asset).toMatchObject({
      id: 'asset-9007',
      name: 'HT9007 · Demo Epsilon · 630 kVA',
      assetTypeId: 'trafo-type',
      customerId: null,
      internalAssetId: 'HT9007',
      inventoryOwnerType: 'own',
      inventoryOrigin: 'HT-VOLTEQ',
      manufacturer: 'Demo Epsilon',
      serialNumber: 'SN-167',
      buildYear: 2020,
      totalWeight: 1880,
      powerKva: 630,
      trafoKind: 'oil',
      oilSystem: 'hermetic',
      windingCount: '2w',
      primaryVoltageKv: 20,
      secondaryVoltageV: 400,
      vectorGroup: 'Dyn5',
      constructionType: 'Hermetik',
      notes: 'aus Modal',
    });
  });

  it('maps manual transformer assets back into the inventory table and derives next positions', () => {
    const asset: AssetNode = {
      id: 'asset-ext-1',
      name: 'Fremdtrafo Elbag',
      parentId: null,
      customerId: 'cust-1',
      locationId: null,
      tagIds: [],
      internalAssetId: 'FT0001',
      inventoryOwnerType: 'external',
      inventoryOrigin: 'Elbag',
      manufacturer: 'Elbag',
      powerKva: 1000,
      primaryVoltageKv: 10,
      secondaryVoltageV: 400,
      vectorGroup: 'Dyn5',
      serialNumber: 'E-1',
      buildYear: 2018,
      constructionType: 'Öltrafo',
      createdAt: '2026-06-11T10:00:00.000Z',
      updatedAt: '2026-06-11T10:00:00.000Z',
    };

    expect(transformerAssetToInventoryItem(asset)).toMatchObject({
      position: 'FT0001',
      origin: 'Elbag',
      manufacturer: 'Elbag',
      powerKva: 1000,
      primaryVoltageKv: 10,
      secondaryVoltageV: 400,
      vectorGroup: 'Dyn5',
      serialNumber: 'E-1',
      constructionYear: 2018,
      constructionType: 'Öltrafo',
    });
    expect(deriveNextManualTransformerPosition(transformerInventoryAssets, 'own')).toBe('HT9007');
    expect(deriveNextManualTransformerPosition([asset], 'external')).toBe('FT0002');
  });

  it('wires a plus-only primary action next to the Lagertrafos title that opens the new transformer modal', () => {
    const pageSource = readFileSync(resolve(__dirname, 'pages/TransformerInventoryPage.tsx'), 'utf8');
    const dataTableSource = readFileSync(resolve(__dirname, '../../components/ui/DataTable.tsx'), 'utf8');

    expect(pageSource).toContain('handleOpenNewTransformerModal');
    expect(pageSource).toContain('ariaLabel: \'Neuen Trafo anlegen\'');
    expect(pageSource).toContain('title={`${filteredItems.length} Lagertrafos`}');
    expect(pageSource).not.toContain('../data/transformerInventory');
    expect(pageSource).toContain('Neuer Trafo');
    expect(pageSource).toContain('Eigener Trafo');
    expect(pageSource).toContain('Fremdtrafo');
    expect(pageSource).toContain("repository.upsert<AssetNode>('assets'");
    expect(dataTableSource).toContain('iconOnly?: boolean');
    expect(dataTableSource).toContain('aria-label={primaryAction.ariaLabel ?? primaryAction.label}');
  });

  it('tracks transformer purchase price plus performed services, material and packages as persistent cost items', () => {
    const now = '2026-06-11T12:00:00.000Z';
    const service: Service = {
      id: 'svc-test',
      serviceNumber: 'SL9999',
      name: 'Trafoprüfung',
      description: null,
      unit: 'Pauschal',
      price: 180,
      category: 'Prüfung',
      active: true,
      availableInWorkshopCards: true,
      workshopCategory: null,
      workshopRequired: false,
      workshopPhotoRequired: false,
      workshopProtocolRequired: false,
      workshopMeasurementsRequired: false,
      workshopMaterialEntryEnabled: false,
      sortOrder: 100,
      checklistTemplateIds: [],
      createdAt: now,
      updatedAt: now,
    };
    const material: Material = {
      id: 'mat-test',
      articleNumber: 'MAT-TEST',
      name: 'Dichtungssatz',
      description: null,
      unit: 'Stk',
      price: 42.5,
      supplier: null,
      category: 'Trafo',
      createdAt: now,
      updatedAt: now,
    };
    const pkg: ServicePackage = {
      id: 'pkg-test',
      packageNumber: 'LP9999',
      name: 'Ölprobe Paket',
      description: null,
      category: 'Prüfung',
      active: true,
      priceMode: 'sum',
      fixedPrice: null,
      hintText: null,
      customerNote: null,
      checklistTemplateIds: [],
      createdAt: now,
      updatedAt: now,
    };
    const packageItems: ServicePackageItem[] = [
      { id: 'pkg-item-1', packageId: pkg.id, type: 'service', serviceId: service.id, materialId: null, descriptionSnapshot: 'Ölprobe ziehen', quantity: 1, unitSnapshot: 'Pauschal', unitPriceSnapshot: 65, sortOrder: 100, createdAt: now, updatedAt: now },
      { id: 'pkg-item-2', packageId: pkg.id, type: 'material', serviceId: null, materialId: material.id, descriptionSnapshot: 'Laborflasche', quantity: 2, unitSnapshot: 'Stk', unitPriceSnapshot: 12.5, sortOrder: 200, createdAt: now, updatedAt: now },
    ];

    const common = { inventoryPosition: 'HT9007', assetId: 'asset-9007', performedAt: '2026-06-11', now };
    const items = [
      buildPurchaseCostItem('1000', { ...common, id: 'cost-purchase', sortOrder: 0 }),
      buildTransformerCostItemFromService(service, { ...common, id: 'cost-service', quantity: 1, sortOrder: 100 }),
      buildTransformerCostItemFromMaterial(material, { ...common, id: 'cost-material', quantity: 2, sortOrder: 200 }),
      buildTransformerCostItemFromPackage(pkg, packageItems, { ...common, id: 'cost-package', quantity: 1, sortOrder: 300 }),
    ];

    expect(hasPurchaseCostItem(items)).toBe(true);
    expect(items.map((item) => [item.type, item.description, item.totalPrice])).toEqual([
      ['purchase', 'Einkaufspreis', 1000],
      ['service', 'Trafoprüfung', 180],
      ['material', 'Dichtungssatz', 85],
      ['package', 'Ölprobe Paket', 90],
    ]);
    expect(calculateTransformerCostTotal(items)).toBe(1355);
  });

  it('renders a full-screen transformer modal with a required purchase price, addable cost positions and total price', () => {
    const pageSource = readFileSync(resolve(__dirname, 'pages/TransformerInventoryPage.tsx'), 'utf8');
    const repositorySource = readFileSync(resolve(__dirname, '../../lib/repository.ts'), 'utf8');
    const appStoreSource = readFileSync(resolve(__dirname, '../../context/AppStoreContext.tsx'), 'utf8');
    const serverSource = readFileSync(resolve(__dirname, '../../../../server/routes/entities.ts'), 'utf8');

    expect(pageSource).toContain('h-[calc(100vh-2rem)]');
    expect(pageSource).toContain('Einkaufspreis');
    expect(pageSource).toContain('Bereits erbrachte Leistungen / Kosten');
    expect(pageSource).toContain('Leistung hinzufügen');
    expect(pageSource).toContain('Material hinzufügen');
    expect(pageSource).toContain('Leistungspaket hinzufügen');
    expect(pageSource).toContain('Gesamtpreis');
    expect(pageSource).toContain("repository.upsert<TransformerInventoryCostItem>('transformerInventoryCostItems'");
    expect(repositorySource).toContain("'transformerInventoryCostItems'");
    expect(appStoreSource).toContain('transformerInventoryCostItems');
    expect(serverSource).toContain("transformerInventoryCostItems: 'transformer_inventory_cost_items'");
  });
});
