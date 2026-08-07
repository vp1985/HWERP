import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const pageSource = () => readFileSync(resolve(__dirname, 'AdminNumberRangesPage.tsx'), 'utf8');
const routesSource = () => readFileSync(resolve(__dirname, '../routes.tsx'), 'utf8');
const sidebarSource = () => readFileSync(resolve(__dirname, '../components/Sidebar.tsx'), 'utf8');

describe('Admin number ranges page contracts', () => {
  it('registers the Nummernkreise admin route and sidebar entry', () => {
    expect(routesSource()).toContain("path: 'admin/nummernkreise'");
    expect(sidebarSource()).toContain("to=\"/admin/nummernkreise\"");
    expect(sidebarSource()).toContain('Nummernkreise');
  });

  it('contains the workshop-card number range editor and compact next-number preview layout', () => {
    const source = pageSource();

    expect(source).toContain('Werkstattkarten');
    expect(source).toContain('Übernahmebelege');
    expect(source).toContain('Serviceleistungen');
    expect(source).toContain('Prefix');
    expect(source).toContain('Anzahl fortlaufender Nummern');
    expect(source).toContain('Suffix');
    expect(source).toContain('Nächste Nummer');
    expect(source).toContain('Vorschau');
    expect(source).toContain('grid-cols-[1fr_auto_1fr]');
    expect(source).toContain('justify-self-center text-center');
    expect(source).toContain('Vorschau</span>');
    expect(source).toContain('preview.map');
  });

  it('keeps the newest number range at the top of the list', () => {
    const source = pageSource();
    const addNumberRangeSource = source.slice(source.indexOf('const addNumberRange'), source.indexOf('const removeNumberRange'));

    expect(addNumberRangeSource.indexOf('id: `number-range-${Date.now()}`')).toBeGreaterThan(-1);
    expect(addNumberRangeSource.indexOf('...current')).toBeGreaterThan(
      addNumberRangeSource.indexOf('id: `number-range-${Date.now()}`'),
    );
  });
});
