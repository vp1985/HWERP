import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const pageSource = () => readFileSync(resolve(__dirname, 'CalculationDetailPage.tsx'), 'utf8');

describe('Calculation detail hint text contract', () => {
  it('offers Hinweistext alongside Material and Service add actions', () => {
    const source = pageSource();

    expect(source).toContain('Material');
    expect(source).toContain('Service');
    expect(source).toContain('Hinweistext hinzufügen');
    expect(source).toContain('showInfoDialog');
  });

  it('uses the shared info line item factory instead of inline empty info rows', () => {
    const source = pageSource();

    expect(source).toContain('buildInfoCalculationLineItem');
    expect(source).not.toContain("type: 'info', materialId: null, serviceId: null, assetNodeId: null, description: ''");
  });
});
