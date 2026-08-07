import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const pageSource = () => readFileSync(resolve(__dirname, 'ServicesPage.tsx'), 'utf8');

describe('Services page number range contract', () => {
  it('uses the central Serviceleistungen SL0001 number range instead of the legacy SRV-001 format', () => {
    const source = pageSource();

    expect(source).toContain('SERVICE_NUMBER_RANGE_ID');
    expect(source).toContain('Serviceleistungen');
    expect(source).toContain('SL0001');
    expect(source).not.toContain('SL00001');
    expect(source).not.toContain('SRV-001');
    expect(source).not.toContain('SRV-XXX');
  });

  it('renders the Leistungen table with margins reduced by about 90 percent', () => {
    const source = pageSource();
    const dataTableSource = readFileSync(resolve(__dirname, '../components/ui/DataTable.tsx'), 'utf8');

    expect(source).toContain('overflow-hidden p-[3px]');
    expect(source).not.toContain('overflow-hidden p-8');
    expect(source).toContain('density="ultraCompact"');
    expect(dataTableSource).toContain("density?: 'normal' | 'ultraCompact'");
    expect(dataTableSource).toContain("density === 'ultraCompact'");
    expect(dataTableSource).toContain('px-[2px] py-[1px] text-sm');
    expect(dataTableSource).toContain('px-[2px] py-[1px] text-[11px]');
    expect(dataTableSource).toContain('px-[2px] py-[2px] border-b');
  });
});
