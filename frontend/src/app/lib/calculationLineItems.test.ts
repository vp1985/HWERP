import { describe, expect, it } from 'vitest';
import { buildInfoCalculationLineItem, buildInventorySaleLineItem } from './calculationLineItems';
import type { TransformerInventoryItem } from '../features/transformer-inventory/types';

describe('calculation line item factories', () => {
  it('builds a price-free info line item for calculation hint texts', () => {
    const item = buildInfoCalculationLineItem({
      id: 'info-1',
      calculationId: 'calc-1',
      description: 'Arbeiten nur nach Freischaltung und Erdung.',
      assetHeaderId: 'asset-header-1',
      now: '2026-06-03T12:00:00.000Z',
    });

    expect(item).toMatchObject({
      id: 'info-1',
      calculationId: 'calc-1',
      positionNumber: null,
      assetHeaderId: 'asset-header-1',
      type: 'info',
      materialId: null,
      serviceId: null,
      assetNodeId: null,
      description: 'Arbeiten nur nach Freischaltung und Erdung.',
      quantity: 0,
      unit: '',
      unitPrice: 0,
      totalPrice: 0,
    });
  });

  it('builds an offer line item from a stock transformer while preserving the HT inventory reference and snapshot', () => {
    const transformer: TransformerInventoryItem = {
      position: 'HT0123',
      manufacturer: 'SGB',
      powerKva: 630,
      primaryVoltageKv: 20,
      secondaryVoltageV: 400,
      vectorGroup: 'Dyn5',
      serialNumber: 'SN-630',
      constructionYear: 2012,
      constructionType: 'Hermetik',
      weightKg: 1800,
      origin: 'Lager Nord',
      connectionType: 'Lasche',
      note: '',
      soldTo: '',
      invoiceNumber: '',
      exportListed: true,
      availableListed: true,
      resaleListed: false,
      maschinensucherListed: false,
      priceNote: '12.500 €',
    };

    const item = buildInventorySaleLineItem({
      id: 'line-1',
      calculationId: 'calc-1',
      inventoryItem: transformer,
      price: 12500,
      now: '2026-06-09T10:00:00.000Z',
    });

    expect(item).toMatchObject({
      id: 'line-1',
      calculationId: 'calc-1',
      positionNumber: null,
      assetHeaderId: null,
      type: 'asset_header',
      assetNodeId: null,
      inventoryPosition: 'own:HT0123',
      materialId: null,
      serviceId: null,
      quantity: 1,
      unit: 'Stk',
      unitPrice: 12500,
      totalPrice: 12500,
      createdAt: '2026-06-09T10:00:00.000Z',
      updatedAt: '2026-06-09T10:00:00.000Z',
    });
    expect(item.description).toContain('HT0123');
    expect(item.description).toContain('SGB');
    expect(item.description).toContain('630 kVA');
    expect(item.description).toContain('20 kV / 400 V');
    expect(item.description).toContain('SN SN-630');
  });
});
