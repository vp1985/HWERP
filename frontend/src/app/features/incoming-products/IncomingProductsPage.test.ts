import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const pageSource = () => readFileSync(resolve(__dirname, 'pages/IncomingProductsPage.tsx'), 'utf8');
const routesSource = () => readFileSync(resolve(__dirname, '../../routes.tsx'), 'utf8');
const sidebarSource = () => readFileSync(resolve(__dirname, '../../components/Sidebar.tsx'), 'utf8');

describe('IncomingProducts module contracts', () => {
  it('registers an incoming products route and sidebar entry', () => {
    expect(routesSource()).toContain("path: 'incoming-products'");
    expect(sidebarSource()).toContain("path: '/incoming-products'");
    expect(sidebarSource()).toContain('Eingesendete Produkte');
  });

  it('renders OCR-first and user-triggered Vision workflow affordances', () => {
    const source = pageSource();

    expect(source).toContain('Eingesendete Produkte');
    expect(source).toContain('OCR automatisch');
    expect(source).toContain('Vision-KI anfordern');
    expect(source).toContain('Typenschild');
    expect(source).toContain('HT-Vorschlag');
  });

  it('keeps review actions explicit before asset creation or update', () => {
    const source = pageSource();

    expect(source).toContain('Bestehendem Asset zuordnen');
    expect(source).toContain('Neu anlegen');
    expect(source).toContain('Konflikt prüfen');
    expect(source).toContain('Für Kleinanzeigen geeignet');
  });
});
