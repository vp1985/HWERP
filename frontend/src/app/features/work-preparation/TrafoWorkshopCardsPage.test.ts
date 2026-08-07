import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const pageSource = () => readFileSync(resolve(__dirname, 'pages/TrafoWorkshopCardsPage.tsx'), 'utf8');
const routesSource = () => readFileSync(resolve(__dirname, '../../routes.tsx'), 'utf8');
const sidebarSource = () => readFileSync(resolve(__dirname, '../../components/Sidebar.tsx'), 'utf8');
const repositorySource = () => readFileSync(resolve(__dirname, '../../lib/repository.ts'), 'utf8');
const contextSource = () => readFileSync(resolve(__dirname, '../../context/AppStoreContext.tsx'), 'utf8');
const typesSource = () => readFileSync(resolve(__dirname, '../../lib/types.ts'), 'utf8');
const servicesPageSource = () => readFileSync(resolve(__dirname, '../../pages/ServicesPage.tsx'), 'utf8');
const migrationSource = () => readFileSync(resolve(__dirname, '../../../../migrations/008_workshop_cards.sql'), 'utf8');

describe('Arbeitsvorbereitung / Trafo-Werkstattkarten contracts', () => {
  it('registers Arbeitsvorbereitung navigation and the Trafo-Werkstattkarten route', () => {
    expect(routesSource()).toContain("path: 'arbeitsvorbereitung/trafo-werkstattkarten'");
    expect(sidebarSource()).toContain('Arbeitsvorbereitung');
    expect(sidebarSource()).toContain('Trafo-Werkstattkarten');
    expect(sidebarSource()).toContain('/arbeitsvorbereitung/trafo-werkstattkarten');
  });

  it('keeps Leistungen/Services under Stammdaten and uses them for workshop card templates', () => {
    const sidebar = sidebarSource();
    const page = pageSource();
    const servicesPage = servicesPageSource();
    const migration = migrationSource();

    expect(sidebar).toContain('Stammdaten');
    expect(sidebar).toContain('Leistungen');
    expect(sidebar).toContain('/masterdata/services');
    expect(routesSource()).toContain("path: 'masterdata/services'");
    expect(page).toContain("repository.list<Service>('services')");
    expect(page).not.toContain("repository.list<WorkshopTaskTemplate>('workshopTaskTemplates')");
    expect(servicesPage).toContain('In Werkstattkarten verfügbar');
    expect(servicesPage).toContain('TX-Standsätze');
    expect(migration).toContain('available_in_workshop_cards');
    expect(migration).toContain('SL0001');
  });

  it('uses the repository/Postgres entity path instead of demo data or localStorage', () => {
    const source = pageSource();

    expect(source).toContain("repository.list<WorkshopCard>('workshopCards')");
    expect(source).toContain("repository.list<Service>('services')");
    expect(source).toContain("repository.create<WorkshopCard>('workshopCards'");
    expect(source).toContain("repository.create<WorkshopCardTask>('workshopCardTasks'");
    expect(source).not.toContain('demoData');
    expect(source).not.toContain('localStorage');
  });

  it('creates checklist runs for card-level and Leistungs-Checklisten when a Werkstattkarte is created', () => {
    const source = pageSource();

    expect(source).toContain("repository.list<ChecklistTemplate>('checklistTemplates')");
    expect(source).toContain("repository.list<ChecklistTemplateGroup>('checklistTemplateGroups')");
    expect(source).toContain("repository.list<ChecklistTemplateItem>('checklistTemplateItems')");
    expect(source).toContain('createChecklistRunFromTemplate');
    expect(source).toContain('getChecklistTemplatesForService');
    expect(source).toContain("repository.create<ChecklistRun>('checklistRuns'");
    expect(source).toContain("repository.create<ChecklistRunLink>('checklistRunLinks'");
    expect(source).toContain("repository.create<ChecklistRunItem>('checklistRunItems'");
    expect(source).toContain("targetType: 'workshop_card'");
    expect(source).toContain('Werkstattkarten-Checklisten');
  });

  it('adds workshop card entities to the shared repository and app store', () => {
    expect(repositorySource()).toContain("| 'workshopCards'");
    expect(repositorySource()).toContain("| 'workshopCardTasks'");
    expect(contextSource()).toContain("'workshopCards'");
    expect(contextSource()).toContain("'workshopCardTasks'");
    expect(typesSource()).toContain('export interface WorkshopCard');
    expect(typesSource()).toContain('export interface WorkshopCardTask');
    expect(typesSource()).toContain('availableInWorkshopCards');
    expect(typesSource()).toContain('serviceId: string | null');
  });

  it('uses the central Werkstattkarten number range for new cards', () => {
    const source = pageSource();

    expect(source).toContain('loadNumberRangesFromStorage');
    expect(source).toContain('buildNextWorkshopCardNumber');
    expect(source).toContain('reserveNextWorkshopCardNumber');
    expect(source).toContain('Nächste Werkstattkarte');
    expect(source).toContain('Nummer übernehmen');
  });

  it('keeps the first slice focused on Auftrag + Trafo, per-task time and signatures', () => {
    const source = pageSource();

    expect(source).toContain('Auftrag + Trafo');
    expect(source).toContain('Gesamtzeit');
    expect(source).toContain('Mitarbeiterkürzel');
    expect(source).toContain('Unterschrift');
    expect(source).toContain('QR-Code');
  });
});
