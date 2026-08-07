import { FormEvent, ReactNode, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { AlertTriangle, CheckCircle2, ClipboardList, Inbox, Mail, UserCircle } from 'lucide-react';
import { useAppStore } from '../context/AppStoreContext';
import type { AssetHistoryEntry, AssetNode, ContactPerson, Customer, CustomerContactPerson, Inquiry, InquiryDecision, InquiryMasterDataCategory, InquiryPriority, InquiryScopeItem, InquiryStatus, Location, LocationCustomer } from '../lib/types';
import { getInquiryNextAction, getInquirySourceLabel, hasInquiryNeedsAttention, shouldInquiryNeedAttention } from '../lib/inquiryUtils';
import { getSelectOptionLabel, getSelectOptionsForList, type SelectOption } from '../lib/selectOptions';
import { filterLocationsForCustomer, resolveLocationForCustomerChange } from '../lib/assetAssignmentUtils';
import { assignInquiryScopeNumbers, buildInquiryScopeAssetSection } from '../lib/inquiryScopeUtils';
import { buildMissingCustomerContactLinkWarning, isContactLinkedToCustomer, resolvePrimaryCustomerForContact } from '../lib/contactAssignmentUtils';
import { DataTable, DataTableColumn } from '../components/ui/DataTable';
import { ContactAssignmentField } from '../components/contact-assignment/ContactAssignmentField';
import { ContactCreateModal } from '../components/contact-assignment/ContactCreateModal';
import type { ContactCreateContext, ContactCreateResult } from '../components/contact-assignment/ContactCreateModal';
import { INQUIRY_NUMBER_CIRCLE_KEY, reserveNumberCircle } from '../lib/numberCircles';

const statusLabels: Record<InquiryStatus, string> = {
  new: 'Neu',
  triage: 'In Sichtung',
  waiting_for_customer: 'Warten auf Rückmeldung',
  ready_for_calculation: 'Bereit fürs Büro',
  calculation_draft: 'Kalkulationsentwurf',
  offer_draft: 'Antwortentwurf',
  sent: 'Versendet',
  done: 'Erledigt',
  won: 'Gewonnen',
  lost: 'Abgelehnt',
  archived: 'Archiviert',
};

const editableInquiryStatuses: InquiryStatus[] = [
  'new',
  'triage',
  'waiting_for_customer',
  'ready_for_calculation',
  'done',
  'lost',
  'archived',
];

const priorityLabels: Record<InquiryPriority, string> = {
  low: 'Niedrig',
  normal: 'Normal',
  high: 'Hoch',
  urgent: 'Dringend',
};

interface ManualInquiryForm {
  title: string;
  status: InquiryStatus;
  senderName: string;
  senderEmail: string;
  categoryId: string;
  customerId: string;
  customerContactPersonId: string;
  siteCustomerId: string;
  locationId: string;
  assetIds: string[];
  responsibleCustomerId: string;
  responsibleContactPersonId: string;
  commissionRelevant: boolean;
  switchingActionRequired: InquiryDecision;
  switchingActionByCustomer: InquiryDecision;
  switchingActionContactPersonId: string;
  executionPossibleWeekdays: boolean;
  executionPossibleFridayAfternoon: boolean;
  executionPossibleSaturday: boolean;
  executionPossibleSunday: boolean;
  executionPossibleAfterHours: boolean;
  executionPossiblePlannedShutdownOnly: boolean;
  executionInfo: string;
  rawText: string;
}

const emptyForm: ManualInquiryForm = {
  title: '',
  status: 'new',
  senderName: '',
  senderEmail: '',
  categoryId: '',
  customerId: '',
  customerContactPersonId: '',
  siteCustomerId: '',
  locationId: '',
  assetIds: [],
  responsibleCustomerId: '',
  responsibleContactPersonId: '',
  commissionRelevant: false,
  switchingActionRequired: 'unknown',
  switchingActionByCustomer: 'unknown',
  switchingActionContactPersonId: '',
  executionPossibleWeekdays: false,
  executionPossibleFridayAfternoon: false,
  executionPossibleSaturday: false,
  executionPossibleSunday: false,
  executionPossibleAfterHours: false,
  executionPossiblePlannedShutdownOnly: false,
  executionInfo: '',
  rawText: '',
};

interface OptionalPanelState {
  location: boolean;
  responsible: boolean;
  siteCustomer: boolean;
}

const emptyOptionalPanels: OptionalPanelState = {
  location: false,
  responsible: false,
  siteCustomer: false,
};

function optionalPanelsFromForm(form: ManualInquiryForm): OptionalPanelState {
  return {
    location: Boolean(form.locationId),
    responsible: Boolean(form.responsibleCustomerId || form.responsibleContactPersonId || form.commissionRelevant),
    siteCustomer: Boolean(form.siteCustomerId),
  };
}

function normalizeInquiryDecision(value: string | null | undefined): InquiryDecision {
  return value === 'yes' || value === 'no' || value === 'unknown' ? value : 'unknown';
}

function resolveInquiryAssetIds(inquiry: Inquiry, inquiryScopeItems: InquiryScopeItem[] = []): string[] {
  const scopeAssetIds = inquiryScopeItems
    .filter((item) => item.inquiryId === inquiry.id && item.kind === 'asset_section' && item.assetId)
    .sort((left, right) => Number(left.positionNumber ?? 9999) - Number(right.positionNumber ?? 9999) || left.createdAt.localeCompare(right.createdAt))
    .map((item) => item.assetId)
    .filter((assetId): assetId is string => Boolean(assetId));
  const assetIds = scopeAssetIds.length > 0 ? scopeAssetIds : inquiry.assetId ? [inquiry.assetId] : [];
  return Array.from(new Set(assetIds));
}

function formFromInquiry(inquiry: Inquiry, inquiryScopeItems: InquiryScopeItem[] = []): ManualInquiryForm {
  return {
    title: inquiry.title,
    status: inquiry.status,
    senderName: inquiry.senderName ?? '',
    senderEmail: inquiry.senderEmail ?? '',
    categoryId: inquiry.categoryId ?? '',
    customerId: inquiry.customerId ?? '',
    customerContactPersonId: inquiry.customerContactPersonId ?? '',
    siteCustomerId: inquiry.siteCustomerId ?? '',
    locationId: inquiry.locationId ?? '',
    assetIds: resolveInquiryAssetIds(inquiry, inquiryScopeItems),
    responsibleCustomerId: inquiry.responsibleCustomerId ?? '',
    responsibleContactPersonId: inquiry.responsibleContactPersonId ?? '',
    commissionRelevant: Boolean(inquiry.commissionRelevant),
    switchingActionRequired: normalizeInquiryDecision(inquiry.switchingActionRequired),
    switchingActionByCustomer: normalizeInquiryDecision(inquiry.switchingActionByCustomer),
    switchingActionContactPersonId: inquiry.switchingActionContactPersonId ?? '',
    executionPossibleWeekdays: Boolean(inquiry.executionPossibleWeekdays),
    executionPossibleFridayAfternoon: Boolean(inquiry.executionPossibleFridayAfternoon),
    executionPossibleSaturday: Boolean(inquiry.executionPossibleSaturday),
    executionPossibleSunday: Boolean(inquiry.executionPossibleSunday),
    executionPossibleAfterHours: Boolean(inquiry.executionPossibleAfterHours),
    executionPossiblePlannedShutdownOnly: Boolean(inquiry.executionPossiblePlannedShutdownOnly),
    executionInfo: inquiry.executionInfo ?? '',
    rawText: inquiry.rawText ?? inquiry.summary ?? '',
  };
}

function newId(_prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  const randomHex = (length: number) => Array.from({ length }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  return `${randomHex(8)}-${randomHex(4)}-4${randomHex(3)}-${(8 + Math.floor(Math.random() * 4)).toString(16)}${randomHex(3)}-${randomHex(12)}`;
}

interface AutocompleteOption {
  id: string;
  label: string;
}

function filterAutocompleteOptions(options: AutocompleteOption[], query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return options.slice(0, 10);
  return options
    .filter((option) => option.label.toLowerCase().includes(normalizedQuery))
    .slice(0, 10);
}

function buildInquiryAssetLinkedHistoryEntry(asset: AssetNode, inquiry: Inquiry, now: string): AssetHistoryEntry {
  const inquiryLabel = inquiry.inquiryNumber || inquiry.title;
  return {
    id: newId('asset-history'),
    assetId: asset.id,
    eventType: 'assignment',
    occurredAt: now,
    userName: 'Anfrage-Dashboard',
    title: `Mit Anfrage ${inquiryLabel} verknüpft`,
    description: `Asset „${asset.name}“ wurde mit Anfrage „${inquiry.title}“ verknüpft.`,
    metadata: {
      source: 'inquiry',
      inquiryId: inquiry.id,
      inquiryNumber: inquiry.inquiryNumber || null,
      inquiryTitle: inquiry.title,
      assetName: asset.name,
    },
    createdAt: now,
    updatedAt: now,
  };
}

export default function InquiryDashboardPage() {
  const { state, dispatch, repository } = useAppStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const editInquiryIdFromUrl = searchParams.get('edit');
  const [searchQuery, setSearchQuery] = useState('');
  const [form, setForm] = useState<ManualInquiryForm>(emptyForm);
  const [editingInquiryId, setEditingInquiryId] = useState<string | null>(null);
  const [contactCreateContext, setContactCreateContext] = useState<ContactCreateContext | null>(null);
  const [assetPickerId, setAssetPickerId] = useState('');
  const [assetCreateName, setAssetCreateName] = useState('');
  const [optionalPanels, setOptionalPanels] = useState<OptionalPanelState>(emptyOptionalPanels);
  const [isManualModalOpen, setManualModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const [inquiries, categories, customers, locations, locationCustomers, customerContactPersons, contactPersons, assets, inquiryScopeItems, assetHistoryEntries, selectOptions] = await Promise.all([
          repository.list<Inquiry>('inquiries'),
          repository.list<InquiryMasterDataCategory>('inquiryMasterDataCategories'),
          repository.list<Customer>('customers'),
          repository.list<Location>('locations'),
          repository.list<LocationCustomer>('locationCustomers'),
          repository.list<CustomerContactPerson>('customerContactPersons'),
          repository.list<ContactPerson>('contactPersons'),
          repository.list<AssetNode>('assets'),
          repository.list<InquiryScopeItem>('inquiryScopeItems'),
          repository.list<AssetHistoryEntry>('assetHistoryEntries'),
          repository.list<SelectOption>('selectOptions'),
        ]);
        dispatch({ type: 'SET_ENTITIES', entity: 'inquiries', data: inquiries });
        dispatch({ type: 'SET_ENTITIES', entity: 'inquiryMasterDataCategories', data: categories });
        dispatch({ type: 'SET_ENTITIES', entity: 'customers', data: customers });
        dispatch({ type: 'SET_ENTITIES', entity: 'locations', data: locations });
        dispatch({ type: 'SET_ENTITIES', entity: 'locationCustomers', data: locationCustomers });
        dispatch({ type: 'SET_ENTITIES', entity: 'customerContactPersons', data: customerContactPersons });
        dispatch({ type: 'SET_ENTITIES', entity: 'contactPersons', data: contactPersons });
        dispatch({ type: 'SET_ENTITIES', entity: 'assets', data: assets });
        dispatch({ type: 'SET_ENTITIES', entity: 'inquiryScopeItems', data: inquiryScopeItems });
        dispatch({ type: 'SET_ENTITIES', entity: 'assetHistoryEntries', data: assetHistoryEntries });
        dispatch({ type: 'SET_ENTITIES', entity: 'selectOptions', data: selectOptions });
      } catch (error) {
        console.error('Fehler beim Laden der Anfragen:', error);
        setLoadError(true);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [repository, dispatch]);

  const inquiries = (state.inquiries as Inquiry[]) || [];
  const categories = (state.inquiryMasterDataCategories as InquiryMasterDataCategory[]) || [];
  const customers = (state.customers as Customer[]) || [];
  const locations = (state.locations as Location[]) || [];
  const locationCustomers = (state.locationCustomers as LocationCustomer[]) || [];
  const customerContactPersons = (state.customerContactPersons as CustomerContactPerson[]) || [];
  const contactPersons = (state.contactPersons as ContactPerson[]) || [];
  const assets = (state.assets as AssetNode[]) || [];
  const inquiryScopeItems = (state.inquiryScopeItems as InquiryScopeItem[]) || [];
  const assetHistoryEntries = (state.assetHistoryEntries as AssetHistoryEntry[]) || [];
  const selectOptions = (state.selectOptions as SelectOption[]) || [];

  const inquiryStatusOptions = useMemo(
    () => getSelectOptionsForList(selectOptions, 'inquiry.status')
      .filter((option) => editableInquiryStatuses.includes(option.value as InquiryStatus))
      .map((option) => ({ value: option.value as InquiryStatus, label: option.label })),
    [selectOptions],
  );
  const inquiryCategoryOptions = useMemo(
    () => getSelectOptionsForList(selectOptions, 'inquiry.category')
      .filter((option) => categories.some((category) => category.id === option.value && category.active)),
    [selectOptions, categories],
  );

  const activeCategories = useMemo(
    () => categories
      .filter((category) => category.active)
      .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name, 'de')),
    [categories],
  );

  const manualLocationCustomerId = form.siteCustomerId || form.customerId;

  const filteredManualLocations = useMemo(
    () => filterLocationsForCustomer(locations, locationCustomers, manualLocationCustomerId || null),
    [locations, locationCustomers, manualLocationCustomerId],
  );
  const filteredManualAssets = useMemo(
    () => assets.filter((asset) => {
      if (form.assetIds.includes(asset.id)) return false;
      if (form.locationId) return asset.locationId === form.locationId;
      if (manualLocationCustomerId) return asset.customerId === manualLocationCustomerId;
      return true;
    }),
    [assets, form.assetIds, manualLocationCustomerId, form.locationId],
  );
  const selectedManualAssets = useMemo(
    () => form.assetIds
      .map((assetId) => assets.find((asset) => asset.id === assetId))
      .filter((asset): asset is AssetNode => Boolean(asset)),
    [assets, form.assetIds],
  );
  const manualCustomerContactOptions = useMemo(
    () => contactPersons.map((person) => ({ id: person.id, label: formatContactPersonName(person) })),
    [contactPersons],
  );
  const switchingContactOptions = manualCustomerContactOptions;
  const switchingActionByCustomerEnabled = form.switchingActionRequired === 'yes';
  const switchingClarificationWarning = form.switchingActionRequired === 'unknown'
    ? 'Schalthandlung ist noch zu klären.'
    : form.switchingActionRequired === 'yes' && form.switchingActionByCustomer !== 'yes'
      ? 'Ausführung der Schalthandlung ist noch zu klären.'
      : null;
  const customerContactRelationWarning = buildMissingCustomerContactLinkWarning({
    customerId: form.customerId,
    contactPersonId: form.customerContactPersonId,
    customerContactPersons,
  });

  const responsibleAssignmentValue = form.responsibleCustomerId && form.responsibleContactPersonId
    ? `customerContact:${form.responsibleCustomerId}:${form.responsibleContactPersonId}`
    : form.responsibleContactPersonId
      ? `contact:${form.responsibleContactPersonId}`
      : form.responsibleCustomerId
        ? `customer:${form.responsibleCustomerId}`
        : '';
  const responsibleOptions = useMemo(
    () => buildMediatorAssignmentOptions(customers, contactPersons, customerContactPersons),
    [customers, contactPersons, customerContactPersons],
  );

  const getCategoryName = (id: string | null | undefined) => getSelectOptionLabel(selectOptions, 'inquiry.category', id) || (id ? categories.find((category) => category.id === id)?.name ?? null : null);
  const getCustomerName = (id: string | null | undefined) => id ? customers.find((customer) => customer.id === id)?.name ?? null : null;
  const getContactPersonName = (id: string | null | undefined) => id ? contactPersons.find((person) => person.id === id) ? formatContactPersonName(contactPersons.find((person) => person.id === id)!) : null : null;
  const getResponsibleName = (item: Inquiry) => {
    const contactName = getContactPersonName(item.responsibleContactPersonId);
    const customerName = getCustomerName(item.responsibleCustomerId);
    if (contactName && customerName) return `${contactName} · ${customerName}`;
    return contactName || customerName;
  };

  const filteredRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const rows = query
      ? inquiries.filter((item) => [
          item.title,
          item.inquiryNumber,
          item.senderName,
          item.senderEmail,
          getCategoryName(item.categoryId),
          getCustomerName(item.customerId),
          getCustomerName(item.siteCustomerId),
          getResponsibleName(item),
          item.summary,
          item.rawText,
        ].some((value) => value?.toLowerCase().includes(query)))
      : inquiries;

    return [...rows].sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime());
  }, [inquiries, searchQuery, customers, contactPersons, categories]);

  const stats = useMemo(() => ({
    open: inquiries.filter((item) => !['done', 'won', 'lost', 'archived'].includes(item.status)).length,
    attention: inquiries.filter(hasInquiryNeedsAttention).length,
    ready: inquiries.filter((item) => item.status === 'ready_for_calculation').length,
    mail: inquiries.filter((item) => item.source === 'email').length,
  }), [inquiries]);

  const openNewInquiryModal = () => {
    setEditingInquiryId(null);
    setForm(emptyForm);
    setAssetPickerId('');
    setAssetCreateName('');
    setOptionalPanels(emptyOptionalPanels);
    setManualModalOpen(true);
    if (editInquiryIdFromUrl) setSearchParams({});
  };

  const openEditInquiryModal = (inquiry: Inquiry) => {
    setEditingInquiryId(inquiry.id);
    const nextForm = formFromInquiry(inquiry, inquiryScopeItems);
    setForm(nextForm);
    setOptionalPanels(optionalPanelsFromForm(nextForm));
    setAssetPickerId('');
    setAssetCreateName('');
    setManualModalOpen(true);
  };

  const closeManualModal = () => {
    setForm(emptyForm);
    setEditingInquiryId(null);
    setAssetPickerId('');
    setAssetCreateName('');
    setOptionalPanels(emptyOptionalPanels);
    setManualModalOpen(false);
    if (editInquiryIdFromUrl) setSearchParams({});
  };

  useEffect(() => {
    if (!editInquiryIdFromUrl || isLoading) return;
    if (editingInquiryId === editInquiryIdFromUrl && isManualModalOpen) return;
    const inquiry = inquiries.find((item) => item.id === editInquiryIdFromUrl);
    if (inquiry) openEditInquiryModal(inquiry);
  }, [editInquiryIdFromUrl, isLoading, inquiries, editingInquiryId, isManualModalOpen]);

  const columns: DataTableColumn<Inquiry>[] = [
    {
      key: 'inquiryNumber',
      header: 'Nr.',
      width: 130,
      sortable: true,
      render: (item) => item.inquiryNumber || <span className="text-gray-400">—</span>,
    },
    {
      key: 'title',
      header: 'Anfrage',
      sortable: true,
      render: (item) => (
        <div>
          <p className="font-medium text-gray-900">{item.title}</p>
          <p className="text-xs text-gray-500">{item.senderName || item.senderEmail || 'Ohne Absender'}</p>
          <div className="mt-1 flex flex-wrap gap-2">
            <Link to={`/inquiries/${item.id}`} className="text-xs font-medium text-blue-700 hover:text-blue-900">Details öffnen</Link>
            <button type="button" onClick={() => openEditInquiryModal(item)} className="text-xs font-medium text-orange-700 hover:text-orange-900">Bearbeiten</button>
          </div>
        </div>
      ),
    },
    {
      key: 'source',
      header: 'Quelle',
      width: 110,
      render: (item) => <span className="text-sm">{getInquirySourceLabel(item.source)}</span>,
    },
    {
      key: 'category',
      header: 'Kategorie',
      width: 150,
      render: (item) => getCategoryName(item.categoryId) || <span className="text-gray-400">—</span>,
    },
    {
      key: 'customer',
      header: 'Rechnungsempfänger',
      width: 170,
      render: (item) => getCustomerName(item.customerId) || <span className="text-gray-400">—</span>,
    },
    {
      key: 'siteCustomer',
      header: 'Betreiber',
      width: 170,
      render: (item) => getCustomerName(item.siteCustomerId) || <span className="text-gray-400">—</span>,
    },
    {
      key: 'responsible',
      header: 'Vermittler',
      width: 170,
      render: (item) => getResponsibleName(item) || <span className="text-gray-400">—</span>,
    },
    {
      key: 'status',
      header: 'Status',
      width: 150,
      render: (item) => (
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${item.status === 'ready_for_calculation' ? 'bg-green-100 text-green-700' : hasInquiryNeedsAttention(item) ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600'}`}>
          {getSelectOptionLabel(selectOptions, 'inquiry.status', item.status) || statusLabels[item.status]}
        </span>
      ),
    },
    {
      key: 'priority',
      header: 'Priorität',
      width: 105,
      render: (item) => priorityLabels[item.priority],
    },
    {
      key: 'nextAction',
      header: 'Nächste Aktion',
      render: (item) => <span className="text-sm text-gray-700">{getInquiryNextAction(item)}</span>,
    },
    {
      key: 'receivedAt',
      header: 'Eingang',
      width: 120,
      sortable: true,
      render: (item) => new Date(item.receivedAt).toLocaleDateString('de-DE'),
    },
  ];

  const updateManualCustomer = (customerId: string) => {
    const effectiveLocationCustomerId = form.siteCustomerId || customerId;
    const locationId = resolveLocationForCustomerChange(effectiveLocationCustomerId || null, form.locationId || null, locationCustomers) || '';
    const customerContactPersonId = form.customerContactPersonId;
    const assetIds = form.assetIds.filter((assetId) => assets.some((asset) => asset.id === assetId && (!effectiveLocationCustomerId || asset.customerId === effectiveLocationCustomerId) && (!locationId || asset.locationId === locationId)));
    setForm({ ...form, customerId, customerContactPersonId, locationId, assetIds });
  };

  const updateManualSiteCustomer = (siteCustomerId: string) => {
    const locationId = resolveLocationForCustomerChange(siteCustomerId || null, form.locationId || null, locationCustomers) || '';
    const assetIds = form.assetIds.filter((assetId) => assets.some((asset) => asset.id === assetId && (!siteCustomerId || asset.customerId === siteCustomerId) && (!locationId || asset.locationId === locationId)));
    setForm({ ...form, siteCustomerId, locationId, assetIds });
  };

  const updateManualLocation = (locationId: string) => {
    const assetIds = form.assetIds.filter((assetId) => assets.some((asset) => asset.id === assetId && (!locationId || asset.locationId === locationId)));
    setForm({ ...form, locationId, assetIds });
  };

  const toggleLocationPanel = (enabled: boolean) => {
    setOptionalPanels({ ...optionalPanels, location: enabled });
    if (!enabled) {
      setForm({ ...form, locationId: '' });
    }
  };

  const toggleResponsiblePanel = (enabled: boolean) => {
    setOptionalPanels({ ...optionalPanels, responsible: enabled });
    if (!enabled) {
      setForm({ ...form, responsibleCustomerId: '', responsibleContactPersonId: '', commissionRelevant: false });
    }
  };

  const toggleSiteCustomerPanel = (enabled: boolean) => {
    setOptionalPanels({ ...optionalPanels, siteCustomer: enabled });
    if (!enabled) {
      const locationId = resolveLocationForCustomerChange(form.customerId || null, form.locationId || null, locationCustomers) || '';
      const assetIds = form.assetIds.filter((assetId) => assets.some((asset) => asset.id === assetId && (!form.customerId || asset.customerId === form.customerId) && (!locationId || asset.locationId === locationId)));
      setForm({ ...form, siteCustomerId: '', locationId, assetIds });
    }
  };

  const addManualAsset = () => {
    if (!assetPickerId || form.assetIds.includes(assetPickerId)) return;
    setForm({ ...form, assetIds: [...form.assetIds, assetPickerId] });
    setAssetPickerId('');
  };

  const removeManualAsset = (assetId: string) => {
    setForm({ ...form, assetIds: form.assetIds.filter((id) => id !== assetId) });
  };

  const createManualAsset = async () => {
    const name = assetCreateName.trim();
    if (!name) return;
    const now = new Date().toISOString();
    const asset: AssetNode = {
      id: newId('asset'),
      name,
      parentId: null,
      customerId: manualLocationCustomerId || null,
      locationId: form.locationId || null,
      tagIds: [],
      createdAt: now,
      updatedAt: now,
    };
    const savedAsset = await repository.create<AssetNode>('assets', asset);
    dispatch({ type: 'ADD_ENTITY', entity: 'assets', data: savedAsset });
    setForm({ ...form, assetIds: [...form.assetIds, savedAsset.id] });
    setAssetCreateName('');
  };

  const updateManualResponsible = (assignmentId: string) => {
    if (assignmentId.startsWith('customerContact:')) {
      const [, customerId, contactPersonId] = assignmentId.split(':');
      setForm({ ...form, responsibleCustomerId: customerId || '', responsibleContactPersonId: contactPersonId || '' });
      return;
    }
    if (assignmentId.startsWith('customer:')) {
      setForm({ ...form, responsibleCustomerId: assignmentId.replace('customer:', ''), responsibleContactPersonId: '' });
      return;
    }
    if (assignmentId.startsWith('contact:')) {
      setForm({ ...form, responsibleCustomerId: '', responsibleContactPersonId: assignmentId.replace('contact:', '') });
      return;
    }
    setForm({ ...form, responsibleCustomerId: '', responsibleContactPersonId: '' });
  };

  const updateManualCustomerContactPerson = (customerContactPersonId: string) => {
    const primaryCustomerId = customerContactPersonId && !form.customerId
      ? resolvePrimaryCustomerForContact(customerContactPersonId, customerContactPersons)
      : null;
    const customerId = primaryCustomerId || form.customerId;
    const effectiveLocationCustomerId = form.siteCustomerId || customerId;
    const locationId = resolveLocationForCustomerChange(effectiveLocationCustomerId || null, form.locationId || null, locationCustomers) || '';
    const assetIds = form.assetIds.filter((assetId) => assets.some((asset) => asset.id === assetId && (!effectiveLocationCustomerId || asset.customerId === effectiveLocationCustomerId) && (!locationId || asset.locationId === locationId)));
    setForm({ ...form, customerId, customerContactPersonId, locationId, assetIds });
  };

  const createMissingCustomerContactLink = async () => {
    if (!form.customerId || !form.customerContactPersonId) return;
    if (isContactLinkedToCustomer(form.customerContactPersonId, form.customerId, customerContactPersons)) return;
    const now = new Date().toISOString();
    const shouldBePrimary = !customerContactPersons.some((link) => link.contactPersonId === form.customerContactPersonId && link.isPrimary);
    const customerContactPerson: CustomerContactPerson = {
      id: newId('customer-contact'),
      customerId: form.customerId,
      contactPersonId: form.customerContactPersonId,
      isPrimary: shouldBePrimary,
      createdAt: now,
      updatedAt: now,
    };
    const savedLink = await repository.create<CustomerContactPerson>('customerContactPersons', customerContactPerson);
    dispatch({ type: 'ADD_ENTITY', entity: 'customerContactPersons', data: savedLink });
  };

  const updateSwitchingActionRequired = (switchingActionRequired: InquiryDecision) => {
    setForm({
      ...form,
      switchingActionRequired,
      switchingActionByCustomer: switchingActionRequired === 'yes' ? form.switchingActionByCustomer : 'unknown',
      switchingActionContactPersonId: switchingActionRequired === 'yes' ? form.switchingActionContactPersonId : '',
    });
  };

  const updateSwitchingActionByCustomer = (switchingActionByCustomer: InquiryDecision) => {
    setForm({
      ...form,
      switchingActionByCustomer,
      switchingActionContactPersonId: switchingActionByCustomer === 'yes' ? form.switchingActionContactPersonId : '',
    });
  };

  const handleContactCreated = (result: ContactCreateResult) => {
    if (result.context === 'invoiceRecipient') {
      setForm({
        ...form,
        customerId: result.customerId || form.customerId,
        customerContactPersonId: result.contactPersonId || form.customerContactPersonId,
      });
      return;
    }
    if (result.context === 'operator') {
      setOptionalPanels({ ...optionalPanels, siteCustomer: true });
      setForm({ ...form, siteCustomerId: result.customerId || form.siteCustomerId });
      return;
    }
    if (result.context === 'mediator') {
      setOptionalPanels({ ...optionalPanels, responsible: true });
      setForm({
        ...form,
        responsibleCustomerId: result.customerId || form.responsibleCustomerId,
        responsibleContactPersonId: result.contactPersonId || form.responsibleContactPersonId,
        commissionRelevant: true,
      });
      return;
    }
    if (result.context === 'switchingContactPerson') {
      setForm({ ...form, switchingActionContactPersonId: result.contactPersonId || form.switchingActionContactPersonId });
      return;
    }
    if (result.context === 'contactPerson') {
      const customerId = result.customerId || form.customerId || (result.contactPersonId ? resolvePrimaryCustomerForContact(result.contactPersonId, customerContactPersons) : null) || '';
      setForm({ ...form, customerId, customerContactPersonId: result.contactPersonId || form.customerContactPersonId });
    }
  };

  const reserveNextInquiryNumber = async () => {
    const reserved = await reserveNumberCircle(INQUIRY_NUMBER_CIRCLE_KEY);
    return reserved.number;
  };

  const syncInquiryAssetScopeItems = async (inquiry: Inquiry, selectedAssets: AssetNode[], now: string) => {
    const inquiryId = inquiry.id;
    const currentAssetSections = inquiryScopeItems.filter((item) => item.inquiryId === inquiryId && item.kind === 'asset_section');
    const selectedAssetIds = new Set(selectedAssets.map((asset) => asset.id));
    const previouslyLinkedAssetIds = new Set([
      ...currentAssetSections.map((section) => section.assetId).filter((assetId): assetId is string => Boolean(assetId)),
      ...(inquiry.assetId ? [inquiry.assetId] : []),
    ]);

    for (const section of currentAssetSections) {
      if (!section.assetId || !selectedAssetIds.has(section.assetId)) {
        await repository.delete('inquiryScopeItems', section.id);
        dispatch({ type: 'DELETE_ENTITY', entity: 'inquiryScopeItems', id: section.id });
      }
    }

    const numberedSections = assignInquiryScopeNumbers(selectedAssets.map((asset) => {
      const existingSection = currentAssetSections.find((section) => section.assetId === asset.id);
      if (existingSection) {
        return {
          ...existingSection,
          inquiryId,
          parentId: null,
          kind: 'asset_section' as const,
          assetId: asset.id,
          title: asset.name,
          updatedAt: now,
        };
      }
      return buildInquiryScopeAssetSection(asset, { now, id: newId('scope-asset'), inquiryId });
    }));

    for (const scopeItem of numberedSections) {
      const existed = currentAssetSections.some((section) => section.id === scopeItem.id);
      const savedScopeItem = await repository.upsert<InquiryScopeItem>('inquiryScopeItems', scopeItem);
      dispatch({ type: existed ? 'UPDATE_ENTITY' : 'ADD_ENTITY', entity: 'inquiryScopeItems', data: savedScopeItem });
    }

    const newLinkedAssets = selectedAssets.filter((asset) => !previouslyLinkedAssetIds.has(asset.id));
    const historyEntries = newLinkedAssets
      .filter((asset) => !assetHistoryEntries.some((entry) => entry.assetId === asset.id && entry.metadata?.source === 'inquiry' && entry.metadata?.inquiryId === inquiryId))
      .map((asset) => buildInquiryAssetLinkedHistoryEntry(asset, inquiry, now));

    if (historyEntries.length > 0) {
      const savedHistoryEntries = await Promise.all(
        historyEntries.map((entry) => repository.create<AssetHistoryEntry>('assetHistoryEntries', entry)),
      );
      savedHistoryEntries.forEach((entry) => dispatch({ type: 'ADD_ENTITY', entity: 'assetHistoryEntries', data: entry }));
    }
  };

  const saveManualInquiry = async (event: FormEvent) => {
    event.preventDefault();
    const now = new Date().toISOString();
    const title = form.title.trim();
    if (!title) return;

    const existingInquiry = editingInquiryId ? inquiries.find((item) => item.id === editingInquiryId) ?? null : null;
    const inquiryNumber = existingInquiry?.inquiryNumber ?? await reserveNextInquiryNumber();
    const inquiry: Inquiry = {
      id: existingInquiry?.id ?? newId('inq'),
      title,
      inquiryNumber,
      status: form.status,
      priority: existingInquiry?.priority ?? 'normal',
      source: existingInquiry?.source ?? 'manual',
      sourceMessageId: existingInquiry?.sourceMessageId ?? null,
      categoryId: form.categoryId || null,
      senderName: form.senderName.trim() || null,
      senderEmail: form.senderEmail.trim() || null,
      senderPhone: existingInquiry?.senderPhone ?? null,
      customerId: form.customerId || null,
      customerContactPersonId: form.customerContactPersonId || null,
      siteCustomerId: form.siteCustomerId || null,
      locationId: form.locationId || null,
      assetId: form.assetIds[0] || null,
      responsibleCustomerId: form.responsibleCustomerId || null,
      responsibleContactPersonId: form.responsibleContactPersonId || null,
      commissionRelevant: form.commissionRelevant,
      switchingActionRequired: form.switchingActionRequired,
      switchingActionByCustomer: form.switchingActionRequired === 'yes' ? form.switchingActionByCustomer : null,
      switchingActionContactPersonId: form.switchingActionRequired === 'yes' && form.switchingActionByCustomer === 'yes' ? form.switchingActionContactPersonId || null : null,
      executionPossibleWeekdays: form.executionPossibleWeekdays,
      executionPossibleFridayAfternoon: form.executionPossibleFridayAfternoon,
      executionPossibleSaturday: form.executionPossibleSaturday,
      executionPossibleSunday: form.executionPossibleSunday,
      executionPossibleAfterHours: form.executionPossibleAfterHours,
      executionPossiblePlannedShutdownOnly: form.executionPossiblePlannedShutdownOnly,
      executionInfo: form.executionInfo.trim() || null,
      relatedCalculationId: existingInquiry?.relatedCalculationId ?? null,
      assigneeUserId: existingInquiry?.assigneeUserId ?? null,
      assignedByUserId: existingInquiry?.assignedByUserId ?? null,
      assignedAt: existingInquiry?.assignedAt ?? null,
      createdByUserId: existingInquiry?.createdByUserId ?? null,
      summary: form.rawText.trim() || null,
      rawText: form.rawText.trim() || null,
      receivedAt: existingInquiry?.receivedAt ?? now,
      lastActionAt: existingInquiry?.lastActionAt ?? null,
      nextAction: existingInquiry?.status === form.status && existingInquiry?.nextAction ? existingInquiry.nextAction : getInquiryNextAction({ ...existingInquiry, status: form.status, nextAction: null } as Inquiry),
      needsAttention: false,
      createdAt: existingInquiry?.createdAt ?? now,
      updatedAt: now,
    };
    inquiry.needsAttention = shouldInquiryNeedAttention(inquiry);

    const saved = existingInquiry
      ? await repository.update<Inquiry>('inquiries', existingInquiry.id, inquiry)
      : await repository.create<Inquiry>('inquiries', inquiry);
    dispatch({ type: existingInquiry ? 'UPDATE_ENTITY' : 'ADD_ENTITY', entity: 'inquiries', data: saved });
    await syncInquiryAssetScopeItems(saved, selectedManualAssets, now);

    closeManualModal();
  };

  return (
    <div className="w-full py-8 px-6 space-y-6">
      <header className="flex flex-wrap gap-4 justify-between items-start">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Inbox size={32} className="text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">Anfrage-Dashboard</h1>
          </div>
          <p className="text-gray-600">Mail- und manuelle Anfragen sammeln, fachlich vorbereiten und kontrolliert ans Büro übergeben.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-start">
          <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-sm text-blue-800 max-w-md">
            <strong>Keine Preise im Anfragemodul.</strong> Erlaubt sind Arbeiten, Stunden, Mengen, technische Daten, Fotos und Hinweise.
          </div>
          <button type="button" onClick={openNewInquiryModal} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700">
            <UserCircle size={16} /> Neue Anfrage
          </button>
        </div>
      </header>

      <section className="grid md:grid-cols-4 gap-3">
        <InfoCard icon={<ClipboardList size={16} />} label="Offen" value={String(stats.open)} />
        <InfoCard icon={<AlertTriangle size={16} />} label="Handlungsbedarf" value={String(stats.attention)} tone="orange" />
        <InfoCard icon={<CheckCircle2 size={16} />} label="Bereit fürs Büro" value={String(stats.ready)} tone="green" />
        <InfoCard icon={<Mail size={16} />} label="Aus Mail" value={String(stats.mail)} />
      </section>

      <section className="w-full">
        <DataTable
          title="Anfragen"
          search={{ value: searchQuery, onChange: setSearchQuery, placeholder: 'Titel, Rechnungsempfänger, Betreiber oder Absender suchen...' }}
          columns={columns}
          rows={filteredRows}
          rowKey={(item) => item.id}
          loading={isLoading}
          error={loadError ? { message: 'Anfragen konnten nicht geladen werden.' } : undefined}
          emptyState={{ title: 'Keine Anfragen vorhanden', description: 'Lege eine Anfrage manuell an oder importiere später Mails in dieses Dashboard.' }}
          columnVisibility={{ enabled: true, storageKey: 'datatable.inquiries.v4', defaultVisibleKeys: ['inquiryNumber', 'title', 'source', 'category', 'customer', 'siteCustomer', 'responsible', 'status', 'nextAction', 'receivedAt'], enableReordering: true }}
        />
      </section>

      {isManualModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-8" onClick={closeManualModal}>
          <div role="dialog" aria-modal="true" aria-labelledby="manual-inquiry-title" className="w-[90vw] max-w-[90vw] rounded-2xl bg-white p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 id="manual-inquiry-title" className="font-semibold flex items-center gap-2 text-lg"><UserCircle size={18} /> {editingInquiryId ? 'Anfrage bearbeiten' : 'Manuell anlegen'}</h2>
                <p className="mt-1 text-sm text-gray-500">{editingInquiryId ? 'Bestehende Anfrage anpassen und Änderungen speichern.' : 'Neue Anfrage erfassen und direkt zuordnen.'}</p>
              </div>
              <button type="button" aria-label="Modal schließen" onClick={closeManualModal} className="rounded-full px-2 py-1 text-xl leading-none text-gray-400 hover:bg-gray-100 hover:text-gray-700">×</button>
            </div>
            <form onSubmit={saveManualInquiry} className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.8fr)]">
                <div className="space-y-3">
                  <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_260px]">
                    <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Titel der Anfrage" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required />
                    <select className="w-full border rounded-lg px-3 py-2 text-sm" value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: event.target.value })}>
                      <option value="">Anfragekategorie wählen</option>
                      {inquiryCategoryOptions.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}
                    </select>
                  </div>
                  <div className="grid gap-3 md:grid-cols-[220px_minmax(0,1fr)]">
                    <label className="space-y-1 text-xs font-semibold text-gray-600">
                      <span>Status</span>
                      <select aria-label="Status" className="w-full border rounded-lg px-3 py-2 text-sm font-normal text-gray-800" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as InquiryStatus })}>
                        {inquiryStatusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </select>
                    </label>
                    <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
                      Handlungsbedarf zählt nur bei Neu/In Sichtung, dringend oder wenn Pflichtpunkte fehlen.
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Name / Absender" value={form.senderName} onChange={(event) => setForm({ ...form, senderName: event.target.value })} />
                    <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="E-Mail" value={form.senderEmail} onChange={(event) => setForm({ ...form, senderEmail: event.target.value })} />
                  </div>

                  <div aria-label="Rechnungsempfänger Abschnitt" className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">Rechnungsempfänger & Ansprechpartner</p>
                      <p className="text-xs text-gray-500">Erst Rechnungsempfänger wählen, danach den passenden Ansprechpartner.</p>
                    </div>
                    <div className="grid gap-2 md:grid-cols-2">
                      <ContactAssignmentField
                        label="Rechnungsempfänger zuordnen"
                        placeholder="Rechnungsempfänger suchen"
                        value={form.customerId}
                        options={customers.map((customer) => ({ id: customer.id, label: customer.name, type: 'customer' }))}
                        onChange={updateManualCustomer}
                        onCreateNew={() => setContactCreateContext('invoiceRecipient')}
                        createLabel="Firma"
                      />
                      <ContactAssignmentField
                        label="Ansprechpartner Rechnungsempfänger"
                        placeholder="Ansprechpartner suchen"
                        value={form.customerContactPersonId}
                        options={manualCustomerContactOptions}
                        onChange={updateManualCustomerContactPerson}
                        onCreateNew={() => setContactCreateContext('contactPerson')}
                        createLabel="Ansprechpartner"
                        warning={customerContactRelationWarning}
                        onWarningAction={createMissingCustomerContactLink}
                        warningActionLabel="Verknüpfung erstellen"
                      />
                    </div>
                  </div>

                  <div aria-label="Assets Abschnitt" className="space-y-2 rounded-xl border border-sky-200 bg-sky-50 p-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">Assets</p>
                      <p className="text-xs text-gray-500">Mehrere Assets auswählen oder direkt neu anlegen – sie werden als Abschnitte fürs Büro vorbereitet.</p>
                    </div>
                    <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
                      <ContactAssignmentField
                        label="Asset zuordnen"
                        placeholder="Asset suchen"
                        value={assetPickerId}
                        options={filteredManualAssets.map((asset) => ({ id: asset.id, label: asset.name, type: 'asset' }))}
                        onChange={setAssetPickerId}
                      />
                      <button type="button" onClick={addManualAsset} disabled={!assetPickerId} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300">Asset hinzufügen</button>
                    </div>
                    <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
                      <input className="w-full rounded-lg border px-3 py-2 text-sm" placeholder="Neues Asset anlegen" value={assetCreateName} onChange={(event) => setAssetCreateName(event.target.value)} />
                      <button type="button" onClick={createManualAsset} disabled={!assetCreateName.trim()} className="rounded-lg border bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:text-gray-300">Anlegen & hinzufügen</button>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-700">Ausgewählte Assets</p>
                      {selectedManualAssets.length === 0 ? (
                        <p className="text-xs text-gray-500">Noch kein Asset ausgewählt.</p>
                      ) : (
                        <div className="mt-1 flex flex-wrap gap-2">
                          {form.assetIds.map((assetId) => {
                            const asset = assets.find((item) => item.id === assetId);
                            if (!asset) return null;
                            return (
                              <span key={asset.id} className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs text-gray-700 shadow-sm">
                                {asset.name}
                                <button type="button" aria-label={`${asset.name} entfernen`} onClick={() => removeManualAsset(asset.id)} className="text-gray-400 hover:text-gray-700">×</button>
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  <div aria-label="Anfragetext Abschnitt" className="space-y-2">
                    <textarea rows={5} className="w-full min-h-40 border rounded-lg px-3 py-2 text-sm" placeholder="Anfragetext, Arbeiten, Stunden, Mengen, technische Hinweise" value={form.rawText} onChange={(event) => setForm({ ...form, rawText: event.target.value })} />
                  </div>
                </div>

                <div className="space-y-3" aria-label="Optionale Zuordnungen">
                  <div aria-label="Standort Abschnitt" className="rounded-xl border border-violet-200 bg-violet-50 p-2">
                    <label className="flex min-h-10 cursor-pointer items-center gap-3 rounded-lg px-2 text-sm font-semibold text-gray-800">
                      <input type="checkbox" checked={optionalPanels.location} onChange={(event) => toggleLocationPanel(event.target.checked)} />
                      <span>Standort</span>
                    </label>
                    {optionalPanels.location && (
                      <div className="mt-2 space-y-2 border-t border-violet-100 px-2 pt-2">
                        <p className="text-xs text-gray-500">Standorte werden nach Betreiber oder Rechnungsempfänger gefiltert.</p>
                        <ContactAssignmentField
                          label="Standort zuordnen"
                          placeholder={manualLocationCustomerId ? 'Standort suchen' : 'Erst Rechnungsempfänger oder Betreiber wählen'}
                          value={form.locationId}
                          options={filteredManualLocations.map((location) => ({ id: location.id, label: buildLocationAssignmentLabel(location, customers, locationCustomers), type: 'location' }))}
                          onChange={updateManualLocation}
                          disabled={!manualLocationCustomerId}
                        />
                      </div>
                    )}
                  </div>

                  <div className="rounded-xl border border-dashed border-blue-100 bg-blue-50/40 p-2">
                    <label className="flex min-h-10 cursor-pointer items-center gap-3 rounded-lg px-2 text-sm font-semibold text-gray-800">
                      <input type="checkbox" checked={optionalPanels.responsible} onChange={(event) => toggleResponsiblePanel(event.target.checked)} />
                      <span>Vermittler / Provisionsempfänger</span>
                    </label>
                    {optionalPanels.responsible && (
                      <div className="mt-2 space-y-2 border-t border-blue-100 px-2 pt-2">
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-xs text-gray-500">Vermittler optional – Privatperson, Firma oder Firma mit Ansprechpartner.</p>
                          <label className="flex shrink-0 items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm text-gray-700">
                            <input type="checkbox" checked={form.commissionRelevant} onChange={(event) => setForm({ ...form, commissionRelevant: event.target.checked })} />
                            <span>Provision</span>
                          </label>
                        </div>
                        <ContactAssignmentField
                          label="Vermittler / Provisionsempfänger"
                          placeholder="Vermittler suchen"
                          value={responsibleAssignmentValue}
                          options={responsibleOptions}
                          onChange={updateManualResponsible}
                          onCreateNew={() => setContactCreateContext('mediator')}
                          createLabel="Kontakt"
                        />
                      </div>
                    )}
                  </div>
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-2">
                    <label className="flex min-h-10 cursor-pointer items-center gap-3 rounded-lg px-2 text-sm font-semibold text-gray-800">
                      <input type="checkbox" checked={optionalPanels.siteCustomer} onChange={(event) => toggleSiteCustomerPanel(event.target.checked)} />
                      <span>Betreiber zuordnen</span>
                    </label>
                    {optionalPanels.siteCustomer && (
                      <div className="mt-2 space-y-2 border-t border-amber-100 px-2 pt-2">
                        <p className="text-xs text-gray-500">Betreiber optional – wird nicht automatisch aus dem Rechnungsempfänger übernommen.</p>
                        <ContactAssignmentField
                          label="Betreiber zuordnen"
                          placeholder="Betreiber suchen"
                          value={form.siteCustomerId}
                          options={customers.map((customer) => ({ id: customer.id, label: customer.name, type: 'customer' }))}
                          onChange={updateManualSiteCustomer}
                          onCreateNew={() => setContactCreateContext('operator')}
                          createLabel="Firma"
                        />
                      </div>
                    )}
                  </div>

                  <div aria-label="Auftragsspezifisch Abschnitt" className="space-y-3 rounded-xl border border-orange-200 bg-orange-50 p-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">Auftragsspezifisch</p>
                      <p className="text-xs text-gray-500">Schalthandlung und bauseitige Zuständigkeit direkt bei der Anfrage klären.</p>
                    </div>
                    <DecisionRadioGroup
                      label="Schalthandlung erforderlich?"
                      value={form.switchingActionRequired}
                      onChange={updateSwitchingActionRequired}
                    />
                    <DecisionRadioGroup
                      label="Schalthandlung wird durch Bauseits ausgeführt"
                      value={form.switchingActionByCustomer}
                      onChange={updateSwitchingActionByCustomer}
                      disabled={!switchingActionByCustomerEnabled}
                    />
                    {switchingActionByCustomerEnabled && form.switchingActionByCustomer === 'yes' && (
                      <ContactAssignmentField
                        label="Ansprechpartner Schalthandlung"
                        placeholder="Ansprechpartner für Schalthandlung suchen"
                        value={form.switchingActionContactPersonId}
                        options={switchingContactOptions}
                        onChange={(switchingActionContactPersonId) => setForm({ ...form, switchingActionContactPersonId })}
                        onCreateNew={() => setContactCreateContext('switchingContactPerson')}
                        createLabel="Ansprechpartner"
                      />
                    )}
                    <div className="space-y-2 rounded-lg border border-orange-100 bg-white/70 p-3">
                      <p className="text-xs font-semibold text-gray-700">Ausführung möglich:</p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <label className="flex items-center gap-2 text-xs text-gray-700"><input type="checkbox" checked={form.executionPossibleWeekdays} onChange={(event) => setForm({ ...form, executionPossibleWeekdays: event.target.checked })} /> In der Woche</label>
                        <label className="flex items-center gap-2 text-xs text-gray-700"><input type="checkbox" checked={form.executionPossibleFridayAfternoon} onChange={(event) => setForm({ ...form, executionPossibleFridayAfternoon: event.target.checked })} /> Freitag Nachmittags</label>
                        <label className="flex items-center gap-2 text-xs text-gray-700"><input type="checkbox" checked={form.executionPossibleSaturday} onChange={(event) => setForm({ ...form, executionPossibleSaturday: event.target.checked })} /> Samstag</label>
                        <label className="flex items-center gap-2 text-xs text-gray-700"><input type="checkbox" checked={form.executionPossibleSunday} onChange={(event) => setForm({ ...form, executionPossibleSunday: event.target.checked })} /> Sonntag</label>
                        <label className="flex items-center gap-2 text-xs text-gray-700"><input type="checkbox" checked={form.executionPossibleAfterHours} onChange={(event) => setForm({ ...form, executionPossibleAfterHours: event.target.checked })} /> In der Woche nach Feierabend</label>
                        <label className="flex items-center gap-2 text-xs text-gray-700"><input type="checkbox" checked={form.executionPossiblePlannedShutdownOnly} onChange={(event) => setForm({ ...form, executionPossiblePlannedShutdownOnly: event.target.checked })} /> Nur während geplanter Abschaltung</label>
                      </div>
                      <label className="block space-y-1 text-xs font-semibold text-gray-700">
                        <span>Info:</span>
                        <textarea rows={2} className="w-full rounded-lg border px-3 py-2 text-sm font-normal text-gray-800" value={form.executionInfo} onChange={(event) => setForm({ ...form, executionInfo: event.target.value })} placeholder="Zusätzliche Hinweise zur möglichen Ausführung" />
                      </label>
                    </div>
                    {switchingClarificationWarning && (
                      <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-medium text-amber-800">
                        <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                        <span>{switchingClarificationWarning}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <button type="button" onClick={closeManualModal} className="flex-1 rounded-lg border px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Abbrechen</button>
                <button type="submit" className="flex-1 px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700">{editingInquiryId ? 'Änderungen speichern' : 'Anfrage speichern'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
      <ContactCreateModal
        isOpen={contactCreateContext !== null}
        context={contactCreateContext ?? 'invoiceRecipient'}
        defaultCustomerId={form.customerId}
        onClose={() => setContactCreateContext(null)}
        onCreated={handleContactCreated}
      />
    </div>
  );
}

function DecisionRadioGroup({
  label,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  value: InquiryDecision;
  onChange: (value: InquiryDecision) => void;
  disabled?: boolean;
}) {
  const options: Array<{ value: InquiryDecision; label: string }> = [
    { value: 'yes', label: 'Ja' },
    { value: 'no', label: 'Nein' },
    { value: 'unknown', label: 'Unbekannt' },
  ];

  return (
    <fieldset className="space-y-1" disabled={disabled}>
      <legend className={`text-xs font-semibold ${disabled ? 'text-gray-400' : 'text-gray-700'}`}>{label}</legend>
      <div className="grid grid-cols-3 gap-2">
        {options.map((option) => (
          <label key={option.value} className={`flex items-center justify-center gap-2 rounded-lg border bg-white px-3 py-2 text-xs font-medium ${disabled ? 'cursor-not-allowed text-gray-400' : 'cursor-pointer text-gray-700 hover:bg-orange-100'}`}>
            <input
              type="radio"
              name={label}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              disabled={disabled}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function SearchableAssignmentField({
  label,
  placeholder,
  value,
  options,
  onChange,
  disabled = false,
}: {
  label: string;
  placeholder: string;
  value: string;
  options: AutocompleteOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const selectedOption = options.find((option) => option.id === value) ?? null;
  const [query, setQuery] = useState(selectedOption?.label ?? '');
  const [isOpen, setIsOpen] = useState(false);
  const inputId = `assignment-${label.toLowerCase().replace(/[^a-z0-9]+/gi, '-')}`;
  const listboxId = `${inputId}-listbox`;

  useEffect(() => {
    if (!isOpen) setQuery(selectedOption?.label ?? '');
  }, [isOpen, selectedOption?.label]);

  const filteredOptions = useMemo(() => filterAutocompleteOptions(options, query), [options, query]);

  return (
    <div className="relative">
      <label htmlFor={inputId} className="sr-only">{label}</label>
      <input
        id={inputId}
        role="combobox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-disabled={disabled}
        disabled={disabled}
        className={`w-full border rounded-lg px-3 py-2 pr-9 text-sm ${disabled ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : ''}`}
        placeholder={placeholder}
        value={query}
        onFocus={() => {
          if (!disabled) setIsOpen(true);
        }}
        onBlur={() => window.setTimeout(() => setIsOpen(false), 120)}
        onChange={(event) => {
          if (disabled) return;
          setQuery(event.target.value);
          setIsOpen(true);
          if (value) onChange('');
        }}
      />
      {value && (
        <button
          type="button"
          aria-label={`${label} entfernen`}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            onChange('');
            setQuery('');
            setIsOpen(true);
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
        >
          ×
        </button>
      )}
      {isOpen && !disabled && (
        <div id={listboxId} role="listbox" className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-gray-200 bg-white py-1 text-sm shadow-lg">
          {filteredOptions.length === 0 ? (
            <div className="px-3 py-2 text-gray-500">Kein Treffer</div>
          ) : filteredOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              role="option"
              aria-selected={option.id === value}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onChange(option.id);
                setQuery(option.label);
                setIsOpen(false);
              }}
              className={`block w-full px-3 py-2 text-left hover:bg-blue-50 ${option.id === value ? 'bg-blue-100 text-blue-900' : 'text-gray-800'}`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function formatContactPersonName(person: ContactPerson) {
  const name = [person.firstName, person.lastName].filter(Boolean).join(' ').trim();
  return name || person.email || person.phone1 || person.id;
}

function buildMediatorAssignmentOptions(customers: Customer[], contactPersons: ContactPerson[], customerContactPersons: CustomerContactPerson[]) {
  const customerOptions = customers.map((customer) => ({
    id: `customer:${customer.id}`,
    label: `Firma: ${customer.name}`,
  }));
  const personOptions = contactPersons.map((person) => ({
    id: `contact:${person.id}`,
    label: `Privatperson: ${formatContactPersonName(person)}`,
  }));
  const customerContactOptions = customerContactPersons
    .map((link) => {
      const customer = customers.find((item) => item.id === link.customerId);
      const person = contactPersons.find((item) => item.id === link.contactPersonId);
      if (!customer || !person) return null;
      return {
        id: `customerContact:${customer.id}:${person.id}`,
        label: `Firma mit Ansprechpartner: ${customer.name} · ${formatContactPersonName(person)}`,
      };
    })
    .filter((option): option is AutocompleteOption => Boolean(option));

  return [...customerContactOptions, ...customerOptions, ...personOptions];
}

function buildLocationAssignmentLabel(location: Location, customers: Customer[], locationCustomers: LocationCustomer[]) {
  const customerNames = locationCustomers
    .filter((link) => link.locationId === location.id)
    .map((link) => customers.find((customer) => customer.id === link.customerId)?.name)
    .filter(Boolean);
  return customerNames.length ? `${location.name} · ${customerNames.join(', ')}` : location.name;
}

function InfoCard({ icon, label, value, tone = 'blue' }: { icon: ReactNode; label: string; value: string; tone?: 'blue' | 'orange' | 'green' }) {
  const toneClass = tone === 'orange' ? 'text-orange-600' : tone === 'green' ? 'text-green-600' : 'text-blue-600';
  return (
    <div className="bg-white border rounded-xl p-4">
      <div className={`inline-flex items-center gap-2 text-sm ${toneClass}`}>{icon} {label}</div>
      <p className="mt-1 text-2xl font-semibold text-gray-900">{value}</p>
    </div>
  );
}
