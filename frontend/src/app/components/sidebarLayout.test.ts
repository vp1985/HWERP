import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const componentDir = join(process.cwd(), 'src/app/components');
const readComponent = (name: string) => readFileSync(join(componentDir, name), 'utf8');

describe('responsive sidebar layout contracts', () => {
  it('keeps mobile content full-width and switches desktop main offset by sidebar mode', () => {
    const layoutSource = readComponent('Layout.tsx');

    expect(layoutSource).toContain('Navigation öffnen');
    expect(layoutSource).toContain('lg:hidden');
    expect(layoutSource).toContain('mobileMenuOpen');
    expect(layoutSource).toContain('lg:ml-64');
    expect(layoutSource).toContain('lg:ml-20');
    expect(layoutSource).not.toContain('flex-1 ml-64 overflow-y-auto');
  });

  it('renders the sidebar as desktop icon-only-capable and mobile off-canvas', () => {
    const sidebarSource = readComponent('Sidebar.tsx');

    expect(sidebarSource).toContain("mode === 'iconOnly'");
    expect(sidebarSource).toContain('w-20');
    expect(sidebarSource).toContain('w-64');
    expect(sidebarSource).toContain('mobileOpen');
    expect(sidebarSource).toContain('-translate-x-full');
    expect(sidebarSource).toContain('translate-x-0');
    expect(sidebarSource).toContain('onCloseMobile');
  });
});
