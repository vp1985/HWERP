import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('./SuppliersPage.tsx', import.meta.url), 'utf8');

describe('SuppliersPage copy contract', () => {
  it('frames the module as supplier management and product search, not RFQ processing', () => {
    expect(source).toContain('Lieferantenverwaltung');
    expect(source).toContain('Produkt- oder Kategoriesuche');
    expect(source).toContain('Konkrete Produkte');
    expect(source).not.toContain('<h1 className="text-2xl font-bold">Lieferantenanfrage</h1>');
    expect(source).not.toContain('<h2 className="mb-3 text-lg font-semibold">Lieferantensuche</h2>');
  });
});
