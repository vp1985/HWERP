import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('select options master data UI contract', () => {
  it('registers Auswahllisten as a Stammdaten route and sidebar item', () => {
    const routes = readFileSync('src/app/routes.tsx', 'utf8');
    const sidebar = readFileSync('src/app/components/Sidebar.tsx', 'utf8');

    expect(routes).toContain("import SelectOptionsPage from './pages/SelectOptionsPage'");
    expect(routes).toContain("path: 'masterdata/select-options'");
    expect(sidebar).toContain("label: 'Auswahllisten'");
    expect(sidebar).toContain("path: '/masterdata/select-options'");
  });

  it('offers the Trafo-Daten, Dokument and Anfrage dropdowns as editable master-data lists', () => {
    const helper = readFileSync('src/app/lib/selectOptions.ts', 'utf8');
    const page = readFileSync('src/app/pages/SelectOptionsPage.tsx', 'utf8');

    expect(helper).toContain("key: 'asset.trafoKind'");
    expect(helper).toContain("key: 'asset.oilSystem'");
    expect(helper).toContain("key: 'asset.windingCount'");
    expect(helper).toContain("key: 'assetDocument.kind'");
    expect(helper).toContain("key: 'inquiry.status'");
    expect(helper).toContain("key: 'inquiry.category'");
    expect(helper).toContain("label: 'Anfragestatus'");
    expect(helper).toContain("label: 'Anfragekategorie'");
    expect(page).toContain('Option hinzufügen');
    expect(page).toContain('Systemwerte können deaktiviert oder umbenannt werden');
    expect(page).toContain("repository.create<InquiryMasterDataCategory>('inquiryMasterDataCategories'");
  });
});
