import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const pageSource = () => readFileSync(resolve(__dirname, 'ServicePackagesPage.tsx'), 'utf8');
const routesSource = () => readFileSync(resolve(__dirname, '../routes.tsx'), 'utf8');
const sidebarSource = () => readFileSync(resolve(__dirname, '../components/Sidebar.tsx'), 'utf8');

describe('ServicePackagesPage contracts', () => {
  it('registers a Leistungspakete route and sidebar entry', () => {
    expect(routesSource()).toContain("path: 'service-packages'");
    expect(sidebarSource()).toContain('Leistungspakete');
    expect(sidebarSource()).toContain('to="/service-packages"');
  });

  it('lets users combine services, materials and hint text lines in a package', () => {
    const source = pageSource();

    expect(source).toContain('Leistungspakete');
    expect(source).toContain('Leistung hinzufügen');
    expect(source).toContain('Material hinzufügen');
    expect(source).toContain('Hinweistext hinzufügen');
    expect(source).toContain('Interner Hinweis');
    expect(source).toContain('Kundentext');
    expect(source).toContain('Paket-Festpreis');
    expect(source).toContain('Summe aus Positionen');
    expect(source).toContain("repository.list<ServicePackage>('servicePackages')");
    expect(source).toContain("repository.list<ServicePackageItem>('servicePackageItems')");
  });
});
