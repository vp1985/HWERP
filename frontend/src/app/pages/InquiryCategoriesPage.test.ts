import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const pageSource = () => readFileSync(resolve(__dirname, 'InquiryCategoriesPage.tsx'), 'utf8');
const routesSource = () => readFileSync(resolve(__dirname, '../routes.tsx'), 'utf8');
const sidebarSource = () => readFileSync(resolve(__dirname, '../components/Sidebar.tsx'), 'utf8');

describe('InquiryCategoriesPage contracts', () => {
  it('is reachable from Stammdaten navigation', () => {
    expect(routesSource()).toContain("path: 'masterdata/inquiry-categories'");
    expect(sidebarSource()).toContain("path: '/masterdata/inquiry-categories'");
    expect(sidebarSource()).toContain('Anfragekategorien');
  });

  it('lets users maintain inquiry categories as editable master data', () => {
    const source = pageSource();

    expect(source).toContain('Anfragekategorien');
    expect(source).toContain('Neue Kategorie');
    expect(source).toContain('Name');
    expect(source).toContain('Beschreibung');
    expect(source).toContain('Reihenfolge');
    expect(source).toContain('Aktiv');
    expect(source).toContain("repository.list<InquiryMasterDataCategory>('inquiryMasterDataCategories')");
    expect(source).toContain("repository.list<ChecklistTemplate>('checklistTemplates')");
    expect(source).toContain("repository.upsert<InquiryMasterDataCategory>('inquiryMasterDataCategories'");
    expect(source).toContain('Checklisten');
    expect(source).toContain('checklistTemplateIds');
    expect(source).toContain('toggleChecklistTemplate');
    expect(source).toContain('linkedChecklistNames');
    expect(source).toContain('startEdit');
    expect(source).toContain('toggleActive');
  });
});
