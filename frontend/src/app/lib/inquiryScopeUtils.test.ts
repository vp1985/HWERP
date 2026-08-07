import { describe, expect, it } from 'vitest';
import type { AssetNode, Material, Service } from './types';
import {
  assignInquiryScopeNumbers,
  buildInquiryScopeAssetSection,
  buildInquiryScopeMaterialItem,
  buildInquiryScopeNoteItem,
  buildInquiryScopeServiceItem,
  formatInquiryScopeForOffice,
} from './inquiryScopeUtils';

const now = '2026-05-22T12:00:00.000Z';

const asset: AssetNode = {
  id: 'asset-1',
  name: 'Trafo HT-42',
  parentId: null,
  customerId: 'cust-1',
  locationId: 'loc-1',
  tagIds: [],
  notes: undefined,
  createdAt: now,
  updatedAt: now,
};

const material: Material = {
  id: 'mat-1',
  articleNumber: 'MAT-1',
  name: 'Dichtungssatz',
  description: null,
  unit: 'Stk',
  supplier: null,
  category: null,
  createdAt: now,
  updatedAt: now,
} as Material;

const service: Service = {
  id: 'srv-1',
  serviceNumber: 'SL0001',
  name: 'Wartung Trafo',
  description: null,
  unit: 'Std',
  category: null,
  createdAt: now,
  updatedAt: now,
} as Service;

describe('inquiry scope helpers', () => {
  it('builds scope rows from existing HWERP asset, material and service without monetary fields', () => {
    const rows = [
      buildInquiryScopeAssetSection(asset, { now, id: 'scope-asset' }),
      buildInquiryScopeMaterialItem(material, { now, id: 'scope-material', parentId: 'scope-asset' }),
      buildInquiryScopeServiceItem(service, { now, id: 'scope-service', parentId: 'scope-asset' }),
    ];

    expect(rows).toMatchObject([
      { kind: 'asset_section', assetId: 'asset-1', title: 'Trafo HT-42', unit: 'Stk' },
      { kind: 'material', materialId: 'mat-1', title: 'Dichtungssatz', unit: 'Stk', parentId: 'scope-asset' },
      { kind: 'service', serviceId: 'srv-1', title: 'Wartung Trafo', unit: 'Std', parentId: 'scope-asset' },
    ]);
    expect(JSON.stringify(rows)).not.toMatch(/price|amount|total|rate|€/i);
  });

  it('builds price-free note rows for free hint texts', () => {
    const note = buildInquiryScopeNoteItem('Arbeiten nur nach Freischaltung und Erdung.', {
      now,
      id: 'scope-note',
      parentId: 'scope-asset',
      inquiryId: 'inq-1',
    });

    expect(note).toMatchObject({
      kind: 'note',
      assetId: null,
      materialId: null,
      serviceId: null,
      title: 'Arbeiten nur nach Freischaltung und Erdung.',
      quantity: 0,
      unit: '',
      note: null,
      parentId: 'scope-asset',
      inquiryId: 'inq-1',
    });
    expect(JSON.stringify(note)).not.toMatch(/price|amount|total|rate|€/i);
  });

  it('assigns calculation-like position numbers for office handover', () => {
    const numbered = assignInquiryScopeNumbers([
      buildInquiryScopeAssetSection(asset, { now, id: 'scope-asset' }),
      buildInquiryScopeServiceItem(service, { now, id: 'scope-service', parentId: 'scope-asset' }),
      buildInquiryScopeMaterialItem(material, { now, id: 'scope-material', parentId: 'scope-asset' }),
    ]);

    expect(numbered.map((row) => row.positionNumber)).toEqual(['1', '1.1', '1.2']);
  });

  it('formats a compact non-monetary office summary', () => {
    const rows = assignInquiryScopeNumbers([
      buildInquiryScopeAssetSection(asset, { now, id: 'scope-asset' }),
      { ...buildInquiryScopeServiceItem(service, { now, id: 'scope-service', parentId: 'scope-asset' }), quantity: 4 },
    ]);

    expect(formatInquiryScopeForOffice(rows)).toBe('1 Trafo HT-42 — 1 Stk\n1.1 Wartung Trafo — 4 Std');
  });
});
