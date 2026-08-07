import { describe, it, expect } from 'vitest';
import { assignPositionNumbers, computeHeaderAggregates, getGroupIndices } from './calculationUtils';
import { CalculationLineItem } from './types';

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeItem(
  overrides: Partial<CalculationLineItem> & Pick<CalculationLineItem, 'id' | 'type'>
): CalculationLineItem {
  return {
    calculationId: 'calc-1',
    positionNumber: null,
    assetHeaderId: null,
    materialId: null,
    serviceId: null,
    description: overrides.id,
    quantity: 1,
    unit: 'Stk',
    unitPrice: 0,
    totalPrice: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('assignPositionNumbers', () => {
  it('vergibt Root-Nummern für Header ohne assetHeaderId', () => {
    const h1 = makeItem({ id: 'h1', type: 'asset_header' });
    const h2 = makeItem({ id: 'h2', type: 'asset_header' });
    const result = assignPositionNumbers([h1, h2]);
    expect(result[0].positionNumber).toBe('1');
    expect(result[1].positionNumber).toBe('2');
  });

  it('vergibt hierarchische Nummern für Children', () => {
    const h1 = makeItem({ id: 'h1', type: 'asset_header' });
    const c1 = makeItem({ id: 'c1', type: 'material', assetHeaderId: 'h1' });
    const c2 = makeItem({ id: 'c2', type: 'service', assetHeaderId: 'h1' });
    const result = assignPositionNumbers([h1, c1, c2]);
    expect(result[0].positionNumber).toBe('1');
    expect(result[1].positionNumber).toBe('1.1');
    expect(result[2].positionNumber).toBe('1.2');
  });

  it('setzt positionNumber = null für info-Items', () => {
    const h1 = makeItem({ id: 'h1', type: 'asset_header' });
    const info = makeItem({ id: 'i1', type: 'info', assetHeaderId: 'h1' });
    const result = assignPositionNumbers([h1, info]);
    expect(result[1].positionNumber).toBeNull();
  });

  it('Testfall 1: Header-Block-Move — Nummern korrekt nach Verschiebung', () => {
    // Ausgangslage: h1(1) → c1(1.1), c2(1.2), h2(2)
    // Nach Move von h2 an Position 0: h2 wird zu "1", h1 zu "2"
    const h1 = makeItem({ id: 'h1', type: 'asset_header' });
    const c1 = makeItem({ id: 'c1', type: 'material', assetHeaderId: 'h1' });
    const c2 = makeItem({ id: 'c2', type: 'material', assetHeaderId: 'h1' });
    const h2 = makeItem({ id: 'h2', type: 'asset_header' });

    // Simuliere Block-Move: h2 an Anfang
    const reordered = [h2, h1, c1, c2];
    const result = assignPositionNumbers(reordered);

    expect(result[0].positionNumber).toBe('1'); // h2
    expect(result[1].positionNumber).toBe('2'); // h1
    expect(result[2].positionNumber).toBe('2.1'); // c1
    expect(result[3].positionNumber).toBe('2.2'); // c2
  });

  it('Testfall 2: Child-Reparenting A → B', () => {
    const h1 = makeItem({ id: 'h1', type: 'asset_header' });
    const h2 = makeItem({ id: 'h2', type: 'asset_header' });
    const c1 = makeItem({ id: 'c1', type: 'material', assetHeaderId: 'h1' });
    const c2 = makeItem({ id: 'c2', type: 'material', assetHeaderId: 'h1' });

    // c2 wird zu h2 reparented
    const reparented = [h1, c1, h2, { ...c2, assetHeaderId: 'h2' }];
    const result = assignPositionNumbers(reparented);

    expect(result[0].positionNumber).toBe('1');   // h1
    expect(result[1].positionNumber).toBe('1.1'); // c1 (noch bei h1)
    expect(result[2].positionNumber).toBe('2');   // h2
    expect(result[3].positionNumber).toBe('2.1'); // c2 (jetzt bei h2)
  });

  it('Testfall 4: Root-Items und Children überschneiden sich nicht', () => {
    const root = makeItem({ id: 'root1', type: 'material' }); // Root ohne Header
    const h1 = makeItem({ id: 'h1', type: 'asset_header' });
    const c1 = makeItem({ id: 'c1', type: 'material', assetHeaderId: 'h1' });
    const c2 = makeItem({ id: 'c2', type: 'material', assetHeaderId: 'h1' });

    const result = assignPositionNumbers([root, h1, c1, c2]);
    expect(result[0].positionNumber).toBe('1');   // root
    expect(result[1].positionNumber).toBe('2');   // h1
    expect(result[2].positionNumber).toBe('2.1'); // c1
    expect(result[3].positionNumber).toBe('2.2'); // c2
  });

  it('Testfall 5: Workshop-Header bekommt jetzt eine Nummer', () => {
    // Workshop-Header hatte früher positionNumber: null — jetzt bekommen sie "1", "2" etc.
    const workshop = makeItem({ id: 'wh', type: 'asset_header', positionNumber: null });
    const c1 = makeItem({ id: 'c1', type: 'service', assetHeaderId: 'wh' });
    const c2 = makeItem({ id: 'c2', type: 'service', assetHeaderId: 'wh' });

    const result = assignPositionNumbers([workshop, c1, c2]);
    expect(result[0].positionNumber).toBe('1');   // Workshop-Header → "1"
    expect(result[1].positionNumber).toBe('1.1');
    expect(result[2].positionNumber).toBe('1.2');
  });

  it('3 Ebenen: Header → Sub-Header → Material → "1.1.1"', () => {
    const h1 = makeItem({ id: 'h1', type: 'asset_header' });
    const sh1 = makeItem({ id: 'sh1', type: 'asset_header', assetHeaderId: 'h1' });
    const m1 = makeItem({ id: 'm1', type: 'material', assetHeaderId: 'sh1' });
    const m2 = makeItem({ id: 'm2', type: 'material', assetHeaderId: 'h1' });
    const h2 = makeItem({ id: 'h2', type: 'asset_header' });

    const result = assignPositionNumbers([h1, sh1, m1, m2, h2]);
    expect(result[0].positionNumber).toBe('1');     // h1
    expect(result[1].positionNumber).toBe('1.1');   // sh1
    expect(result[2].positionNumber).toBe('1.1.1'); // m1
    expect(result[3].positionNumber).toBe('1.2');   // m2
    expect(result[4].positionNumber).toBe('2');     // h2
  });
});

describe('computeHeaderAggregates', () => {
  it('Testfall 3: Aggregatpreis ist Summe der Children', () => {
    const h1 = makeItem({ id: 'h1', type: 'asset_header' });
    const c1 = makeItem({ id: 'c1', type: 'material', assetHeaderId: 'h1', totalPrice: 100 });
    const c2 = makeItem({ id: 'c2', type: 'material', assetHeaderId: 'h1', totalPrice: 50 });
    const c3 = makeItem({ id: 'c3', type: 'material', assetHeaderId: 'h1', totalPrice: 25 });

    const agg = computeHeaderAggregates([h1, c1, c2, c3]);
    expect(agg.get('h1')).toBe(175);
  });

  it('Info-Child zählt mit 0', () => {
    const h1 = makeItem({ id: 'h1', type: 'asset_header' });
    const info = makeItem({ id: 'i1', type: 'info', assetHeaderId: 'h1', totalPrice: 0 });
    const c1 = makeItem({ id: 'c1', type: 'material', assetHeaderId: 'h1', totalPrice: 80 });

    const agg = computeHeaderAggregates([h1, info, c1]);
    expect(agg.get('h1')).toBe(80);
  });

  it('Testfall 6: buy_sell-Header zeigt eigenen totalPrice, kein Aggregat-Overlay', () => {
    // buy_sell-Header hat unitPrice > 0 → totalPrice = quantity * unitPrice
    // Aggregat ist 0 (keine Children typischerweise)
    const buySell = makeItem({ id: 'bs', type: 'asset_header', unitPrice: 500, totalPrice: 500 });

    const agg = computeHeaderAggregates([buySell]);
    // Kein Child → Aggregat = 0
    expect(agg.get('bs')).toBe(0);
    // Der eigene Preis bleibt unberührt
    expect(buySell.totalPrice).toBe(500);
  });

  it('3 Ebenen: Level-1-Header summiert auch Enkel-Preise', () => {
    const h1 = makeItem({ id: 'h1', type: 'asset_header' });
    const sh1 = makeItem({ id: 'sh1', type: 'asset_header', assetHeaderId: 'h1' });
    const m1 = makeItem({ id: 'm1', type: 'material', assetHeaderId: 'sh1', totalPrice: 80 });
    const m2 = makeItem({ id: 'm2', type: 'material', assetHeaderId: 'h1', totalPrice: 20 });

    const agg = computeHeaderAggregates([h1, sh1, m1, m2]);
    expect(agg.get('sh1')).toBe(80);  // sh1 → nur m1
    expect(agg.get('h1')).toBe(100);  // h1 → m2(20) + sh1's subtree(80)
  });
});

describe('getGroupIndices', () => {
  it('gibt Header-Index + alle Child-Indices zurück', () => {
    const h1 = makeItem({ id: 'h1', type: 'asset_header' });
    const c1 = makeItem({ id: 'c1', type: 'material', assetHeaderId: 'h1' });
    const c2 = makeItem({ id: 'c2', type: 'service', assetHeaderId: 'h1' });
    const h2 = makeItem({ id: 'h2', type: 'asset_header' });

    const indices = getGroupIndices([h1, c1, c2, h2], 0);
    expect(indices).toEqual([0, 1, 2]);
  });

  it('gibt nur den Header-Index zurück wenn keine Children', () => {
    const h1 = makeItem({ id: 'h1', type: 'asset_header' });
    const h2 = makeItem({ id: 'h2', type: 'asset_header' });

    const indices = getGroupIndices([h1, h2], 0);
    expect(indices).toEqual([0]);
  });

  it('findet Children auch wenn sie nicht direkt nach Header stehen (nach Reparenting)', () => {
    const h1 = makeItem({ id: 'h1', type: 'asset_header' });
    const c1 = makeItem({ id: 'c1', type: 'material', assetHeaderId: 'h1' });
    const h2 = makeItem({ id: 'h2', type: 'asset_header' });
    const c2 = makeItem({ id: 'c2', type: 'material', assetHeaderId: 'h1' }); // Child von h1, aber nach h2

    const indices = getGroupIndices([h1, c1, h2, c2], 0);
    expect(indices).toEqual([0, 1, 3]); // h1, c1, c2 (nicht h2)
  });

  it('3 Ebenen: gibt Header + Sub-Header + alle Enkel zurück', () => {
    const h1 = makeItem({ id: 'h1', type: 'asset_header' });
    const sh1 = makeItem({ id: 'sh1', type: 'asset_header', assetHeaderId: 'h1' });
    const m1 = makeItem({ id: 'm1', type: 'material', assetHeaderId: 'sh1' });
    const m2 = makeItem({ id: 'm2', type: 'material', assetHeaderId: 'h1' });
    const h2 = makeItem({ id: 'h2', type: 'asset_header' });

    const indices = getGroupIndices([h1, sh1, m1, m2, h2], 0);
    expect(indices).toEqual([0, 1, 2, 3]); // h1, sh1, m1, m2 (nicht h2)
  });
});
