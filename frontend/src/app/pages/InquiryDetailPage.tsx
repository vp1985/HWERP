import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import { AlertTriangle, ArrowLeft, CheckCircle2, ClipboardList, Download, FileText, HelpCircle, Image, Link2, Mail, Package, Send, UserCircle, XCircle } from 'lucide-react';
import { useAppStore } from '../context/AppStoreContext';
import { createChecklistRunFromTemplate, resolveChecklistItemSuggestions } from '../features/checklists/checklists';
import { buildAcceptedChecklistSuggestionRun, isChecklistSuggestionAccepted } from '../lib/checklistSuggestionChecklistRuns';
import { buildChecklistSuggestionLineItem, getChecklistSuggestionLineItemKey, getChecklistSuggestionLineItemKeyForItem } from '../lib/checklistSuggestionLineItems';
import { buildChecklistSuggestionPackingItem, getChecklistSuggestionPackingItemKey, getChecklistSuggestionPackingItemKeyForItem } from '../lib/checklistSuggestionPackingItems';
import { buildChecklistSuggestionWorkshopTask, getChecklistSuggestionWorkshopTaskKey, getChecklistSuggestionWorkshopTaskKeyForTask } from '../lib/checklistSuggestionWorkshopTasks';
import type { AssetNode, CalculationLineItem, ChecklistItemAction, ChecklistRun, ChecklistRunItem, ChecklistRunLink, ChecklistRunItemStatus, ChecklistTemplate, ChecklistTemplateGroup, ChecklistTemplateItem, Customer, Inquiry, InquiryAttachment, InquiryExternalLink, InquiryMasterDataCategory, InquiryMessage, InquiryResponseDraft, Location, InquiryStatus, Material, Service, WorkshopCard, WorkshopCardTask } from '../lib/types';
import { sanitizeInquiryHref } from '../lib/inquiryLinkUtils';
import { redactInquiryPriceText } from '../lib/inquiryTextUtils';
import { getInquiryNextAction, getInquirySourceLabel } from '../lib/inquiryUtils';
import { DEFAULT_NUMBER_RANGES, loadNumberRangesFromStorage, saveNumberRangesToStorage } from '../lib/numberRangeUtils';
import { reserveNextWorkshopCardNumber } from '../features/work-preparation/workshopCards';

const inquiryStatusLabels: Record<InquiryStatus, string> = {
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

const storageProviderLabels: Record<InquiryAttachment['storageProvider'], string> = {
  local: 'Lokal',
  sharepoint: 'SharePoint',
  onedrive: 'OneDrive',
  external: 'Extern',
};

const WORKSHOP_CARD_LINK_LABEL_PREFIX = 'HWERP-Werkstattkarte';

const linkKindLabels: Record<InquiryExternalLink['kind'], string> = {
  hwerp_customer: 'HWERP-Kunde',
  hwerp_asset: 'HWERP-Asset',
  hwerp_calculation: 'HWERP-Kalkulation',
  hwerp_offer: 'HWERP-Angebot',
  lexoffice_customer: 'Lexoffice Kunde',
  lexoffice_offer: 'Lexoffice Angebot',
  sharepoint_folder: 'SharePoint-Ordner',
  other: 'Sonstiger Link',
};

export default function InquiryDetailPage() {
  const { id } = useParams();
  const { state, dispatch, repository } = useAppStore();
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const [inquiries, messages, drafts, attachments, externalLinks, customers, locations, assets, checklistRuns, checklistRunLinks, checklistRunItems, categories, checklistTemplates, checklistTemplateGroups, checklistTemplateItems, checklistItemActions, services, materials, calculationLineItems, workshopCards, workshopCardTasks] = await Promise.all([
          repository.list<Inquiry>('inquiries'),
          repository.list<InquiryMessage>('inquiryMessages'),
          repository.list<InquiryResponseDraft>('inquiryResponseDrafts'),
          repository.list<InquiryAttachment>('inquiryAttachments'),
          repository.list<InquiryExternalLink>('inquiryExternalLinks'),
          repository.list<Customer>('customers'),
          repository.list<Location>('locations'),
          repository.list<AssetNode>('assets'),
          repository.list<ChecklistRun>('checklistRuns'),
          repository.list<ChecklistRunLink>('checklistRunLinks'),
          repository.list<ChecklistRunItem>('checklistRunItems'),
          repository.list<InquiryMasterDataCategory>('inquiryMasterDataCategories'),
          repository.list<ChecklistTemplate>('checklistTemplates'),
          repository.list<ChecklistTemplateGroup>('checklistTemplateGroups'),
          repository.list<ChecklistTemplateItem>('checklistTemplateItems'),
          repository.list<ChecklistItemAction>('checklistItemActions'),
          repository.list<Service>('services'),
          repository.list<Material>('materials'),
          repository.list<CalculationLineItem>('calculationLineItems'),
          repository.list<WorkshopCard>('workshopCards'),
          repository.list<WorkshopCardTask>('workshopCardTasks'),
        ]);
        dispatch({ type: 'SET_ENTITIES', entity: 'inquiries', data: inquiries });
        dispatch({ type: 'SET_ENTITIES', entity: 'inquiryMessages', data: messages });
        dispatch({ type: 'SET_ENTITIES', entity: 'inquiryResponseDrafts', data: drafts });
        dispatch({ type: 'SET_ENTITIES', entity: 'inquiryAttachments', data: attachments });
        dispatch({ type: 'SET_ENTITIES', entity: 'inquiryExternalLinks', data: externalLinks });
        dispatch({ type: 'SET_ENTITIES', entity: 'customers', data: customers });
        dispatch({ type: 'SET_ENTITIES', entity: 'locations', data: locations });
        dispatch({ type: 'SET_ENTITIES', entity: 'assets', data: assets });
        dispatch({ type: 'SET_ENTITIES', entity: 'checklistRuns', data: checklistRuns });
        dispatch({ type: 'SET_ENTITIES', entity: 'checklistRunLinks', data: checklistRunLinks });
        dispatch({ type: 'SET_ENTITIES', entity: 'checklistRunItems', data: checklistRunItems });
        dispatch({ type: 'SET_ENTITIES', entity: 'inquiryMasterDataCategories', data: categories });
        dispatch({ type: 'SET_ENTITIES', entity: 'checklistTemplates', data: checklistTemplates });
        dispatch({ type: 'SET_ENTITIES', entity: 'checklistTemplateGroups', data: checklistTemplateGroups });
        dispatch({ type: 'SET_ENTITIES', entity: 'checklistTemplateItems', data: checklistTemplateItems });
        dispatch({ type: 'SET_ENTITIES', entity: 'checklistItemActions', data: checklistItemActions });
        dispatch({ type: 'SET_ENTITIES', entity: 'services', data: services });
        dispatch({ type: 'SET_ENTITIES', entity: 'materials', data: materials });
        dispatch({ type: 'SET_ENTITIES', entity: 'calculationLineItems', data: calculationLineItems });
        dispatch({ type: 'SET_ENTITIES', entity: 'workshopCards', data: workshopCards });
        dispatch({ type: 'SET_ENTITIES', entity: 'workshopCardTasks', data: workshopCardTasks });
      } catch (error) {
        console.error('Fehler beim Laden der Anfrage-Details:', error);
        setLoadError(true);
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [repository, dispatch]);

  const inquiries = (state.inquiries as Inquiry[]) || [];
  const messages = (state.inquiryMessages as InquiryMessage[]) || [];
  const drafts = (state.inquiryResponseDrafts as InquiryResponseDraft[]) || [];
  const attachments = (state.inquiryAttachments as InquiryAttachment[]) || [];
  const externalLinks = (state.inquiryExternalLinks as InquiryExternalLink[]) || [];
  const customers = (state.customers as Customer[]) || [];
  const locations = (state.locations as Location[]) || [];
  const assets = (state.assets as AssetNode[]) || [];
  const checklistRuns = (state.checklistRuns as ChecklistRun[]) || [];
  const checklistRunLinks = (state.checklistRunLinks as ChecklistRunLink[]) || [];
  const checklistRunItems = (state.checklistRunItems as ChecklistRunItem[]) || [];
  const categories = (state.inquiryMasterDataCategories as InquiryMasterDataCategory[]) || [];
  const checklistTemplates = (state.checklistTemplates as ChecklistTemplate[]) || [];
  const checklistTemplateGroups = (state.checklistTemplateGroups as ChecklistTemplateGroup[]) || [];
  const checklistTemplateItems = (state.checklistTemplateItems as ChecklistTemplateItem[]) || [];
  const checklistItemActions = (state.checklistItemActions as ChecklistItemAction[]) || [];
  const services = (state.services as Service[]) || [];
  const materials = (state.materials as Material[]) || [];
  const calculationLineItems = (state.calculationLineItems as CalculationLineItem[]) || [];
  const workshopCards = (state.workshopCards as WorkshopCard[]) || [];
  const workshopCardTasks = (state.workshopCardTasks as WorkshopCardTask[]) || [];

  const inquiry = inquiries.find((item) => item.id === id) ?? null;
  const packet = useMemo<{
    messages: InquiryMessage[];
    drafts: InquiryResponseDraft[];
    attachments: InquiryAttachment[];
    externalLinks: InquiryExternalLink[];
  }>(() => {
    if (!inquiry) {
      return { messages: [], drafts: [], attachments: [], externalLinks: [] };
    }

    return {
      messages: messages.filter((item) => item.inquiryId === inquiry.id),
      drafts: drafts.filter((item) => item.inquiryId === inquiry.id),
      attachments: attachments.filter((item) => item.inquiryId === inquiry.id),
      externalLinks: externalLinks.filter((item) => item.inquiryId === inquiry.id),
    };
  }, [inquiry, messages, drafts, attachments, externalLinks]);

  const customer = inquiry?.customerId ? customers.find((item) => item.id === inquiry.customerId) ?? null : null;
  const location = inquiry?.locationId ? locations.find((item) => item.id === inquiry.locationId) ?? null : null;
  const asset = inquiry?.assetId ? assets.find((item) => item.id === inquiry.assetId) ?? null : null;
  const inquiryChecklistRuns = useMemo(() => {
    if (!inquiry) return [];
    const runIds = new Set(
      checklistRunLinks
        .filter((link) => link.targetType === 'inquiry' && link.targetId === inquiry.id)
        .map((link) => link.runId),
    );
    return checklistRuns
      .filter((run) => runIds.has(run.id))
      .map((run) => ({
        run,
        items: checklistRunItems
          .filter((item) => item.runId === run.id)
          .sort((left, right) => left.sortOrder - right.sortOrder || left.title.localeCompare(right.title, 'de')),
      }));
  }, [inquiry, checklistRunLinks, checklistRuns, checklistRunItems]);

  const linkedCalculationId = packet.externalLinks.find((link) => link.kind === 'hwerp_calculation' && link.targetId)?.targetId ?? null;
  const linkedWorkshopCardIds = packet.externalLinks
    .filter((link) => link.kind === 'other' && link.targetId && link.label.startsWith(WORKSHOP_CARD_LINK_LABEL_PREFIX))
    .map((link) => link.targetId as string);
  const linkedWorkshopCards = workshopCards.filter((card) => linkedWorkshopCardIds.includes(card.id));
  const inquiryChecklistRunHeaders = inquiryChecklistRuns.map(({ run }) => run);
  const packingListRuns = inquiryChecklistRuns.filter(({ run }) => run.runType === 'packing_list').map(({ run }) => run);

  const categoryChecklistTemplates = useMemo(() => {
    if (!inquiry?.categoryId) return [];
    const category = categories.find((entry) => entry.id === inquiry.categoryId);
    const linkedIds = new Set(category?.checklistTemplateIds ?? []);
    const existingTemplateIds = new Set(inquiryChecklistRuns.map(({ run }) => run.templateId).filter((templateId): templateId is string => Boolean(templateId)));
    return checklistTemplates.filter((template) => linkedIds.has(template.id) && template.status === 'active' && !existingTemplateIds.has(template.id));
  }, [inquiry, categories, checklistTemplates, inquiryChecklistRuns]);

  const createCategoryChecklistRuns = async () => {
    if (!inquiry || categoryChecklistTemplates.length === 0) return;
    const now = new Date().toISOString();
    for (const template of categoryChecklistTemplates) {
      const result = createChecklistRunFromTemplate({
        template,
        groups: checklistTemplateGroups.filter((group) => group.templateId === template.id),
        items: checklistTemplateItems.filter((item) => item.templateId === template.id),
        links: [{ targetType: 'inquiry', targetId: inquiry.id }],
        now,
        idFactory: () => crypto.randomUUID(),
      });
      const savedRun = await repository.upsert<ChecklistRun>('checklistRuns', result.run);
      dispatch({ type: 'ADD_ENTITY', entity: 'checklistRuns', data: savedRun });
      for (const link of result.links) {
        const savedLink = await repository.upsert<ChecklistRunLink>('checklistRunLinks', link);
        dispatch({ type: 'ADD_ENTITY', entity: 'checklistRunLinks', data: savedLink });
      }
      for (const item of result.runItems) {
        const savedItem = await repository.upsert<ChecklistRunItem>('checklistRunItems', item);
        dispatch({ type: 'ADD_ENTITY', entity: 'checklistRunItems', data: savedItem });
      }
    }
  };

  const acceptChecklistSuggestion = async (action: ChecklistItemAction) => {
    const now = new Date().toISOString();
    if (action.actionType === 'suggest_checklist') {
      if (!inquiry || isChecklistSuggestionAccepted(action, inquiryChecklistRunHeaders)) return;

      const result = buildAcceptedChecklistSuggestionRun({
        action,
        targetId: inquiry.id,
        templates: checklistTemplates,
        groups: checklistTemplateGroups,
        items: checklistTemplateItems,
        now,
        idFactory: () => crypto.randomUUID(),
      });
      if (!result) return;

      const savedRun = await repository.upsert<ChecklistRun>('checklistRuns', result.run);
      dispatch({ type: 'ADD_ENTITY', entity: 'checklistRuns', data: savedRun });
      for (const link of result.links) {
        const savedLink = await repository.upsert<ChecklistRunLink>('checklistRunLinks', link);
        dispatch({ type: 'ADD_ENTITY', entity: 'checklistRunLinks', data: savedLink });
      }
      for (const item of result.runItems) {
        const savedItem = await repository.upsert<ChecklistRunItem>('checklistRunItems', item);
        dispatch({ type: 'ADD_ENTITY', entity: 'checklistRunItems', data: savedItem });
      }
      return;
    }

    if (action.actionType === 'create_task') {
      if (!inquiry) return;
      let targetCard = linkedWorkshopCards[0] ?? null;
      if (!targetCard) {
        const numberRanges = typeof window === 'undefined' ? DEFAULT_NUMBER_RANGES : loadNumberRangesFromStorage();
        const reserved = reserveNextWorkshopCardNumber(numberRanges);
        const cardNumber = workshopCards.some((card) => card.cardNumber === reserved.cardNumber)
          ? `${reserved.cardNumber}-${Date.now().toString(36)}`
          : reserved.cardNumber;
        const card: WorkshopCard = {
          id: crypto.randomUUID(),
          cardNumber,
          title: `Anfrage ${inquiry.inquiryNumber ?? inquiry.id}`,
          orderNumber: inquiry.inquiryNumber ?? '',
          assetId: inquiry.assetId,
          customerId: inquiry.customerId,
          status: 'draft',
          assigneeCodes: [],
          qrCodeToken: `wk-${cardNumber.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`,
          notes: `Aus Anfrage ${inquiry.inquiryNumber ?? inquiry.id} erzeugt.`,
          createdAt: now,
          updatedAt: now,
        };
        targetCard = await repository.upsert<WorkshopCard>('workshopCards', card);
        const link: InquiryExternalLink = {
          id: crypto.randomUUID(),
          inquiryId: inquiry.id,
          kind: 'other',
          label: `${WORKSHOP_CARD_LINK_LABEL_PREFIX} ${targetCard.cardNumber}`,
          url: null,
          targetId: targetCard.id,
          createdByUserId: 'manual',
          createdAt: now,
          updatedAt: now,
        };
        const savedLink = await repository.upsert<InquiryExternalLink>('inquiryExternalLinks', link);
        if (typeof window !== 'undefined') saveNumberRangesToStorage(reserved.numberRanges);
        dispatch({ type: 'ADD_ENTITY', entity: 'workshopCards', data: targetCard });
        dispatch({ type: 'ADD_ENTITY', entity: 'inquiryExternalLinks', data: savedLink });
      }

      const duplicateKey = getChecklistSuggestionWorkshopTaskKey(action, targetCard.id);
      const alreadyAccepted = duplicateKey
        ? workshopCardTasks.some((task) => getChecklistSuggestionWorkshopTaskKeyForTask(task) === duplicateKey)
        : false;
      if (alreadyAccepted) return;

      const nextSortOrder = Math.max(0, ...workshopCardTasks.filter((task) => task.cardId === targetCard.id).map((task) => task.sortOrder)) + 10;
      const task = buildChecklistSuggestionWorkshopTask({
        action,
        cardId: targetCard.id,
        services,
        sortOrder: nextSortOrder,
        id: crypto.randomUUID(),
        now,
      });
      if (!task) return;

      const savedTask = await repository.upsert<WorkshopCardTask>('workshopCardTasks', task);
      dispatch({ type: 'ADD_ENTITY', entity: 'workshopCardTasks', data: savedTask });
      return;
    }

    if (action.actionType === 'create_packing_item') {
      if (!inquiry) return;
      let targetRun = packingListRuns[0] ?? null;
      if (!targetRun) {
        const run: ChecklistRun = {
          id: crypto.randomUUID(),
          templateId: null,
          templateSnapshot: {},
          title: 'Rüstliste',
          runType: 'packing_list',
          status: 'open',
          verificationRequired: false,
          verifiedBy: null,
          verifiedAt: null,
          qrCodeToken: crypto.randomUUID(),
          createdBy: 'manual',
          createdAt: now,
          updatedAt: now,
        };
        const link: ChecklistRunLink = {
          id: crypto.randomUUID(),
          runId: run.id,
          targetType: 'inquiry',
          targetId: inquiry.id,
          createdAt: now,
          updatedAt: now,
        };
        targetRun = await repository.upsert<ChecklistRun>('checklistRuns', run);
        const savedLink = await repository.upsert<ChecklistRunLink>('checklistRunLinks', link);
        dispatch({ type: 'ADD_ENTITY', entity: 'checklistRuns', data: targetRun });
        dispatch({ type: 'ADD_ENTITY', entity: 'checklistRunLinks', data: savedLink });
      }

      const duplicateKey = getChecklistSuggestionPackingItemKey(action, targetRun.id);
      const alreadyAccepted = duplicateKey
        ? checklistRunItems.some((item) => getChecklistSuggestionPackingItemKeyForItem(item) === duplicateKey)
        : false;
      if (alreadyAccepted) return;

      const nextSortOrder = Math.max(0, ...checklistRunItems.filter((item) => item.runId === targetRun.id).map((item) => item.sortOrder)) + 10;
      const packingItem = buildChecklistSuggestionPackingItem({
        action,
        runId: targetRun.id,
        materials,
        sortOrder: nextSortOrder,
        id: crypto.randomUUID(),
        now,
      });
      if (!packingItem) return;

      const savedItem = await repository.upsert<ChecklistRunItem>('checklistRunItems', packingItem);
      dispatch({ type: 'ADD_ENTITY', entity: 'checklistRunItems', data: savedItem });
      return;
    }

    if (!linkedCalculationId) return;
    const lineItem = buildChecklistSuggestionLineItem({
      action,
      calculationId: linkedCalculationId,
      materials,
      services,
      id: crypto.randomUUID(),
      now,
    });
    if (!lineItem) return;

    const duplicateKey = getChecklistSuggestionLineItemKey(action, linkedCalculationId);
    const alreadyAccepted = duplicateKey
      ? calculationLineItems.some((item) => getChecklistSuggestionLineItemKeyForItem(item) === duplicateKey)
      : false;
    if (alreadyAccepted) return;

    const saved = await repository.upsert<CalculationLineItem>('calculationLineItems', lineItem);
    dispatch({ type: 'ADD_ENTITY', entity: 'calculationLineItems', data: saved });
  };

  const updateChecklistRunItem = async (item: ChecklistRunItem, patch: Partial<Pick<ChecklistRunItem, 'status' | 'note' | 'selectedChoice'>>) => {
    const isCompletedStatus = patch.status === 'done' || patch.status === 'not_applicable';
    const updated: ChecklistRunItem = {
      ...item,
      ...patch,
      completedAt: isCompletedStatus ? new Date().toISOString() : patch.status ? null : item.completedAt,
      completedBy: isCompletedStatus ? 'manual' : patch.status ? null : item.completedBy,
      updatedAt: new Date().toISOString(),
    };
    const saved = await repository.upsert<ChecklistRunItem>('checklistRunItems', updated);
    dispatch({ type: 'UPDATE_ENTITY', entity: 'checklistRunItems', data: saved });
  };

  if (isLoading) {
    return <div className="container max-w-6xl mx-auto py-8 px-6">Anfrage-Detail wird geladen…</div>;
  }

  if (loadError || !inquiry) {
    return (
      <div className="container max-w-6xl mx-auto py-8 px-6 space-y-4">
        <Link to="/inquiries" className="text-sm text-blue-700 hover:text-blue-900 inline-flex items-center gap-2"><ArrowLeft size={14} /> Zurück zum Anfrage-Dashboard</Link>
        <div className="bg-white border rounded-xl p-6">
          <h1 className="text-2xl font-bold text-gray-900">Anfrage-Detail</h1>
          <p className="mt-2 text-gray-600">Diese Anfrage konnte nicht geladen werden.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-6xl mx-auto py-8 px-6 space-y-6">
      <header className="space-y-3">
        <Link to="/inquiries" className="text-sm text-blue-700 hover:text-blue-900 inline-flex items-center gap-2"><ArrowLeft size={14} /> Zurück zum Anfrage-Dashboard</Link>
        <div className="flex flex-wrap gap-4 justify-between items-start">
          <div>
            <p className="text-sm font-medium text-blue-700">Anfrage-Detail{inquiry.inquiryNumber ? ` · ${inquiry.inquiryNumber}` : ''}</p>
            <h1 className="text-3xl font-bold text-gray-900">{redactInquiryPriceText(inquiry.title)}</h1>
            <p className="mt-2 text-gray-600">{getInquirySourceLabel(inquiry.source)} · Eingang {new Date(inquiry.receivedAt).toLocaleDateString('de-DE')}</p>
          </div>
          <div className="flex flex-col gap-3 items-stretch sm:items-end">
            <Link to={`/inquiries?edit=${inquiry.id}`} className="inline-flex items-center justify-center rounded-lg bg-orange-600 px-3 py-2 text-sm font-semibold text-white hover:bg-orange-700">Bearbeiten</Link>
            <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-sm text-blue-800 max-w-sm">
              <strong>Keine Preise im Anfragedetail.</strong> Diese Ansicht bündelt Vorgang, Kommunikation, Anhänge, Links und fachlichen Umfang.
            </div>
          </div>
        </div>
      </header>

      <section className="grid lg:grid-cols-[1.2fr_0.8fr] gap-4">
        <Panel title="Kopfbereich" icon={<ClipboardList size={18} />}>
          <InfoRow label="Anfrage-Nr." value={inquiry.inquiryNumber || 'Noch keine'} />
          <InfoRow label="Status" value={inquiryStatusLabels[inquiry.status]} />
          <InfoRow label="Priorität" value={inquiry.priority} />
          <InfoRow label="Nächste Aktion" value={getInquiryNextAction(inquiry)} />
          <InfoRow label="Quelle" value={getInquirySourceLabel(inquiry.source)} />
          {inquiry.needsAttention && <p className="mt-3 inline-flex items-center gap-2 text-sm text-orange-700"><AlertTriangle size={14} /> Handlungsbedarf vorhanden</p>}
        </Panel>

        <Panel title="Kunde & Beteiligte" icon={<UserCircle size={18} />}>
          <InfoRow label="Absender" value={redactInquiryPriceText(inquiry.senderName || inquiry.senderEmail || 'Noch offen')} />
          <InfoRow label="Kunde" value={redactInquiryPriceText(customer?.name || 'Nicht zugeordnet')} />
          <InfoRow label="Standort" value={redactInquiryPriceText(location?.name || 'Nicht zugeordnet')} />
          <InfoRow label="Asset / HT" value={redactInquiryPriceText(asset?.name || 'Nicht zugeordnet')} />
        </Panel>
      </section>

      <section className="grid lg:grid-cols-2 gap-4">
        <Panel title="Kommunikation" icon={<Mail size={18} />}>
          <p className="text-sm font-medium text-gray-900">Originalkommunikation</p>
          <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{redactInquiryPriceText(inquiry.rawText || inquiry.summary || 'Noch kein Originaltext gespeichert.')}</p>
          <div className="mt-4 space-y-3">
            {packet.messages.map((message) => (
              <div key={message.id} className="rounded-lg border bg-gray-50 p-3 text-sm">
                <p className="font-medium text-gray-900">{redactInquiryPriceText(message.subject || 'Nachricht')}</p>
                <p className="mt-1 whitespace-pre-wrap text-gray-700">{redactInquiryPriceText(message.body)}</p>
              </div>
            ))}
            {packet.drafts.map((draft) => (
              <div key={draft.id} className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm">
                <p className="font-medium text-blue-900">Antwort-/Rückfrageentwurf: {redactInquiryPriceText(draft.subject)}</p>
                <p className="mt-1 whitespace-pre-wrap text-blue-800">{redactInquiryPriceText(draft.body)}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-gray-500">Keine automatische Versendung ohne Freigabe.</p>
        </Panel>

        <Panel title="Bilder & Anhänge" icon={<Image size={18} />}>
          {packet.attachments.length === 0 ? (
            <p className="text-sm text-gray-500">Noch keine Anhänge hinterlegt. V1 unterstützt lokale Dateien sowie SharePoint-, OneDrive- und externe Speicherziele über storageProvider und storageUrl.</p>
          ) : (
            <div className="space-y-3">
              {packet.attachments.map((attachment) => (
                <AttachmentCard key={attachment.id} attachment={attachment} />
              ))}
            </div>
          )}
        </Panel>
      </section>

      <section className="grid lg:grid-cols-2 gap-4">
        <Panel title="Fachliche Vorkonfiguration" icon={<Package size={18} />}>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{redactInquiryPriceText(inquiry.summary || 'Noch kein fachlicher Umfang hinterlegt.')}</p>
          <button type="button" className="mt-4 px-3 py-2 rounded-lg bg-green-600 text-white text-sm font-medium inline-flex items-center gap-2">
            <Send size={14} /> Ans Büro übergeben
          </button>
        </Panel>

        <Panel title="Verknüpfungen" icon={<Link2 size={18} />}>
          {packet.externalLinks.length === 0 ? (
            <p className="text-sm text-gray-500">Noch keine Verknüpfungen. Vorgesehen sind HWERP-Kunde, HWERP-Asset, HWERP-Kalkulation, Lexoffice, SharePoint, OneDrive und sonstige Links.</p>
          ) : (
            <div className="space-y-2">
              {packet.externalLinks.map((externalLink) => (
                <ExternalLinkCard key={externalLink.id} externalLink={externalLink} />
              ))}
            </div>
          )}
        </Panel>
      </section>

      <Panel title="Anfrage-Checklisten" icon={<CheckCircle2 size={18} />}>
        {categoryChecklistTemplates.length > 0 && (
          <button
            type="button"
            onClick={createCategoryChecklistRuns}
            className="mb-4 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Checklisten aus Kategorie erzeugen ({categoryChecklistTemplates.length})
          </button>
        )}
        {inquiryChecklistRuns.length === 0 ? (
          <p className="text-sm text-gray-500">Noch keine Checkliste mit dieser Anfrage verknüpft. Checklisten werden aus der Anfragekategorie als konkrete Läufe angelegt.</p>
        ) : (
          <div className="space-y-4">
            {inquiryChecklistRuns.map(({ run, items }) => (
              <ChecklistRunCard key={run.id} run={run} items={items} actions={checklistItemActions} services={services} materials={materials} templates={checklistTemplates} inquiryChecklistRuns={inquiryChecklistRunHeaders} linkedCalculationId={linkedCalculationId} packingListRunIds={packingListRuns.map((packingRun) => packingRun.id)} linkedWorkshopCardIds={linkedWorkshopCardIds} calculationLineItems={calculationLineItems} checklistRunItems={checklistRunItems} workshopCardTasks={workshopCardTasks} onAcceptSuggestion={acceptChecklistSuggestion} onUpdateItem={updateChecklistRunItem} />
            ))}
          </div>
        )}
      </Panel>

      <Panel title="Historie / Audit" icon={<ClipboardList size={18} />}>
        <div className="grid md:grid-cols-3 gap-3 text-sm">
          <InfoRow label="Erstellt" value={new Date(inquiry.createdAt).toLocaleString('de-DE')} />
          <InfoRow label="Aktualisiert" value={new Date(inquiry.updatedAt).toLocaleString('de-DE')} />
          <InfoRow label="Letzte Aktion" value={inquiry.lastActionAt ? new Date(inquiry.lastActionAt).toLocaleString('de-DE') : 'Noch keine'} />
        </div>
      </Panel>
    </div>
  );
}

function Panel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="bg-white border rounded-xl p-4">
      <h2 className="font-semibold text-gray-900 flex items-center gap-2">{icon} {title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function ChecklistRunCard({ run, items, actions, services, materials, templates, inquiryChecklistRuns, linkedCalculationId, packingListRunIds, linkedWorkshopCardIds, calculationLineItems, checklistRunItems, workshopCardTasks, onAcceptSuggestion, onUpdateItem }: { run: ChecklistRun; items: ChecklistRunItem[]; actions: ChecklistItemAction[]; services: Service[]; materials: Material[]; templates: ChecklistTemplate[]; inquiryChecklistRuns: ChecklistRun[]; linkedCalculationId: string | null; packingListRunIds: string[]; linkedWorkshopCardIds: string[]; calculationLineItems: CalculationLineItem[]; checklistRunItems: ChecklistRunItem[]; workshopCardTasks: WorkshopCardTask[]; onAcceptSuggestion: (action: ChecklistItemAction) => void; onUpdateItem: (item: ChecklistRunItem, patch: Partial<Pick<ChecklistRunItem, 'status' | 'note' | 'selectedChoice'>>) => void }) {
  const doneCount = items.filter((item) => item.status === 'done' || item.status === 'not_applicable').length;
  return (
    <div className="rounded-lg border border-gray-200">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
        <div>
          <p className="font-medium text-gray-900">{run.title}</p>
          <p className="text-xs text-gray-500">{doneCount}/{items.length} Punkte erledigt oder nicht zutreffend</p>
        </div>
        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">{run.status}</span>
      </div>
      <div className="divide-y divide-gray-100">
        {items.length === 0 ? (
          <p className="px-4 py-4 text-sm text-gray-500">Diese Checkliste hat noch keine Punkte.</p>
        ) : items.map((item) => (
          <ChecklistRunItemRow key={item.id} item={item} actions={actions} services={services} materials={materials} templates={templates} inquiryChecklistRuns={inquiryChecklistRuns} linkedCalculationId={linkedCalculationId} packingListRunIds={packingListRunIds} linkedWorkshopCardIds={linkedWorkshopCardIds} calculationLineItems={calculationLineItems} checklistRunItems={checklistRunItems} workshopCardTasks={workshopCardTasks} onAcceptSuggestion={onAcceptSuggestion} onUpdateItem={onUpdateItem} />
        ))}
      </div>
    </div>
  );
}

const statusOptions: Array<{ value: ChecklistRunItemStatus; label: string }> = [
  { value: 'open', label: 'offen' },
  { value: 'done', label: 'erledigt' },
  { value: 'not_applicable', label: 'trifft nicht zu' },
  { value: 'needs_clarification', label: 'Rückfrage nötig' },
  { value: 'blocked', label: 'blockiert' },
];

function ChecklistRunItemRow({ item, actions, services, materials, templates, inquiryChecklistRuns, linkedCalculationId, packingListRunIds, linkedWorkshopCardIds, calculationLineItems, checklistRunItems, workshopCardTasks, onAcceptSuggestion, onUpdateItem }: { item: ChecklistRunItem; actions: ChecklistItemAction[]; services: Service[]; materials: Material[]; templates: ChecklistTemplate[]; inquiryChecklistRuns: ChecklistRun[]; linkedCalculationId: string | null; packingListRunIds: string[]; linkedWorkshopCardIds: string[]; calculationLineItems: CalculationLineItem[]; checklistRunItems: ChecklistRunItem[]; workshopCardTasks: WorkshopCardTask[]; onAcceptSuggestion: (action: ChecklistItemAction) => void; onUpdateItem: (item: ChecklistRunItem, patch: Partial<Pick<ChecklistRunItem, 'status' | 'note' | 'selectedChoice'>>) => void }) {
  const statusIcon = item.status === 'done'
    ? <CheckCircle2 size={16} className="text-green-600" />
    : item.status === 'not_applicable'
      ? <XCircle size={16} className="text-gray-500" />
      : item.status === 'needs_clarification'
        ? <HelpCircle size={16} className="text-orange-600" />
        : <ClipboardList size={16} className="text-gray-400" />;
  const choiceOptions = item.responseType === 'yes_no' ? ['Ja', 'Nein'] : item.choiceOptions;
  const suggestionAnswer = item.selectedChoice ?? (item.status === 'done' ? 'yes' : item.status);
  const suggestions = item.templateItemId
    ? resolveChecklistItemSuggestions(item.templateItemId, suggestionAnswer, actions)
    : [];
  const suggestionLabel = (action: ChecklistItemAction): string => {
    if (action.actionType === 'suggest_material' || action.actionType === 'create_packing_item') {
      return materials.find((material) => material.id === action.targetId)?.name ?? action.targetId ?? 'Material noch offen';
    }
    if (action.actionType === 'suggest_checklist') {
      return templates.find((template) => template.id === action.targetId)?.name ?? action.targetId ?? 'Aufgabenliste noch offen';
    }
    if (action.actionType === 'suggest_service') {
      return services.find((service) => service.id === action.targetId)?.name ?? action.targetId ?? 'Leistung noch offen';
    }
    if (action.actionType === 'add_billing_note') {
      const payload = action.payload as { note?: unknown; label?: unknown; text?: unknown } | undefined;
      return [payload?.note, payload?.label, payload?.text, action.targetId]
        .find((value): value is string => typeof value === 'string' && value.trim().length > 0)
        ?.trim() ?? 'Abrechnungshinweis noch offen';
    }
    return (action.payload as { label?: string } | undefined)?.label || action.targetId || 'Vorschlag';
  };
  const suggestionKind = (action: ChecklistItemAction): string => {
    if (action.actionType === 'suggest_material') return 'Material';
    if (action.actionType === 'suggest_service') return 'Leistung';
    if (action.actionType === 'suggest_checklist') return 'Aufgabenliste';
    if (action.actionType === 'create_packing_item') return 'Rüstlistenpunkt';
    if (action.actionType === 'create_task') return 'Aufgabe';
    if (action.actionType === 'add_billing_note') return 'Abrechnungshinweis';
    return 'Hinweis';
  };
  const canAcceptSuggestion = (action: ChecklistItemAction): boolean => {
    if (action.actionType === 'create_task') return true;
    if (action.actionType === 'add_billing_note') {
      return Boolean(getChecklistSuggestionLineItemKey(action, linkedCalculationId ?? 'pending-calculation'));
    }
    return (
      action.actionType === 'suggest_material' || action.actionType === 'suggest_service' || action.actionType === 'create_packing_item' || action.actionType === 'suggest_checklist'
    ) && Boolean(action.targetId);
  };
  const isSuggestionTargetMissing = (action: ChecklistItemAction): boolean => {
    if (action.actionType === 'suggest_checklist') {
      return !templates.some((template) => template.id === action.targetId && template.status === 'active');
    }
    return (
      action.actionType === 'suggest_material' || action.actionType === 'suggest_service' || action.actionType === 'add_billing_note'
    ) && !linkedCalculationId;
  };
  const isSuggestionAccepted = (action: ChecklistItemAction): boolean => {
    if (action.actionType === 'suggest_checklist') {
      return isChecklistSuggestionAccepted(action, inquiryChecklistRuns);
    }
    if (action.actionType === 'create_task') {
      return linkedWorkshopCardIds.some((cardId) => {
        const key = getChecklistSuggestionWorkshopTaskKey(action, cardId);
        return key ? workshopCardTasks.some((task) => getChecklistSuggestionWorkshopTaskKeyForTask(task) === key) : false;
      });
    }
    if (action.actionType === 'create_packing_item') {
      return packingListRunIds.some((runId) => {
        const key = getChecklistSuggestionPackingItemKey(action, runId);
        return key ? checklistRunItems.some((runItem) => getChecklistSuggestionPackingItemKeyForItem(runItem) === key) : false;
      });
    }
    if (!linkedCalculationId) return false;
    const key = getChecklistSuggestionLineItemKey(action, linkedCalculationId);
    return key ? calculationLineItems.some((lineItem) => getChecklistSuggestionLineItemKeyForItem(lineItem) === key) : false;
  };

  return (
    <div className="space-y-3 px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-2">
          {statusIcon}
          <div className="min-w-0">
            <p className="font-medium text-gray-900">{item.title}</p>
            {item.description && <p className="mt-1 text-sm text-gray-600">{item.description}</p>}
            {item.groupTitleSnapshot && <p className="mt-1 text-xs text-gray-500">Gruppe: {item.groupTitleSnapshot}</p>}
          </div>
        </div>
        <select
          value={item.status}
          onChange={(event) => onUpdateItem(item, { status: event.target.value as ChecklistRunItemStatus })}
          className="rounded-lg border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
        >
          {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </div>

      {choiceOptions.length > 0 && (
        <label className="block text-sm font-medium text-gray-700">
          Auswahl
          <select
            value={item.selectedChoice ?? ''}
            onChange={(event) => onUpdateItem(item, { selectedChoice: event.target.value || null })}
            className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
          >
            <option value="">Bitte wählen</option>
            {choiceOptions.map((choice) => <option key={choice} value={choice}>{choice}</option>)}
          </select>
        </label>
      )}

      {suggestions.length > 0 && (
        <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-900">
          <p className="font-semibold">Vorschläge aus diesem Punkt</p>
          <ul className="mt-1 space-y-1">
            {suggestions.map(({ action }) => {
              const accepted = isSuggestionAccepted(action);
              const targetMissing = isSuggestionTargetMissing(action);
              return (
                <li key={action.id} className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-blue-700">{suggestionKind(action)}</span>
                  <span className="min-w-0 flex-1">{suggestionLabel(action)}</span>
                  {canAcceptSuggestion(action) && (
                    <button
                      type="button"
                      onClick={() => onAcceptSuggestion(action)}
                      disabled={targetMissing || accepted}
                      className="rounded-lg bg-blue-600 px-2 py-1 text-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                    >
                      {accepted ? 'Übernommen' : targetMissing ? (action.actionType === 'suggest_checklist' ? 'Checkliste fehlt' : 'Kalkulation fehlt') : 'Übernehmen'}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="mt-1 text-xs text-blue-700">Nur Vorschlag – es wird nichts automatisch erzeugt.</p>
        </div>
      )}

      <label className="block text-sm font-medium text-gray-700">
        Notiz
        <textarea
          value={item.note ?? ''}
          onChange={(event) => onUpdateItem(item, { note: event.target.value })}
          rows={2}
          placeholder="Notiz zum Prüfpunkt, z. B. warum trifft nicht zu"
          className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
        />
      </label>
    </div>
  );
}

function AttachmentCard({ attachment }: { attachment: InquiryAttachment }) {
  const safeHref = sanitizeInquiryHref(attachment.storageUrl);
  const content = (
    <>
      <FileText size={18} className="mt-0.5 text-gray-500" />
      <span className="min-w-0 flex-1">
        <span className="block font-medium text-gray-900 truncate">{redactInquiryPriceText(attachment.fileName)}</span>
        <span className="block text-xs text-gray-500">{storageProviderLabels[attachment.storageProvider]} · storageProvider: {attachment.storageProvider} · storageUrl</span>
      </span>
      {safeHref ? <Download size={16} className="text-gray-400" /> : <span className="text-xs text-gray-400">Link fehlt</span>}
    </>
  );

  if (!safeHref) {
    return <div className="flex items-start gap-3 rounded-lg border p-3 text-gray-600">{content}</div>;
  }

  return <a href={safeHref} className="flex items-start gap-3 rounded-lg border p-3 hover:bg-gray-50">{content}</a>;
}

function ExternalLinkCard({ externalLink }: { externalLink: InquiryExternalLink }) {
  const safeHref = sanitizeInquiryHref(externalLink.url);
  const meta = externalLink.targetId ? `Referenz: ${redactInquiryPriceText(externalLink.targetId)}` : safeHref ? 'Link hinterlegt' : 'Nur Referenz, kein Link hinterlegt';
  const content = (
    <>
      <span className="font-medium text-gray-900">{redactInquiryPriceText(externalLink.label)}</span>
      <span className="block text-xs text-gray-500">{linkKindLabels[externalLink.kind]} · {meta}</span>
    </>
  );

  if (!safeHref) {
    return <div className="block rounded-lg border p-3 text-sm text-gray-700">{content}</div>;
  }

  return <a href={safeHref} className="block rounded-lg border p-3 text-sm hover:bg-gray-50">{content}</a>;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="py-1.5 border-b last:border-b-0">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className="text-sm text-gray-900">{value}</p>
    </div>
  );
}
