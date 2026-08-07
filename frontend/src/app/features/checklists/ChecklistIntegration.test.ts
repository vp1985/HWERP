import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(__dirname, '../../..');
const source = (relativePath: string) => readFileSync(resolve(root, relativePath), 'utf8');

describe('checklist MVP integration contracts', () => {
  it('registers checklist entities in repository and app store hydration', () => {
    const repository = source('app/lib/repository.ts');
    const context = source('app/context/AppStoreContext.tsx');
    const types = source('app/lib/types.ts');

    for (const entity of [
      'checklistTemplates',
      'checklistTemplateGroups',
      'checklistTemplateItems',
      'checklistTemplateLinks',
      'checklistItemActions',
      'checklistRuns',
      'checklistRunLinks',
      'checklistRunItems',
    ]) {
      expect(repository).toContain(`| '${entity}'`);
      expect(context).toContain(`${entity}: []`);
      expect(context).toContain(`'${entity}'`);
    }

    expect(types).toContain('export interface ChecklistTemplate');
    expect(types).toContain('export interface ChecklistRunItem');
  });

  it('places checklist templates under Stammdaten, not as a new Arbeitsvorbereitung top module', () => {
    const sidebar = source('app/components/Sidebar.tsx');
    const routes = source('app/routes.tsx');

    expect(sidebar).toContain('/masterdata/checklists');
    expect(sidebar).toContain('<span>Checklisten</span>');
    expect(routes).toContain("masterdata/checklists");
    expect(routes).toContain('ChecklistTemplatesPage');
  });

  it('stores checklist item follow-up rules as suggestions only in the first UI slice', () => {
    const templatePage = source('app/features/checklists/pages/ChecklistTemplatesPage.tsx');
    const inquiryDetail = source('app/pages/InquiryDetailPage.tsx');
    const domain = source('app/features/checklists/checklists.ts');

    expect(templatePage).toContain("triggerMode: 'suggest'");
    expect(templatePage).toContain('Folgevorschläge, keine automatische Erzeugung.');
    expect(templatePage).toContain('Vorschlag speichern');
    expect(inquiryDetail).toContain('resolveChecklistItemSuggestions');
    expect(inquiryDetail).toContain('Nur Vorschlag – es wird nichts automatisch erzeugt.');
    expect(domain).toContain('resolveChecklistItemSuggestions');
  });

  it('keeps checklist source model free of price and amount fields', () => {
    const migration = source('../migrations/010_checklists.sql');
    const types = source('app/lib/types.ts');
    const checklistsDomain = source('app/features/checklists/checklists.ts');

    const combined = `${migration}\n${types}\n${checklistsDomain}`;
    expect(combined).not.toMatch(/checklist[^\n]*(price|amount|cost|margin)/i);
    expect(combined).not.toMatch(/(price|amount|cost|margin)[^\n]*checklist/i);
  });

  it('lets Leistungen and Leistungspakete reference checklist templates', () => {
    const types = source('app/lib/types.ts');
    const servicesPage = source('app/pages/ServicesPage.tsx');
    const packagesPage = source('app/pages/ServicePackagesPage.tsx');
    const workshopMigration = source('../migrations/008_workshop_cards.sql');
    const packagesMigration = source('../migrations/010_service_packages.sql');
    const checklistMigration = source('../migrations/010_checklists.sql');

    expect(types).toContain('checklistTemplateIds: string[]');
    expect(servicesPage).toContain("repository.list<ChecklistTemplate>('checklistTemplates')");
    expect(servicesPage).toContain('Leistungs-Checklisten');
    expect(packagesPage).toContain("repository.list<ChecklistTemplate>('checklistTemplates')");
    expect(packagesPage).toContain('Paket-Checklisten');
    expect(workshopMigration).toContain('checklist_template_ids');
    expect(packagesMigration).toContain('checklist_template_ids');
    expect(checklistMigration).toContain("'service_package'");
  });
});
