import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const pageSource = () => readFileSync(resolve(__dirname, 'InquiryDetailPage.tsx'), 'utf8');
const dashboardSource = () => readFileSync(resolve(__dirname, 'InquiryDashboardPage.tsx'), 'utf8');
const routesSource = () => readFileSync(resolve(__dirname, '../routes.tsx'), 'utf8');

describe('Inquiry detail contracts', () => {
  it('registers a direct inquiry detail route and links to it from the dashboard', () => {
    expect(routesSource()).toContain("path: 'inquiries/:id'");
    expect(routesSource()).toContain('InquiryDetailPage');
    expect(dashboardSource()).toContain('Details öffnen');
    expect(dashboardSource()).toContain('/inquiries/');
  });

  it('offers editing from the inquiry detail via the dashboard edit modal', () => {
    const source = pageSource();

    expect(source).toContain('Bearbeiten');
    expect(source).toContain('to={`/inquiries?edit=${inquiry.id}`}');
  });

  it('shows inquiry number in the detail header', () => {
    const source = pageSource();

    expect(source).toContain('Anfrage-Nr.');
    expect(source).toContain('inquiry.inquiryNumber');
  });

  it('bundles the complete inquiry packet without automatic sending', () => {
    const source = pageSource();

    expect(source).toContain('Anfrage-Detail');
    expect(source).toContain('Kunde & Beteiligte');
    expect(source).toContain('Kommunikation');
    expect(source).toContain('Bilder & Anhänge');
    expect(source).toContain('Fachliche Vorkonfiguration');
    expect(source).toContain('Verknüpfungen');
    expect(source).toContain('Historie / Audit');
    expect(source).toContain('Keine automatische Versendung');
    expect(source).toContain('Ans Büro übergeben');
  });

  it('shows attachment and external-link storage metadata prepared for local and cloud targets', () => {
    const source = pageSource();

    expect(source).toContain('storageProvider');
    expect(source).toContain('storageUrl');
    expect(source).toContain('SharePoint');
    expect(source).toContain('OneDrive');
    expect(source).toContain('Lexoffice');
  });

  it('shows general checklist runs for the inquiry with executable point statuses and notes', () => {
    const source = pageSource();

    expect(source).toContain("repository.list<ChecklistRun>('checklistRuns')");
    expect(source).toContain("repository.list<ChecklistRunLink>('checklistRunLinks')");
    expect(source).toContain("repository.list<ChecklistRunItem>('checklistRunItems')");
    expect(source).toContain('Anfrage-Checklisten');
    expect(source).toContain('createChecklistRunFromTemplate');
    expect(source).toContain("repository.list<InquiryMasterDataCategory>('inquiryMasterDataCategories')");
    expect(source).toContain("repository.list<ChecklistTemplate>('checklistTemplates')");
    expect(source).toContain('Checklisten aus Kategorie erzeugen');
    expect(source).toContain('trifft nicht zu');
    expect(source).toContain('Rückfrage nötig');
    expect(source).toContain('Notiz');
    expect(source).toContain('selectedChoice');
    expect(source).toContain("repository.upsert<ChecklistRunItem>('checklistRunItems'");
  });

  it('can manually accept material and service checklist suggestions into a linked calculation', () => {
    const source = pageSource();

    expect(source).toContain('buildChecklistSuggestionLineItem');
    expect(source).toContain("repository.list<CalculationLineItem>('calculationLineItems')");
    expect(source).toContain("repository.upsert<CalculationLineItem>('calculationLineItems'");
    expect(source).toContain('Übernehmen');
    expect(source).toContain('Übernommen');
    expect(source).toContain('Kalkulation fehlt');
  });

  it('can manually accept packing-list suggestions into a Rüstliste run item', () => {
    const source = pageSource();

    expect(source).toContain('buildChecklistSuggestionPackingItem');
    expect(source).toContain("action.actionType === 'create_packing_item'");
    expect(source).toContain("title: 'Rüstliste'");
    expect(source).toContain("repository.upsert<ChecklistRunItem>('checklistRunItems'");
    expect(source).toContain('getChecklistSuggestionPackingItemKeyForItem');
  });

  it('can manually accept task suggestions into a linked or generated workshop card', () => {
    const source = pageSource();

    expect(source).toContain('buildChecklistSuggestionWorkshopTask');
    expect(source).toContain("action.actionType === 'create_task'");
    expect(source).toContain("repository.upsert<WorkshopCard>('workshopCards'");
    expect(source).toContain("repository.upsert<WorkshopCardTask>('workshopCardTasks'");
    expect(source).toContain('WORKSHOP_CARD_LINK_LABEL_PREFIX');
    expect(source).toContain('getChecklistSuggestionWorkshopTaskKeyForTask');
  });

  it('can manually accept checklist suggestions into inquiry checklist runs', () => {
    const source = pageSource();

    expect(source).toContain("action.actionType === 'suggest_checklist'");
    expect(source).toContain('buildAcceptedChecklistSuggestionRun');
    expect(source).toContain("repository.upsert<ChecklistRun>('checklistRuns'");
    expect(source).toContain("repository.upsert<ChecklistRunLink>('checklistRunLinks'");
    expect(source).toContain('isChecklistSuggestionAccepted');
  });

  it('can manually accept billing-note suggestions into linked calculations as info rows', () => {
    const source = pageSource();

    expect(source).toContain("action.actionType === 'add_billing_note'");
    expect(source).toContain('getChecklistSuggestionLineItemKeyForItem');
    expect(source).toContain("repository.upsert<CalculationLineItem>('calculationLineItems'");
    expect(source).toContain('Abrechnungshinweis');
  });

  it('keeps the detail view price-free', () => {
    const source = pageSource();

    expect(source).toContain('Keine Preise im Anfragedetail');
    expect(source).not.toMatch(/\b(price|prices|totalPrice|hourlyRate|unitPrice|amountCents|totalCents)\b/);
    expect(source).not.toContain('€');
  });
});
