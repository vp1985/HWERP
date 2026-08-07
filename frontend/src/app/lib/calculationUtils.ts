import { CalculationLineItem } from './types';

/**
 * Berechnet hierarchische Positionsnummern für alle LineItems.
 *
 * Regeln:
 * - type === 'info'          → positionNumber = null  (Zähler nicht erhöhen)
 * - assetHeaderId === null   → Root-Level: 1, 2, 3, …
 * - assetHeaderId !== null   → Child: parentNr.1, parentNr.2, …
 *
 * Unterstützt beliebige Tiefe ("1", "1.1", "1.1.1", …) via depth-first Traversal.
 * Items müssen in der gewünschten Reihenfolge übergeben werden.
 * Gibt ein neues Array mit aktualisierten positionNumber-Strings zurück.
 */
export function assignPositionNumbers(items: CalculationLineItem[]): CalculationLineItem[] {
  const result = items.map((i) => ({ ...i }));

  function assignForParent(parentId: string | null, prefix: string): void {
    const siblings = result.filter((i) => i.assetHeaderId === parentId);
    let counter = 0;
    for (const item of siblings) {
      if (item.type === 'info') {
        item.positionNumber = null;
      } else {
        counter++;
        const num = prefix ? `${prefix}.${counter}` : String(counter);
        item.positionNumber = num;
        if (item.type === 'asset_header') {
          assignForParent(item.id, num);
        }
      }
    }
  }

  assignForParent(null, '');
  return result;
}

/**
 * Berechnet den aggregierten Gesamtpreis aller direkten und indirekten
 * Nicht-Header-Nachkommen pro Header (rekursiv).
 *
 * info-Items haben totalPrice = 0 und zählen daher mit 0.
 * Gibt eine Map<headerId, aggregatePrice> zurück.
 */
export function computeHeaderAggregates(items: CalculationLineItem[]): Map<string, number> {
  const result = new Map<string, number>();

  function sumDescendants(headerId: string): number {
    let sum = 0;
    for (const item of items) {
      if (item.assetHeaderId === headerId) {
        if (item.type === 'asset_header') {
          sum += sumDescendants(item.id);
        } else {
          sum += item.totalPrice;
        }
      }
    }
    return sum;
  }

  const headers = items.filter((i) => i.type === 'asset_header');
  for (const header of headers) {
    result.set(header.id, sumDescendants(header.id));
  }

  return result;
}

/**
 * Gibt die Indizes eines asset_header und ALLER Nachkommen (rekursiv) zurück.
 *
 * Basiert auf assetHeaderId (explizit), nicht auf positional-Gruppierung.
 * Wichtig für DnD-Blockmove: Header + gesamter Teilbaum bewegen sich als Block.
 */
export function getGroupIndices(items: CalculationLineItem[], headerIndex: number): number[] {
  const headerId = items[headerIndex].id;
  const indices: number[] = [headerIndex];

  function collectDescendants(parentId: string): void {
    items.forEach((item, idx) => {
      if (item.assetHeaderId === parentId) {
        indices.push(idx);
        if (item.type === 'asset_header') {
          collectDescendants(item.id);
        }
      }
    });
  }

  collectDescendants(headerId);
  return indices;
}
