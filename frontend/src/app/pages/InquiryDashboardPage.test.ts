import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const pageSource = () => readFileSync(resolve(__dirname, 'InquiryDashboardPage.tsx'), 'utf8');
const routesSource = () => readFileSync(resolve(__dirname, '../routes.tsx'), 'utf8');
const sidebarSource = () => readFileSync(resolve(__dirname, '../components/Sidebar.tsx'), 'utf8');

describe('Inquiry dashboard contracts', () => {
  it('registers a dedicated inquiries route and sidebar entry', () => {
    expect(routesSource()).toContain("path: 'inquiries'");
    expect(sidebarSource()).toContain("path: '/inquiries'");
    expect(sidebarSource()).toContain('Anfragen');
  });

  it('uses the available dashboard width for the inquiry list without side preparation panel', () => {
    const source = pageSource();

    expect(source).toContain('DataTable');
    expect(source).toContain('Anfrage-Dashboard');
    expect(source).toContain('Anfragekategorie');
    expect(source).toContain('categoryId');
    expect(source).not.toContain('Fachliche Vorkonfiguration');
    expect(source).not.toContain('xl:grid-cols-[1fr_380px]');
    expect(source).not.toContain('<aside');
    expect(source).toContain('Stunden');
    expect(source).toContain('Mengen');
  });

  it('uses reusable autocomplete fields for manual customer, location and asset assignment', () => {
    const source = pageSource();

    expect(source).toContain('ContactAssignmentField');
    expect(source).toContain('Rechnungsempfänger suchen');
    expect(source).toContain('Standort suchen');
    expect(source).toContain('Asset suchen');
    expect(source).toContain('filterAutocompleteOptions');
    expect(source).not.toContain('<select className="w-full border rounded-lg px-3 py-2 text-sm" value={form.customerId}');
    expect(source).not.toContain('<select className="w-full border rounded-lg px-3 py-2 text-sm" value={form.locationId}');
    expect(source).not.toContain('<select className="w-full border rounded-lg px-3 py-2 text-sm" value={form.assetId}');
  });

  it('separates Rechnungsempfänger, Standort and Assets into their own manual inquiry sections', () => {
    const source = pageSource();

    expect(source).toContain('aria-label="Rechnungsempfänger Abschnitt"');
    expect(source).toContain('aria-label="Standort Abschnitt"');
    expect(source).toContain('aria-label="Assets Abschnitt"');
    expect(source).toContain('Rechnungsempfänger & Ansprechpartner');
    expect(source).toContain('Standort');
    expect(source).toContain('Assets');
    expect(source).toContain('className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3"');
    expect(source).toContain('className="rounded-xl border border-violet-200 bg-violet-50 p-2"');
    expect(source).toContain('className="space-y-2 rounded-xl border border-sky-200 bg-sky-50 p-3"');

    expect(source.indexOf('Rechnungsempfänger & Ansprechpartner')).toBeLessThan(source.indexOf('Assets</p>'));
    expect(source.indexOf('Assets</p>')).toBeLessThan(source.indexOf('aria-label="Optionale Zuordnungen"'));
    expect(source.indexOf('>Standort</span>')).toBeGreaterThan(source.indexOf('aria-label="Optionale Zuordnungen"'));
    expect(source.indexOf('>Standort</span>')).toBeLessThan(source.indexOf('Vermittler / Provisionsempfänger'));
    expect(source.indexOf('Rechnungsempfänger & Ansprechpartner')).toBeGreaterThan(source.indexOf('placeholder="Titel der Anfrage"'));
  });

  it('allows Rechnungsempfänger Ansprechpartner search without a preselected company and warns when the relation is missing', () => {
    const source = pageSource();

    expect(source).toContain('customerContactPersonId');
    expect(source).toContain('const manualCustomerContactOptions = useMemo');
    expect(source).toContain('contactPersons.map((person) => ({ id: person.id, label: formatContactPersonName(person) }))');
    expect(source).toContain('label="Ansprechpartner Rechnungsempfänger"');
    expect(source).toContain("placeholder=\"Ansprechpartner suchen\"");
    expect(source).toContain('options={manualCustomerContactOptions}');
    expect(source).toContain('updateManualCustomerContactPerson');
    expect(source).toContain('customerContactRelationWarning');
    expect(source).toContain('Verknüpfung erstellen');
    expect(source).not.toContain('disabled={!form.customerId}');
    expect(source).toContain('setForm({ ...form, customerId, customerContactPersonId, locationId, assetIds });');
  });

  it('allows selecting and re-opening multiple Assets for office/calculation handover instead of a single asset only', () => {
    const source = pageSource();

    expect(source).toContain('assetIds: string[];');
    expect(source).toContain('addManualAsset');
    expect(source).toContain('removeManualAsset');
    expect(source).toContain('selectedManualAssets');
    expect(source).toContain('Ausgewählte Assets');
    expect(source).toContain('Asset hinzufügen');
    expect(source).toContain('form.assetIds.map');
    expect(source).toContain("repository.list<InquiryScopeItem>('inquiryScopeItems')");
    expect(source).toContain('resolveInquiryAssetIds(inquiry, inquiryScopeItems)');
    expect(source).toContain('syncInquiryAssetScopeItems');
    expect(source).toContain("repository.upsert<InquiryScopeItem>('inquiryScopeItems'");
    expect(source).toContain("repository.delete('inquiryScopeItems'");
    expect(source).toContain("buildInquiryScopeAssetSection(asset, { now, id: newId('scope-asset'), inquiryId })");
    expect(source).toContain('assignInquiryScopeNumbers');
    expect(source).toContain('assetId: form.assetIds[0] || null');
    expect(source).not.toContain('value={form.assetId}');
  });

  it('writes an asset history entry when an inquiry is linked to a new asset', () => {
    const source = pageSource();

    expect(source).toContain("repository.list<AssetHistoryEntry>('assetHistoryEntries')");
    expect(source).toContain('buildInquiryAssetLinkedHistoryEntry');
    expect(source).toContain("title: `Mit Anfrage ${inquiryLabel} verknüpft`");
    expect(source).toContain("source: 'inquiry'");
    expect(source).toContain("repository.create<AssetHistoryEntry>('assetHistoryEntries'");
    expect(source).toContain("dispatch({ type: 'ADD_ENTITY', entity: 'assetHistoryEntries'");
    expect(source).toContain('!previouslyLinkedAssetIds.has(asset.id)');
  });

  it('places the inquiry text field directly below Assets with the same left-column width and at least five rows', () => {
    const source = pageSource();

    expect(source.indexOf('aria-label="Assets Abschnitt"')).toBeLessThan(source.indexOf('aria-label="Anfragetext Abschnitt"'));
    expect(source.indexOf('aria-label="Anfragetext Abschnitt"')).toBeLessThan(source.indexOf('aria-label="Optionale Zuordnungen"'));
    expect(source).toContain('rows={5}');
    expect(source).toContain('min-h-40');
    expect(source).toContain('Anfragetext, Arbeiten, Stunden, Mengen, technische Hinweise');
  });

  it('assigns and shows an Anfrage-Nr from the inquiries number circle', () => {
    const source = pageSource();

    expect(source).toContain('INQUIRY_NUMBER_CIRCLE_KEY');
    expect(source).toContain("reserveNumberCircle(INQUIRY_NUMBER_CIRCLE_KEY)");
    expect(source).toContain('inquiryNumber');
    expect(source).toContain("header: 'Nr.'");
    expect(source).toContain("defaultVisibleKeys: ['inquiryNumber'");
  });

  it('keeps manual inquiry creation behind a compact modal trigger', () => {
    const source = pageSource();

    expect(source).toContain('isManualModalOpen');
    expect(source).toContain('Neue Anfrage');
    expect(source).toContain('role="dialog"');
    expect(source).toContain('aria-modal="true"');
    expect(source).toContain('onClick={openNewInquiryModal}');
    expect(source).toContain('closeManualModal');
    expect(source).not.toContain('<section className="bg-white border rounded-xl p-4">\n            <h2 className="font-semibold flex items-center gap-2"><UserCircle size={18} /> Manuell anlegen</h2>');
  });

  it('allows editing existing inquiries from the table with the same prefilled modal', () => {
    const source = pageSource();

    expect(source).toContain('editingInquiryId');
    expect(source).toContain('formFromInquiry');
    expect(source).toContain('openEditInquiryModal');
    expect(source).toContain('Bearbeiten');
    expect(source).toContain('Anfrage bearbeiten');
    expect(source).toContain('Änderungen speichern');
    expect(source).toContain("repository.update<Inquiry>('inquiries'");
    expect(source).toContain("dispatch({ type: existingInquiry ? 'UPDATE_ENTITY' : 'ADD_ENTITY', entity: 'inquiries'");
    expect(source).toContain('editInquiryIdFromUrl');
  });

  it('lets users change the inquiry status while editing and maps Vale workflow labels', () => {
    const source = pageSource();

    expect(source).toContain('status: InquiryStatus;');
    expect(source).toContain('status: inquiry.status');
    expect(source).toContain("status: form.status");
    expect(source).toContain('aria-label="Status"');
    expect(source).toContain("getSelectOptionsForList(selectOptions, 'inquiry.status')");
    expect(source).toContain('inquiryStatusOptions.map');
    expect(source).toContain("getSelectOptionsForList(selectOptions, 'inquiry.category')");
    expect(source).toContain('inquiryCategoryOptions.map');
    expect(source).toContain('Warten auf Rückmeldung');
    expect(source).toContain('Erledigt');
    expect(source).toContain('Abgelehnt');
    expect(source).toContain("inquiry.needsAttention = shouldInquiryNeedAttention(inquiry);");
  });

  it('uses a 90 percent wide modal with primary assignments left and Standort above Vermittler right', () => {
    const source = pageSource();

    expect(source).toContain('className="w-[90vw] max-w-[90vw] rounded-2xl bg-white p-5 shadow-2xl"');
    expect(source).toContain('className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.8fr)]"');
    expect(source).toContain('className="grid gap-3 md:grid-cols-[minmax(0,1fr)_260px]"');
    expect(source.indexOf('placeholder="Titel der Anfrage"')).toBeLessThan(source.indexOf('Anfragekategorie wählen'));
    expect(source.indexOf('placeholder="Titel der Anfrage"')).toBeLessThan(source.indexOf('Rechnungsempfänger zuordnen'));
    expect(source.indexOf('Rechnungsempfänger zuordnen')).toBeLessThan(source.indexOf('Asset zuordnen'));
    expect(source.indexOf('Asset zuordnen')).toBeLessThan(source.indexOf('aria-label="Optionale Zuordnungen"'));
    expect(source.indexOf('Standort zuordnen')).toBeGreaterThan(source.indexOf('aria-label="Optionale Zuordnungen"'));
    expect(source.indexOf('Standort zuordnen')).toBeLessThan(source.indexOf('Vermittler / Provisionsempfänger'));
    expect(source.indexOf('Betreiber zuordnen')).toBeGreaterThan(source.indexOf('Vermittler / Provisionsempfänger'));
    expect(source).toContain('aria-label="Optionale Zuordnungen"');
    expect(source).toContain('className="rounded-xl border border-violet-200 bg-violet-50 p-2"');
    expect(source).toContain('className="rounded-xl border border-dashed border-blue-100 bg-blue-50/40 p-2"');
    expect(source).toContain('className="rounded-xl border border-amber-200 bg-amber-50 p-2"');
    const mediatorCard = source.slice(
      source.indexOf('className="rounded-xl border border-dashed border-blue-100 bg-blue-50/40 p-2"'),
      source.indexOf('className="rounded-xl border border-amber-200 bg-amber-50 p-2"'),
    );
    expect(mediatorCard).not.toContain('Betreiber zuordnen');
    expect(source).toContain('Betreiber optional');
    expect(source).toContain('Provision</span>');
  });

  it('keeps Standort, Vermittler and Betreiber as one-line checkbox sections until activated', () => {
    const source = pageSource();

    expect(source).toContain('optionalPanels');
    expect(source).toContain('toggleLocationPanel');
    expect(source).toContain('toggleResponsiblePanel');
    expect(source).toContain('toggleSiteCustomerPanel');
    expect(source).toContain('checked={optionalPanels.location}');
    expect(source).toContain('checked={optionalPanels.responsible}');
    expect(source).toContain('checked={optionalPanels.siteCustomer}');
    expect(source).toContain('{optionalPanels.location && (');
    expect(source).toContain('{optionalPanels.responsible && (');
    expect(source).toContain('{optionalPanels.siteCustomer && (');
    expect(source).toContain("setForm({ ...form, locationId: '' });");
    expect(source).toContain("responsibleCustomerId: '', responsibleContactPersonId: '', commissionRelevant: false");
    expect(source).toContain("siteCustomerId: '', locationId, assetIds");
  });

  it('uses universal contact assignment components instead of local Vermittler-only create blocks', () => {
    const source = pageSource();

    expect(source).toContain('ContactCreateModal');
    expect(source).toContain('ContactAssignmentField');
    expect(source).toContain('contactCreateContext');
    expect(source).toContain('handleContactCreated');
    expect(source).toContain('onCreateNew');
    expect(source).toContain("setContactCreateContext('invoiceRecipient')");
    expect(source).toContain("setContactCreateContext('operator')");
    expect(source).toContain("setContactCreateContext('mediator')");
    expect(source).toContain("setContactCreateContext('contactPerson')");
    expect(source).not.toContain('MediatorCreateMode');
    expect(source).not.toContain('Firma + Ansprechpartner neu anlegen');
  });

  it('does not auto-fill the optional Betreiber when Rechnungsempfänger changes', () => {
    const source = pageSource();

    expect(source).toContain('const effectiveLocationCustomerId = form.siteCustomerId || customerId');
    expect(source).toContain('setForm({ ...form, customerId, customerContactPersonId, locationId, assetIds });');
    expect(source).not.toContain('nextSiteCustomerId = form.siteCustomerId && form.siteCustomerId !== form.customerId ? form.siteCustomerId : customerId');
    expect(source).not.toContain('setForm({ ...form, customerId, siteCustomerId:');
  });

  it('uses database-compatible UUIDs for persisted manual inquiries', () => {
    const source = pageSource();

    expect(source).toContain('function newId(_prefix: string)');
    expect(source).toContain('crypto.randomUUID()');
    expect(source).not.toContain('return `${prefix}-');
  });

  it('labels customer roles as Rechnungsempfänger, Betreiber and Vermittler separately in manual inquiry assignment', () => {
    const source = pageSource();

    expect(source).toContain('siteCustomerId');
    expect(source).toContain('responsibleCustomerId');
    expect(source).toContain('responsibleContactPersonId');
    expect(source).toContain('commissionRelevant');
    expect(source).toContain('Rechnungsempfänger zuordnen');
    expect(source).toContain('Betreiber zuordnen');
    expect(source).toContain('Vermittler / Provisionsempfänger');
    expect(source).toContain('Provision</span>');
    expect(source).toContain("repository.list<ContactPerson>('contactPersons')");
    expect(source).not.toContain('Auftraggeber');
    expect(source).not.toContain('Standortkunde');
  });

  it('captures order-specific switching action clarification below Betreiber assignment', () => {
    const source = pageSource();

    expect(source).toContain('aria-label="Auftragsspezifisch Abschnitt"');
    expect(source).toContain('Auftragsspezifisch');
    expect(source).toContain('Schalthandlung erforderlich?');
    expect(source).toContain('Schalthandlung wird durch Bauseits ausgeführt');
    expect(source).toContain('switchingActionRequired');
    expect(source).toContain('switchingActionByCustomer');
    expect(source).toContain('switchingActionContactPersonId');
    expect(source).toContain('setContactCreateContext(\'switchingContactPerson\')');
    expect(source).toContain('Schalthandlung ist noch zu klären');
    expect(source).toContain('Ausführung der Schalthandlung ist noch zu klären');
    expect(source).toContain('Ausführung möglich:');
    expect(source).toContain('executionPossibleWeekdays');
    expect(source).toContain('In der Woche');
    expect(source).toContain('Freitag Nachmittags');
    expect(source).toContain('Samstag');
    expect(source).toContain('Sonntag');
    expect(source).toContain('In der Woche nach Feierabend');
    expect(source).toContain('Nur während geplanter Abschaltung');
    expect(source).toContain('executionInfo');
    expect(source).toContain('Info:');
    expect(source).toContain('rows={2}');
    expect(source.indexOf('Auftragsspezifisch')).toBeGreaterThan(source.indexOf('Betreiber zuordnen'));
  });

  it('lets the optional Vermittler / Provisionsempfänger be selected or created from customer and contact master data', () => {
    const source = pageSource();

    expect(source).toContain('Vermittler / Provisionsempfänger');
    expect(source).toContain('Vermittler optional');
    expect(source).toContain("repository.list<CustomerContactPerson>('customerContactPersons')");
    expect(source).toContain('buildMediatorAssignmentOptions(customers, contactPersons, customerContactPersons)');
    expect(source).toContain('customerContact');
    expect(source).toContain('Firma mit Ansprechpartner');
    expect(source).toContain("setContactCreateContext('mediator')");
    expect(source).toContain('handleContactCreated');
    expect(source).toContain('commissionRelevant: true');
    expect(source).toContain('ContactCreateModal');
  });

  it('filters manual Standort suggestions by the selected Betreiber or Rechnungsempfänger assignment', () => {
    const source = pageSource();

    expect(source).toContain("repository.list<LocationCustomer>('locationCustomers')");
    expect(source).toContain('const manualLocationCustomerId = form.siteCustomerId || form.customerId');
    expect(source).toContain('filterLocationsForCustomer(locations, locationCustomers, manualLocationCustomerId || null)');
    expect(source).toContain('resolveLocationForCustomerChange(effectiveLocationCustomerId || null, form.locationId || null, locationCustomers)');
    expect(source).toContain('resolveLocationForCustomerChange(siteCustomerId || null, form.locationId || null, locationCustomers)');
    expect(source).toContain('options={filteredManualLocations.map((location) => ({ id: location.id, label: buildLocationAssignmentLabel(location, customers, locationCustomers), type: \'location\' }))}');
    expect(source).toContain("placeholder={manualLocationCustomerId ? 'Standort suchen' : 'Erst Rechnungsempfänger oder Betreiber wählen'}");
    expect(source).toContain('disabled={!manualLocationCustomerId}');
    expect(source).toContain('disabled?: boolean');
    expect(source).toContain('aria-disabled={disabled}');
    expect(source.indexOf('Standort Abschnitt')).toBeGreaterThan(source.indexOf('aria-label="Optionale Zuordnungen"'));
    expect(source.indexOf('Standort Abschnitt')).toBeLessThan(source.indexOf('Vermittler / Provisionsempfänger'));
  });

  it('does not render inquiry preparation building blocks on the dashboard', () => {
    const source = pageSource();

    expect(source).not.toContain('HWERP-Bausteine');
    expect(source).not.toContain('Asset übernehmen');
    expect(source).not.toContain('Leistung hinzufügen');
    expect(source).not.toContain('Material hinzufügen');
    expect(source).not.toContain('Hinweistext hinzufügen');
    expect(source).not.toContain('Ans Büro übergeben');
  });

  it('keeps the inquiry module explicitly price-free', () => {
    const source = pageSource();

    expect(source).toContain('Keine Preise im Anfragemodul');
    expect(source).not.toMatch(/\b(price|prices|totalPrice|hourlyRate|unitPrice|amountCents|totalCents)\b/);
    expect(source).not.toContain('€');
  });
});
