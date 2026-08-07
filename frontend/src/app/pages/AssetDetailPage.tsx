import { useEffect, useState, useCallback } from 'react';
import type { ChangeEvent } from 'react';
import { useNavigate, useParams, useSearchParams, Link } from 'react-router';
import { X, Save, Info, Image, FileText, Upload, Trash2, History, Wrench, Link2 } from 'lucide-react';
import { useAppStore } from '../context/AppStoreContext';
import { usePriceVisibility } from '../context/PriceVisibilityContext';
import { AssetDocument, AssetDocumentKind, AssetHistoryEntry, AssetNode, Customer, Inquiry, InquiryScopeItem, Location, LocationCustomer, OilSystem, TrafoKind, WindingCount, WorkshopCard } from '../lib/types';
import { Tag } from '../types/tag';
import { uuid } from '../lib/utils';
import {
  filterLocationsForCustomer,
  resolveLocationForCustomerChange,
} from '../lib/assetAssignmentUtils';
import Tooltip from '../components/Tooltip';
import SearchableSelect from '../components/SearchableSelect';
import DevTooltip from '../components/DevTooltip';
import TagPicker from '../components/TagPicker';
import { AssetType, pgAssetTypeStore } from '../lib/assetTypeStorage';
import {
  isTransformerAssetType,
} from '../lib/assetTechnicalDataUtils';
import {
  getSelectOptionLabel,
  getSelectOptionsForList,
  optionMetadataFlag,
  type SelectOption,
} from '../lib/selectOptions';
import { useModalClose } from '../hooks/useModalClose';
import { formatCustomerAddress } from './customerAddress';

/**
 * AssetDetailPage - Fullscreen-Detailseite für Asset-Erstellung und -Bearbeitung
 *
 * Motivation: Komplexe Assets benötigen mehr Platz als Inline-Editor bietet.
 * Tab-System ermöglicht flexible Erweiterung je Asset-Klasse ohne aufgeblähtes Grundformular.
 *
 * URL-Struktur:
 * - /assets/new              → Neues Root-Asset
 * - /assets/new?parentId=X   → Neues Kind-Asset (Parent vorbefüllt)
 * - /assets/:id              → Bestehendes Asset bearbeiten
 *
 * Draft-Verhalten:
 * - /assets/new arbeitet mit Draft im lokalen State
 * - Erst bei "Speichern" wird persistiert (verhindert halbfertige Datensätze)
 * - createdAt/updatedAt werden beim Speichern gesetzt
 */

type TabId = 'master-data' | 'asset-images' | 'asset-documents' | 'asset-history' | 'asset-links' | string; // master-data immer vorhanden, dynamische als string

const systemAssetDocumentKindLabels: Record<string, string> = {
  transfer_receipt: 'Übernahmebeleg',
  photo: 'Foto',
};

function getAssetDocumentKindLabel(kind: AssetDocumentKind, selectOptions: SelectOption[] = []): string {
  return systemAssetDocumentKindLabels[kind] || getSelectOptionLabel(selectOptions, 'assetDocument.kind', kind) || kind;
}

const ASSET_DOCUMENT_TIMESTAMP_FORMATTER = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Datei konnte nicht gelesen werden.'));
    reader.readAsDataURL(file);
  });
}

function formatFileSize(size: unknown): string {
  if (typeof size !== 'number' || !Number.isFinite(size)) return '';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function getAssetDocumentFileName(document: AssetDocument): string {
  const metadataFileName = document.metadata?.fileName;
  return typeof metadataFileName === 'string' && metadataFileName.trim() ? metadataFileName : document.title;
}

function getAssetDocumentFileSize(document: AssetDocument): string {
  return formatFileSize(document.metadata?.fileSize);
}

function getAssetDocumentMetadataText(document: AssetDocument, key: string): string {
  const value = document.metadata?.[key];
  return typeof value === 'string' ? value : '';
}

function formatAssetDocumentTimestamp(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return ASSET_DOCUMENT_TIMESTAMP_FORMATTER.format(date);
}

function getAssetDocumentUploadTimestamp(document: AssetDocument): string {
  return getAssetDocumentMetadataText(document, 'uploadedAt') || document.createdAt;
}

function getAssetDocumentUploadedBy(document: AssetDocument): string {
  return getAssetDocumentMetadataText(document, 'uploadedBy') || '—';
}

function getAssetDocumentComment(document: AssetDocument): string {
  return getAssetDocumentMetadataText(document, 'comment');
}

function sortAssetDocumentsNewestFirst(documents: AssetDocument[]): AssetDocument[] {
  return [...documents].sort((left, right) => {
    const leftTime = Date.parse(getAssetDocumentUploadTimestamp(left)) || Date.parse(left.createdAt) || 0;
    const rightTime = Date.parse(getAssetDocumentUploadTimestamp(right)) || Date.parse(right.createdAt) || 0;
    return rightTime - leftTime;
  });
}

type AssetHistoryViewItem = {
  id: string;
  occurredAt: string;
  userName: string;
  category: 'Zuordnung' | 'Dokument' | 'Wartung';
  title: string;
  description: string;
  details?: string;
  icon: 'assignment' | 'document' | 'maintenance';
  linkTo?: string;
};

type AssetInquiryLinkViewItem = {
  id: string;
  inquiryId: string | null;
  inquiryNumber: string;
  title: string;
  linkedAt: string;
  status: 'Aktuell' | 'Historisch';
};

function formatNullableHistoryLabel(value: string | null | undefined): string {
  return value?.trim() || 'nicht zugeordnet';
}

function createAssignmentHistoryEntry(
  assetId: string,
  field: 'customerId' | 'locationId' | 'parentId',
  label: string,
  fromId: string | null,
  toId: string | null,
  fromLabel: string | null,
  toLabel: string | null,
  now: string,
  userName: string,
): AssetHistoryEntry {
  return {
    id: uuid(),
    assetId,
    eventType: 'assignment',
    occurredAt: now,
    userName,
    title: `${label} geändert`,
    description: `Von „${formatNullableHistoryLabel(fromLabel)}“ zu „${formatNullableHistoryLabel(toLabel)}“`,
    metadata: { field, fromId, toId, fromLabel, toLabel },
    createdAt: now,
    updatedAt: now,
  };
}

function historyTimestamp(value: string | null | undefined): number {
  return value ? Date.parse(value) || 0 : 0;
}

function getAssetHistoryEntryMetadataText(entry: AssetHistoryEntry, key: string): string {
  const value = entry.metadata?.[key];
  return typeof value === 'string' ? value : '';
}

export default function AssetDetailPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { state, dispatch, repository } = useAppStore();
  const { currentRole } = usePriceVisibility();

  // Draft-State für neues Asset
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState<string | null>(null);
  const [assetTypeId, setAssetTypeId] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [locationId, setLocationId] = useState<string | null>(null);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [customerAssetId, setCustomerAssetId] = useState('');
  const [internalAssetId, setInternalAssetId] = useState('');
  const [buildYear, setBuildYear] = useState('');
  const [totalWeight, setTotalWeight] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [typeModel, setTypeModel] = useState('');
  const [powerKva, setPowerKva] = useState('');
  const [trafoKind, setTrafoKind] = useState<TrafoKind | ''>('');
  const [oilSystem, setOilSystem] = useState<OilSystem | ''>('');
  const [windingCount, setWindingCount] = useState<WindingCount>('2w');
  const [secondaryVoltage1, setSecondaryVoltage1] = useState('');
  const [secondaryVoltage2, setSecondaryVoltage2] = useState('');
  const [secondaryVoltage3, setSecondaryVoltage3] = useState('');
  const [errors, setErrors] = useState<{ name?: string }>({});
  const [isDirty, setIsDirty] = useState(false);
  const [showDirtyWarning, setShowDirtyWarning] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [locationCustomers, setLocationCustomers] = useState<LocationCustomer[]>([]);
  const [assetTypes, setAssetTypes] = useState<AssetType[]>([]);
  const [assetDocuments, setAssetDocuments] = useState<AssetDocument[]>([]);
  const [assetHistoryEntries, setAssetHistoryEntries] = useState<AssetHistoryEntry[]>([]);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [inquiryScopeItems, setInquiryScopeItems] = useState<InquiryScopeItem[]>([]);
  const [selectOptions, setSelectOptions] = useState<SelectOption[]>([]);
  const [workshopCards, setWorkshopCards] = useState<WorkshopCard[]>([]);
  const [documentKind, setDocumentKind] = useState<AssetDocumentKind>('datasheet');
  const [assetImageUploadComment, setAssetImageUploadComment] = useState('');
  const [assetDocumentUploadComment, setAssetDocumentUploadComment] = useState('');
  const [isUploadingDocument, setIsUploadingDocument] = useState(false);
  const [documentMessage, setDocumentMessage] = useState<string | null>(null);
  const [documentCommentDrafts, setDocumentCommentDrafts] = useState<Record<string, string>>({});

  // Tab State
  const [activeTab, setActiveTab] = useState<TabId>('master-data');

  const assets = (state.assets as AssetNode[]) || [];
  const tags = (state.tags as Tag[]) || [];
  const isNew = !id;
  const existingAsset = id ? assets.find((a) => a.id === id) : null;

  useEffect(() => {
    let cancelled = false;

    async function loadAssignmentData() {
      try {
        const [
          customersData,
          locationsData,
          locationCustomersData,
          assetDocumentsData,
          assetHistoryEntriesData,
          inquiriesData,
          inquiryScopeItemsData,
          selectOptionsData,
          workshopCardsData,
        ] = await Promise.all([
          repository.list<Customer>('customers'),
          repository.list<Location>('locations'),
          repository.list<LocationCustomer>('locationCustomers'),
          repository.list<AssetDocument>('assetDocuments'),
          repository.list<AssetHistoryEntry>('assetHistoryEntries'),
          repository.list<Inquiry>('inquiries'),
          repository.list<InquiryScopeItem>('inquiryScopeItems'),
          repository.list<SelectOption>('selectOptions'),
          repository.list<WorkshopCard>('workshopCards'),
        ]);
        await pgAssetTypeStore.seedIfEmpty().catch(() => undefined);
        const assetTypesData = await pgAssetTypeStore.getAll().catch(() => [] as AssetType[]);

        if (!cancelled) {
          setCustomers(customersData);
          setLocations(locationsData);
          setLocationCustomers(locationCustomersData);
          setAssetDocuments(assetDocumentsData);
          setAssetHistoryEntries(assetHistoryEntriesData);
          setInquiries(inquiriesData);
          setInquiryScopeItems(inquiryScopeItemsData);
          setSelectOptions(selectOptionsData);
          setWorkshopCards(workshopCardsData);
          dispatch({ type: 'SET_ENTITIES', entity: 'assetDocuments', data: assetDocumentsData });
          dispatch({ type: 'SET_ENTITIES', entity: 'assetHistoryEntries', data: assetHistoryEntriesData });
          dispatch({ type: 'SET_ENTITIES', entity: 'inquiries', data: inquiriesData });
          dispatch({ type: 'SET_ENTITIES', entity: 'inquiryScopeItems', data: inquiryScopeItemsData });
          dispatch({ type: 'SET_ENTITIES', entity: 'selectOptions', data: selectOptionsData });
          setAssetTypes(assetTypesData.filter((type) => type.isActive));
        }
      } catch (error) {
        console.error('Failed to load asset assignment data:', error);
      }
    }

    loadAssignmentData();

    return () => {
      cancelled = true;
    };
  }, [repository, dispatch]);

  useEffect(() => {
    setDocumentCommentDrafts((current) => {
      const next: Record<string, string> = {};
      assetDocuments.forEach((document) => {
        next[document.id] = current[document.id] ?? getAssetDocumentComment(document);
      });
      return next;
    });
  }, [assetDocuments]);

  // Load asset data
  useEffect(() => {
    if (id) {
      // Edit mode: Lade bestehendes Asset
      if (existingAsset) {
        setName(existingAsset.name);
        setParentId(existingAsset.parentId || null);
        setAssetTypeId(existingAsset.assetTypeId || null);
        setCustomerId(existingAsset.customerId || null);
        setLocationId(existingAsset.locationId || null);
        setTagIds(existingAsset.tagIds || []);
        setNotes(existingAsset.notes || '');
        setCustomerAssetId(existingAsset.customerAssetId || '');
        setInternalAssetId(existingAsset.internalAssetId || '');
        setBuildYear(existingAsset.buildYear?.toString() || '');
        setTotalWeight(existingAsset.totalWeight?.toString() || '');
        setManufacturer(existingAsset.manufacturer || '');
        setSerialNumber(existingAsset.serialNumber || '');
        setTypeModel(existingAsset.typeModel || '');
        setPowerKva(existingAsset.powerKva?.toString() || '');
        setTrafoKind(existingAsset.trafoKind || '');
        setOilSystem(existingAsset.oilSystem || '');
        setWindingCount(existingAsset.windingCount || '2w');
        setSecondaryVoltage1(existingAsset.secondaryVoltage1 || '');
        setSecondaryVoltage2(existingAsset.secondaryVoltage2 || '');
        setSecondaryVoltage3(existingAsset.secondaryVoltage3 || '');
        setIsLoading(false);
      } else {
        // Asset nicht gefunden
        navigate('/assets');
      }
    } else {
      // New mode: Prüfe, ob parentId im Query-String
      setAssetTypeId(null);
      setCustomerId(null);
      setLocationId(null);
      setTrafoKind('');
      setOilSystem('');
      setWindingCount('2w');
      setSecondaryVoltage1('');
      setSecondaryVoltage2('');
      setSecondaryVoltage3('');
      const parentIdParam = searchParams.get('parentId');
      if (parentIdParam) {
        setParentId(parentIdParam);
      }
      setIsLoading(false);
    }
  }, [id, existingAsset, navigate, searchParams]);

  // Datenmodul-Tabs über Assettyp/Fachdaten, nicht mehr über normale Tags.
  const selectedAssetType = assetTypes.find((type) => type.id === assetTypeId) || null;
  const transformerSelected = isTransformerAssetType(selectedAssetType);
  const dynamicTabs = [
    ...(transformerSelected ? [{ tabId: 'trafo-data', tabLabel: 'Trafo-Daten' }] : []),
    { tabId: 'asset-images', tabLabel: 'Bilder' },
    { tabId: 'asset-documents', tabLabel: 'Dokumente' },
    { tabId: 'asset-history', tabLabel: 'Historie' },
    { tabId: 'asset-links', tabLabel: 'Verknüpfungen' },
  ];
  const trafoKindOptions = getSelectOptionsForList(selectOptions, 'asset.trafoKind');
  const oilSystemOptions = getSelectOptionsForList(selectOptions, 'asset.oilSystem');
  const windingCountOptions = getSelectOptionsForList(selectOptions, 'asset.windingCount');
  const assetDocumentKindOptions = getSelectOptionsForList(selectOptions, 'assetDocument.kind');
  const showOilSystemForSelectedKind = optionMetadataFlag(selectOptions, 'asset.trafoKind', trafoKind, 'showOilSystem') || trafoKind === 'oil';
  const showSecondaryVoltagesForSelectedWinding = optionMetadataFlag(selectOptions, 'asset.windingCount', windingCount, 'showSecondaryVoltages') || windingCount === '3w';

  // Handler: Field changes
  const handleNameChange = (value: string) => {
    setName(value);
    setIsDirty(true);
    if (errors.name) {
      setErrors({ ...errors, name: undefined });
    }
  };

  const handleParentChange = (value: string) => {
    setParentId(value || null);
    setIsDirty(true);
  };

  const handleAssetTypeChange = (value: string | null) => {
    setAssetTypeId(value || null);
    const nextType = assetTypes.find((type) => type.id === value) || null;
    if (activeTab === 'trafo-data' && !isTransformerAssetType(nextType)) {
      setActiveTab('master-data');
    }
    setIsDirty(true);
  };

  const markDirty = () => setIsDirty(true);

  const handleTagsChange = (newTagIds: string[]) => {
    setTagIds(newTagIds);
    setIsDirty(true);
  };

  const handleNotesChange = (value: string) => {
    setNotes(value);
    setIsDirty(true);
  };

  const handleCustomerAssetIdChange = (value: string) => {
    setCustomerAssetId(value);
    setIsDirty(true);
  };

  const handleInternalAssetIdChange = (value: string) => {
    setInternalAssetId(value);
    setIsDirty(true);
  };

  const handleBuildYearChange = (value: string) => {
    setBuildYear(value);
    setIsDirty(true);
  };

  const handleTotalWeightChange = (value: string) => {
    setTotalWeight(value);
    setIsDirty(true);
  };

  const handleManufacturerChange = (value: string) => {
    setManufacturer(value);
    setIsDirty(true);
  };

  const handleSerialNumberChange = (value: string) => {
    setSerialNumber(value);
    setIsDirty(true);
  };

  const handleAssetDocumentUpload = async (
    event: ChangeEvent<HTMLInputElement>,
    kind: AssetDocumentKind,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !id) return;

    setIsUploadingDocument(true);
    setDocumentMessage(null);

    try {
      const now = new Date().toISOString();
      const uploadComment = (kind === 'photo' ? assetImageUploadComment : assetDocumentUploadComment).trim();
      const fileUrl = await readFileAsDataUrl(file);
      const document: AssetDocument = {
        id: uuid(),
        assetId: id,
        kind,
        sourceEntityType: 'asset',
        sourceEntityId: id,
        title: file.name,
        documentNumber: null,
        status: 'uploaded',
        fileUrl,
        metadata: {
          fileName: file.name,
          mimeType: file.type || null,
          fileSize: file.size,
          uploadedAt: now,
          uploadedBy: currentRole,
          comment: uploadComment,
        },
        createdAt: now,
        updatedAt: now,
      };
      const saved = await repository.create<AssetDocument>('assetDocuments', document);
      setAssetDocuments((current) => [...current, saved]);
      dispatch({ type: 'ADD_ENTITY', entity: 'assetDocuments', data: saved });

      const historyEntry: AssetHistoryEntry = {
        id: uuid(),
        assetId: id,
        eventType: 'document',
        occurredAt: now,
        userName: currentRole,
        title: kind === 'photo' ? 'Foto hinzugefügt' : 'Dokument hinzugefügt',
        description: `${getAssetDocumentKindLabel(kind, selectOptions)} · ${file.name}`,
        metadata: {
          documentId: saved.id,
          kind,
          kindLabel: getAssetDocumentKindLabel(kind, selectOptions),
          fileName: file.name,
          comment: uploadComment,
        },
        createdAt: now,
        updatedAt: now,
      };
      const savedHistoryEntry = await repository.create<AssetHistoryEntry>('assetHistoryEntries', historyEntry);
      setAssetHistoryEntries((current) => [savedHistoryEntry, ...current]);
      dispatch({ type: 'ADD_ENTITY', entity: 'assetHistoryEntries', data: savedHistoryEntry });

      if (kind === 'photo') {
        setAssetImageUploadComment('');
      } else {
        setAssetDocumentUploadComment('');
      }
      setDocumentMessage(`✓ ${file.name} gespeichert.`);
    } catch (error) {
      console.error('Failed to save asset document:', error);
      setDocumentMessage('Fehler beim Speichern der Datei.');
    } finally {
      setIsUploadingDocument(false);
    }
  };

  const handleDeleteAssetDocument = async (documentId: string) => {
    try {
      await repository.delete('assetDocuments', documentId);
      setAssetDocuments((current) => current.filter((document) => document.id !== documentId));
      dispatch({ type: 'DELETE_ENTITY', entity: 'assetDocuments', id: documentId });
      setDocumentMessage('✓ Eintrag gelöscht.');
    } catch (error) {
      console.error('Failed to delete asset document:', error);
      setDocumentMessage('Fehler beim Löschen des Eintrags.');
    }
  };

  const handleAssetDocumentCommentChange = (documentId: string, comment: string) => {
    setDocumentCommentDrafts((current) => ({ ...current, [documentId]: comment }));
  };

  const handleSaveAssetDocumentComment = async (document: AssetDocument) => {
    const now = new Date().toISOString();
    const comment = (documentCommentDrafts[document.id] ?? '').trim();
    const updatedDocument: AssetDocument = {
      ...document,
      metadata: {
        ...document.metadata,
        comment,
        commentUpdatedAt: now,
        commentUpdatedBy: currentRole,
      },
      updatedAt: now,
    };

    try {
      const saved = await repository.update<AssetDocument>('assetDocuments', document.id, updatedDocument);
      setAssetDocuments((current) => current.map((item) => (item.id === saved.id ? saved : item)));
      dispatch({ type: 'UPDATE_ENTITY', entity: 'assetDocuments', data: saved });
      setDocumentMessage('✓ Kommentar gespeichert.');
    } catch (error) {
      console.error('Failed to save asset document comment:', error);
      setDocumentMessage('Fehler beim Speichern des Kommentars.');
    }
  };

  // Validation
  const validate = (): boolean => {
    const newErrors: { name?: string } = {};

    if (!name.trim()) {
      newErrors.name = 'Name ist erforderlich';
    }

    // Prüfe auf Zirkelbezug (Parent darf nicht selbst oder Nachfahre sein)
    if (parentId && id) {
      if (parentId === id) {
        newErrors.name = 'Asset kann nicht sein eigener Parent sein';
      } else {
        // Prüfe, ob parentId ein Nachfahre ist
        const isDescendant = (nodeId: string, targetId: string): boolean => {
          const node = assets.find((a) => a.id === nodeId);
          if (!node || !node.parentId) return false;
          if (node.parentId === targetId) return true;
          return isDescendant(node.parentId, targetId);
        };
        if (isDescendant(parentId, id)) {
          newErrors.name = 'Zirkelbezug: Parent darf kein Nachfahre sein';
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Save
  const handleSave = async () => {
    if (!validate()) return;

    setIsSaving(true);
    try {
      const now = new Date().toISOString();

      // Helper: Parse number from string, return undefined if empty/invalid
      const parseNumber = (value: string): number | undefined => {
        const trimmed = value.trim();
        if (!trimmed) return undefined;
        const parsed = Number(trimmed);
        return isNaN(parsed) ? undefined : parsed;
      };

      const transformerFields = transformerSelected
        ? {
            typeModel: typeModel.trim() || undefined,
            powerKva: parseNumber(powerKva),
            trafoKind: trafoKind || undefined,
            oilSystem: showOilSystemForSelectedKind ? oilSystem || undefined : undefined,
            windingCount: windingCount || '2w',
            secondaryVoltage1: showSecondaryVoltagesForSelectedWinding ? secondaryVoltage1.trim() || undefined : undefined,
            secondaryVoltage2: showSecondaryVoltagesForSelectedWinding ? secondaryVoltage2.trim() || undefined : undefined,
            secondaryVoltage3: showSecondaryVoltagesForSelectedWinding ? secondaryVoltage3.trim() || undefined : undefined,
          }
        : {
            typeModel: typeModel.trim() || undefined,
            powerKva: parseNumber(powerKva),
            trafoKind: undefined,
            oilSystem: undefined,
            windingCount: undefined,
            secondaryVoltage1: undefined,
            secondaryVoltage2: undefined,
            secondaryVoltage3: undefined,
          };

      const assetData: AssetNode = {
        id: id || uuid(),
        name: name.trim(),
        parentId: parentId || null,
        assetTypeId: assetTypeId || null,
        customerId: customerId || null,
        locationId: locationId || null,
        tagIds,
        notes: notes.trim() || undefined,
        customerAssetId: customerAssetId.trim() || undefined,
        internalAssetId: internalAssetId.trim() || undefined,
        buildYear: parseNumber(buildYear),
        totalWeight: parseNumber(totalWeight),
        manufacturer: manufacturer.trim() || undefined,
        serialNumber: serialNumber.trim() || undefined,
        ...transformerFields,
        createdAt: existingAsset?.createdAt || now,
        updatedAt: now,
      };

      const resolveCustomerName = (value: string | null) => value ? customers.find((customer) => customer.id === value)?.name || value : null;
      const resolveLocationName = (value: string | null) => value ? locations.find((location) => location.id === value)?.name || value : null;
      const resolveParentAssetName = (value: string | null) => value ? assets.find((asset) => asset.id === value)?.name || value : null;
      const previousCustomerId = existingAsset?.customerId ?? null;
      const previousLocationId = existingAsset?.locationId ?? null;
      const previousParentId = existingAsset?.parentId ?? null;
      const assignmentHistoryEntries = [
        previousCustomerId !== assetData.customerId && (!isNew || Boolean(assetData.customerId))
          ? createAssignmentHistoryEntry(assetData.id, 'customerId', 'Kundenzuordnung', previousCustomerId, assetData.customerId, resolveCustomerName(previousCustomerId), resolveCustomerName(assetData.customerId), now, currentRole)
          : null,
        previousLocationId !== assetData.locationId && (!isNew || Boolean(assetData.locationId))
          ? createAssignmentHistoryEntry(assetData.id, 'locationId', 'Standortzuordnung', previousLocationId, assetData.locationId, resolveLocationName(previousLocationId), resolveLocationName(assetData.locationId), now, currentRole)
          : null,
        previousParentId !== assetData.parentId && (!isNew || Boolean(assetData.parentId))
          ? createAssignmentHistoryEntry(assetData.id, 'parentId', 'Asset-Zuordnung', previousParentId, assetData.parentId, resolveParentAssetName(previousParentId), resolveParentAssetName(assetData.parentId), now, currentRole)
          : null,
      ].filter((entry): entry is AssetHistoryEntry => Boolean(entry));

      const saved = await repository.upsert<AssetNode>('assets', assetData);

      if (isNew) {
        dispatch({ type: 'ADD_ENTITY', entity: 'assets', data: saved });
      } else {
        dispatch({ type: 'UPDATE_ENTITY', entity: 'assets', data: saved });
      }

      if (assignmentHistoryEntries.length > 0) {
        const savedEntries = await Promise.all(
          assignmentHistoryEntries.map((entry) => repository.create<AssetHistoryEntry>('assetHistoryEntries', entry)),
        );
        setAssetHistoryEntries((current) => [...savedEntries, ...current]);
        savedEntries.forEach((entry) => dispatch({ type: 'ADD_ENTITY', entity: 'assetHistoryEntries', data: entry }));
      }

      navigate('/assets');
    } catch (error) {
      console.error('Failed to save asset:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // Cancel
  const handleCancel = () => {
    if (isDirty) {
      setShowDirtyWarning(true);
    } else {
      navigate('/assets');
    }
  };

  const confirmCancel = () => {
    navigate('/assets');
  };

  const handleCloseDirtyWarning = useCallback(() => setShowDirtyWarning(false), []);
  const handleDirtyWarningBackdropClick = useModalClose(showDirtyWarning, handleCloseDirtyWarning);

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <h1 className="text-xl">Asset laden...</h1>
      </div>
    );
  }

  // Parent-Optionen (alle Assets außer dem aktuellen Asset und dessen Nachfahren)
  const getParentOptions = (): AssetNode[] => {
    if (!id) return assets; // Bei neuem Asset: alle Assets erlaubt

    // Bei Edit: Entferne das Asset selbst und alle Nachfahren
    const descendants = new Set<string>();
    const findDescendants = (nodeId: string) => {
      descendants.add(nodeId);
      assets
        .filter((a) => a.parentId === nodeId)
        .forEach((child) => findDescendants(child.id));
    };
    findDescendants(id);

    return assets.filter((a) => !descendants.has(a.id));
  };

  const parentOptions = getParentOptions();
  const filteredLocations = filterLocationsForCustomer(locations, locationCustomers, customerId);
  const currentAssetDocuments = id
    ? sortAssetDocumentsNewestFirst(assetDocuments.filter((document) => document.assetId === id))
    : [];
  const imageDocuments = currentAssetDocuments.filter((document) => document.kind === 'photo');
  const nonImageDocuments = currentAssetDocuments.filter((document) => document.kind !== 'photo');
  const persistedHistoryItems: AssetHistoryViewItem[] = assetHistoryEntries
    .filter((entry) => entry.assetId === id)
    .map((entry) => ({
      id: entry.id,
      occurredAt: entry.occurredAt || entry.createdAt,
      userName: entry.userName || getAssetHistoryEntryMetadataText(entry, 'uploadedBy') || '—',
      category: entry.eventType === 'maintenance' ? 'Wartung' : entry.eventType === 'document' ? 'Dokument' : 'Zuordnung',
      title: entry.title,
      description: entry.description || '',
      details: entry.eventType === 'document'
        ? [
            getAssetHistoryEntryMetadataText(entry, 'kindLabel'),
            getAssetHistoryEntryMetadataText(entry, 'comment') ? `Kommentar: ${getAssetHistoryEntryMetadataText(entry, 'comment')}` : '',
          ].filter(Boolean).join(' · ')
        : getAssetHistoryEntryMetadataText(entry, 'inquiryNumber') || getAssetHistoryEntryMetadataText(entry, 'inquiryTitle')
          ? [getAssetHistoryEntryMetadataText(entry, 'inquiryNumber'), getAssetHistoryEntryMetadataText(entry, 'inquiryTitle')].filter(Boolean).join(' · ')
          : undefined,
      icon: entry.eventType === 'maintenance' ? 'maintenance' : entry.eventType === 'document' ? 'document' : 'assignment',
      linkTo: getAssetHistoryEntryMetadataText(entry, 'inquiryId') ? `/inquiries/${getAssetHistoryEntryMetadataText(entry, 'inquiryId')}` : undefined,
    }));
  const documentHistoryIds = new Set(
    assetHistoryEntries
      .filter((entry) => entry.assetId === id && entry.eventType === 'document')
      .map((entry) => getAssetHistoryEntryMetadataText(entry, 'documentId'))
      .filter(Boolean),
  );
  const legacyDocumentHistoryItems: AssetHistoryViewItem[] = nonImageDocuments
    .filter((document) => !documentHistoryIds.has(document.id))
    .map((document) => ({
      id: `document-${document.id}`,
      occurredAt: getAssetDocumentUploadTimestamp(document),
      userName: getAssetDocumentUploadedBy(document),
      category: 'Dokument',
      title: 'Dokument hinzugefügt',
      description: `${getAssetDocumentKindLabel(document.kind, selectOptions)} · ${getAssetDocumentFileName(document)}`,
      details: getAssetDocumentComment(document) ? `Kommentar: ${getAssetDocumentComment(document)}` : undefined,
      icon: 'document',
    }));
  const maintenanceHistoryItems: AssetHistoryViewItem[] = workshopCards
    .filter((card) => card.assetId === id && (card.status === 'done' || card.status === 'checked'))
    .map((card) => ({
      id: `workshop-card-${card.id}`,
      occurredAt: card.updatedAt || card.createdAt,
      userName: card.assigneeCodes.length > 0 ? card.assigneeCodes.join(', ') : '—',
      category: 'Wartung',
      title: 'Wartung ausgeführt',
      description: `${card.cardNumber} · ${card.title}`,
      details: card.status === 'checked' ? 'Status: geprüft' : 'Status: fertig',
      icon: 'maintenance',
    }));
  const assetHistoryItems = [...persistedHistoryItems, ...legacyDocumentHistoryItems, ...maintenanceHistoryItems]
    .sort((left, right) => historyTimestamp(right.occurredAt) - historyTimestamp(left.occurredAt));

  const currentInquiryIds = new Set<string>([
    ...inquiries.filter((inquiry) => inquiry.assetId === id).map((inquiry) => inquiry.id),
    ...inquiryScopeItems
      .filter((item) => item.kind === 'asset_section' && item.assetId === id && item.inquiryId)
      .map((item) => item.inquiryId as string),
  ]);
  const inquiryLinkMap = new Map<string, AssetInquiryLinkViewItem>();
  inquiries
    .filter((inquiry) => currentInquiryIds.has(inquiry.id))
    .forEach((inquiry) => {
      inquiryLinkMap.set(inquiry.id, {
        id: inquiry.id,
        inquiryId: inquiry.id,
        inquiryNumber: inquiry.inquiryNumber || 'Ohne Nr.',
        title: inquiry.title,
        linkedAt: inquiry.updatedAt || inquiry.createdAt,
        status: 'Aktuell',
      });
    });
  assetHistoryEntries
    .filter((entry) => entry.assetId === id && entry.metadata?.source === 'inquiry')
    .forEach((entry) => {
      const inquiryId = getAssetHistoryEntryMetadataText(entry, 'inquiryId') || null;
      const existing = inquiryId ? inquiryLinkMap.get(inquiryId) : null;
      if (existing) {
        inquiryLinkMap.set(inquiryId, { ...existing, linkedAt: entry.occurredAt || existing.linkedAt });
        return;
      }
      const mapKey = inquiryId || entry.id;
      inquiryLinkMap.set(mapKey, {
        id: entry.id,
        inquiryId,
        inquiryNumber: getAssetHistoryEntryMetadataText(entry, 'inquiryNumber') || 'Ohne Nr.',
        title: getAssetHistoryEntryMetadataText(entry, 'inquiryTitle') || entry.title,
        linkedAt: entry.occurredAt || entry.createdAt,
        status: 'Historisch',
      });
    });
  const assetInquiryLinks = Array.from(inquiryLinkMap.values())
    .sort((left, right) => historyTimestamp(right.linkedAt) - historyTimestamp(left.linkedAt));

  const handleCustomerChange = (newCustomerId: string | null) => {
    const nextCustomerId = newCustomerId || null;
    setCustomerId(nextCustomerId);
    setLocationId(resolveLocationForCustomerChange(nextCustomerId, locationId, locationCustomers));
    setIsDirty(true);
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">
            {isNew ? 'Asset erstellen' : 'Asset bearbeiten'}
          </h1>
          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              <Save size={20} />
              {isSaving ? 'Speichern...' : 'Speichern'}
            </button>
            <button
              onClick={handleCancel}
              disabled={isSaving}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Abbrechen
            </button>
            <Link
              to="/assets"
              className="text-gray-600 hover:text-gray-800 transition-colors"
            >
              <X size={24} />
            </Link>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 px-6">
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {/* Stammdaten Tab (immer vorhanden) */}
            <button
              onClick={() => setActiveTab('master-data')}
              className={`px-4 py-3 font-medium transition-colors border-b-2 ${
                activeTab === 'master-data'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-800'
              }`}
            >
              Stammdaten
            </button>

            {/* Dynamische Tabs */}
            {dynamicTabs.map((tab) => (
              <button
                key={tab.tabId}
                onClick={() => setActiveTab(tab.tabId)}
                className={`px-4 py-3 font-medium transition-colors border-b-2 ${
                  activeTab === tab.tabId
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-800'
                }`}
              >
                {tab.tabLabel}
              </button>
            ))}
          </div>

          {/* Dev-Tooltip für Tab-System */}
          <DevTooltip
            text="Tabs kommen künftig aus Assettyp/Datenmodulen. Normale Tags bleiben reine Such- und Filterlabels."
            placement="right"
          />
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto">
          {/* Stammdaten Tab */}
          {activeTab === 'master-data' && (
            <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-6">
              {/* Name */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                    Name <span className="text-red-500">*</span>
                  </label>
                </div>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    errors.name ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="z.B. Trafo 1, Schaltanlage Halle A"
                  autoFocus
                />
                {errors.name && (
                  <p className="mt-1 text-sm text-red-600">{errors.name}</p>
                )}
              </div>

              {/* Parent */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <label htmlFor="parent" className="block text-sm font-medium text-gray-700">
                    Parent (optional)
                  </label>
                  <Tooltip
                    text="Übergeordnetes Asset (optional). Damit kannst du eine Hierarchie aufbauen."
                    placement="right"
                  />
                </div>
                <SearchableSelect
                  value={parentId}
                  onChange={(id) => { setParentId(id); setIsDirty(true); }}
                  options={parentOptions.map((a) => ({ id: a.id, label: a.name }))}
                  placeholder="Kein Parent (Root-Asset)"
                  emptyOptionLabel="Kein Parent (Root-Asset)"
                  searchPlaceholder="Asset suchen..."
                />
              </div>

              {/* Asset type */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Assettyp
                  </label>
                  <Tooltip
                    text="Hauptkategorie des Assets. Der Assettyp aktiviert fachliche Datenmodule wie Trafo-Daten; Tags bleiben reine Labels/Filter."
                    placement="right"
                  />
                </div>
                <SearchableSelect
                  id="assetTypeId"
                  value={assetTypeId}
                  onChange={handleAssetTypeChange}
                  options={assetTypes.map((type) => ({
                    id: type.id,
                    label: type.label,
                    sublabel: [type.short, type.code].filter(Boolean).join(' · '),
                  }))}
                  placeholder="Kein Assettyp gewählt"
                  emptyOptionLabel="Kein Assettyp gewählt"
                  searchPlaceholder="Assettyp suchen..."
                />
              </div>

              {/* Customer assignment */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Kunde
                  </label>
                  <Tooltip
                    text="Ordnet das Asset direkt einem Kunden zu. Das ist getrennt von der Kunden-Asset-ID."
                    placement="right"
                  />
                </div>
                <SearchableSelect
                  value={customerId}
                  onChange={handleCustomerChange}
                  options={customers.map((customer) => ({
                    id: customer.id,
                    label: customer.name,
                    sublabel: formatCustomerAddress(customer) || undefined,
                  }))}
                  placeholder="Kein Kunde zugeordnet"
                  emptyOptionLabel="Kein Kunde zugeordnet"
                  searchPlaceholder="Kunde suchen..."
                />
              </div>

              {/* Location assignment */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Standort
                  </label>
                  <Tooltip
                    text="Standort des gewählten Kunden. Wenn der Kunde geändert wird, wird ein unpassender Standort automatisch entfernt."
                    placement="right"
                  />
                </div>
                <SearchableSelect
                  value={locationId}
                  onChange={(id) => {
                    setLocationId(id || null);
                    setIsDirty(true);
                  }}
                  options={filteredLocations.map((location) => ({
                    id: location.id,
                    label: location.name,
                    sublabel: location.addressLine || undefined,
                  }))}
                  placeholder={customerId ? 'Kein Standort zugeordnet' : 'Bitte zuerst Kunde wählen'}
                  emptyOptionLabel="Kein Standort zugeordnet"
                  searchPlaceholder="Standort suchen..."
                />
              </div>

              {/* Tags */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Tags
                  </label>
                  <Tooltip
                    text="Flexible Labels und Suchfilter. Fachliche Zusatzbereiche werden über Assettyp/Datenmodule gesteuert, nicht über Tags."
                    placement="right"
                  />
                  <DevTooltip
                    text="Tags sind managed (tagIds). Vorschläge/Sperren werden zentral in der Tag-Verwaltung gesteuert."
                    placement="right"
                  />
                </div>
                <TagPicker
                  selectedTagIds={tagIds}
                  onChange={handleTagsChange}
                  context="ASSETS"
                  displayMode="name"
                  showTooltip={false}
                />
              </div>

              {/* Notes */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <label htmlFor="notes" className="block text-sm font-medium text-gray-700">
                    Notizen
                  </label>
                </div>
                <textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => handleNotesChange(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Optionale Notizen..."
                />
              </div>

              {/* Customer Asset ID */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <label htmlFor="customerAssetId" className="block text-sm font-medium text-gray-700">
                    Kunden-Asset-ID (Nummer beim Kunden)
                  </label>
                </div>
                <input
                  id="customerAssetId"
                  type="text"
                  value={customerAssetId}
                  onChange={(e) => handleCustomerAssetIdChange(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="z.B. 12345"
                />
              </div>

              {/* Internal Asset ID */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <label htmlFor="internalAssetId" className="block text-sm font-medium text-gray-700">
                    Interne Asset-ID
                  </label>
                </div>
                <input
                  id="internalAssetId"
                  type="text"
                  value={internalAssetId}
                  onChange={(e) => handleInternalAssetIdChange(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="z.B. 12345"
                />
              </div>

              {/* Build Year */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <label htmlFor="buildYear" className="block text-sm font-medium text-gray-700">
                    Baujahr
                  </label>
                </div>
                <input
                  id="buildYear"
                  type="text"
                  value={buildYear}
                  onChange={(e) => handleBuildYearChange(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="z.B. 2020"
                />
              </div>

              {/* Total Weight */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <label htmlFor="totalWeight" className="block text-sm font-medium text-gray-700">
                    Gesamtgewicht
                  </label>
                </div>
                <input
                  id="totalWeight"
                  type="text"
                  value={totalWeight}
                  onChange={(e) => handleTotalWeightChange(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="z.B. 1000 kg"
                />
              </div>

              {/* Manufacturer */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <label htmlFor="manufacturer" className="block text-sm font-medium text-gray-700">
                    Hersteller
                  </label>
                </div>
                <input
                  id="manufacturer"
                  type="text"
                  value={manufacturer}
                  onChange={(e) => handleManufacturerChange(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="z.B. Siemens"
                />
              </div>

              {/* Serial Number */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <label htmlFor="serialNumber" className="block text-sm font-medium text-gray-700">
                    Seriennummer
                  </label>
                </div>
                <input
                  id="serialNumber"
                  type="text"
                  value={serialNumber}
                  onChange={(e) => handleSerialNumberChange(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="z.B. 123456789"
                />
              </div>
            </div>
          )}

          {/* Dynamische Datenmodule */}
          {activeTab === 'trafo-data' && (
            <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-6">
              <div className="flex items-center gap-2">
                <Info size={20} className="text-blue-500" />
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Trafo-Daten</h2>
                  <p className="text-sm text-gray-600">
                    Bauart und Ausführung werden als strukturierte Eigenschaften gespeichert, damit Suche, Filter und Marktvergleich darauf zugreifen können.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="typeModel" className="block text-sm font-medium text-gray-700 mb-2">
                    Typ / Modell
                  </label>
                  <input
                    id="typeModel"
                    type="text"
                    value={typeModel}
                    onChange={(event) => { setTypeModel(event.target.value); markDirty(); }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="z.B. DTTH 630"
                  />
                </div>

                <div>
                  <label htmlFor="powerKva" className="block text-sm font-medium text-gray-700 mb-2">
                    Leistung (kVA)
                  </label>
                  <input
                    id="powerKva"
                    type="number"
                    value={powerKva}
                    onChange={(event) => { setPowerKva(event.target.value); markDirty(); }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="z.B. 630"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="trafoKind" className="block text-sm font-medium text-gray-700 mb-2">
                  Bauart
                </label>
                <select
                  id="trafoKind"
                  value={trafoKind}
                  onChange={(event) => {
                    const nextKind = event.target.value as TrafoKind | '';
                    setTrafoKind(nextKind);
                    if (nextKind !== 'oil') setOilSystem('');
                    markDirty();
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Nicht angegeben</option>
                  {trafoKindOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>

              {showOilSystemForSelectedKind && (
                <div>
                  <label htmlFor="oilSystem" className="block text-sm font-medium text-gray-700 mb-2">
                    Ölsystem
                  </label>
                  <select
                    id="oilSystem"
                    value={oilSystem}
                    onChange={(event) => { setOilSystem(event.target.value as OilSystem | ''); markDirty(); }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Nicht angegeben</option>
                    {oilSystemOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label htmlFor="windingCount" className="block text-sm font-medium text-gray-700 mb-2">
                  Wicklungen
                </label>
                <select
                  id="windingCount"
                  value={windingCount}
                  onChange={(event) => { setWindingCount(event.target.value as WindingCount); markDirty(); }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {windingCountOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">2W bleibt der unmarkierte Standard; 3W wird explizit geführt.</p>
              </div>

              {showSecondaryVoltagesForSelectedWinding && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="secondaryVoltage1" className="block text-sm font-medium text-gray-700 mb-2">NS1</label>
                    <input
                      id="secondaryVoltage1"
                      type="text"
                      value={secondaryVoltage1}
                      onChange={(event) => { setSecondaryVoltage1(event.target.value); markDirty(); }}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="z.B. 400 V"
                    />
                  </div>
                  <div>
                    <label htmlFor="secondaryVoltage2" className="block text-sm font-medium text-gray-700 mb-2">NS2</label>
                    <input
                      id="secondaryVoltage2"
                      type="text"
                      value={secondaryVoltage2}
                      onChange={(event) => { setSecondaryVoltage2(event.target.value); markDirty(); }}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="z.B. 690 V"
                    />
                  </div>
                  <div>
                    <label htmlFor="secondaryVoltage3" className="block text-sm font-medium text-gray-700 mb-2">NS3</label>
                    <input
                      id="secondaryVoltage3"
                      type="text"
                      value={secondaryVoltage3}
                      onChange={(event) => { setSecondaryVoltage3(event.target.value); markDirty(); }}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="optional"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Bilder */}
          {activeTab === 'asset-images' && (
            <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <Image size={20} className="text-blue-500" />
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">Bilder</h2>
                    <p className="text-sm text-gray-600">Fotos werden direkt mit diesem Asset verknüpft.</p>
                  </div>
                </div>
                <label className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  id && !isUploadingDocument
                    ? 'bg-blue-600 text-white hover:bg-blue-700 cursor-pointer'
                    : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                }`}>
                  <Upload size={18} />
                  Foto hochladen
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={!id || isUploadingDocument}
                    onChange={(event) => handleAssetDocumentUpload(event, 'photo')}
                  />
                </label>
              </div>

              {!id && (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  Bitte das Asset zuerst speichern, danach können Bilder hinzugefügt werden.
                </p>
              )}
              <div className="space-y-2">
                <label htmlFor="asset-image-upload-comment" className="text-sm font-medium text-gray-700">
                  Kommentar beim Hochladen
                </label>
                <textarea
                  id="asset-image-upload-comment"
                  value={assetImageUploadComment}
                  onChange={(event) => setAssetImageUploadComment(event.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500"
                  placeholder="Optionaler Kommentar zum nächsten Bild..."
                  disabled={!id || isUploadingDocument}
                />
              </div>
              {documentMessage && <p className="text-sm text-gray-600">{documentMessage}</p>}

              {imageDocuments.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
                  Noch keine Bilder hinterlegt.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {imageDocuments.map((document) => (
                    <div key={document.id} className="overflow-hidden rounded-lg border border-gray-200 bg-white">
                      {document.fileUrl ? (
                        <img src={document.fileUrl} alt={document.title} className="h-40 w-full object-cover" />
                      ) : (
                        <div className="flex h-40 items-center justify-center bg-gray-100 text-gray-400">
                          <Image size={32} />
                        </div>
                      )}
                      <div className="space-y-2 p-3">
                        <div>
                          <p className="truncate text-sm font-medium text-gray-900">{getAssetDocumentFileName(document)}</p>
                          <p className="text-xs text-gray-500">
                            {getAssetDocumentFileSize(document)}{getAssetDocumentFileSize(document) ? ' · ' : ''}
                            {formatAssetDocumentTimestamp(getAssetDocumentUploadTimestamp(document))} · User: {getAssetDocumentUploadedBy(document)}
                          </p>
                        </div>
                        <div className="space-y-2">
                          <label htmlFor={`asset-document-comment-${document.id}`} className="text-xs font-medium text-gray-600">
                            Kommentar
                          </label>
                          <textarea
                            id={`asset-document-comment-${document.id}`}
                            value={documentCommentDrafts[document.id] ?? getAssetDocumentComment(document)}
                            onChange={(event) => handleAssetDocumentCommentChange(document.id, event.target.value)}
                            rows={2}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500"
                            placeholder="Kommentar zum Bild..."
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveAssetDocumentComment(document)}
                            className="text-xs font-medium text-blue-600 hover:text-blue-700"
                          >
                            Kommentar speichern
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteAssetDocument(document.id)}
                          className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-700"
                        >
                          <Trash2 size={14} />
                          Löschen
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Dokumente */}
          {activeTab === 'asset-documents' && (
            <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="flex items-center gap-2">
                  <FileText size={20} className="text-blue-500" />
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">Dokumente</h2>
                    <p className="text-sm text-gray-600">Datenblätter, Prüfberichte, Protokolle und weitere Asset-Unterlagen.</p>
                  </div>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <select
                    value={documentKind}
                    onChange={(event) => setDocumentKind(event.target.value as AssetDocumentKind)}
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500"
                  >
                    {assetDocumentKindOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                  <label className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                    id && !isUploadingDocument
                      ? 'bg-blue-600 text-white hover:bg-blue-700 cursor-pointer'
                      : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  }`}>
                    <Upload size={18} />
                    Dokument hochladen
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,image/*"
                      className="hidden"
                      disabled={!id || isUploadingDocument}
                      onChange={(event) => handleAssetDocumentUpload(event, documentKind)}
                    />
                  </label>
                </div>
              </div>

              {!id && (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  Bitte das Asset zuerst speichern, danach können Dokumente hinzugefügt werden.
                </p>
              )}
              <div className="space-y-2">
                <label htmlFor="asset-document-upload-comment" className="text-sm font-medium text-gray-700">
                  Kommentar beim Hochladen
                </label>
                <textarea
                  id="asset-document-upload-comment"
                  value={assetDocumentUploadComment}
                  onChange={(event) => setAssetDocumentUploadComment(event.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500"
                  placeholder="Optionaler Kommentar zum nächsten Dokument..."
                  disabled={!id || isUploadingDocument}
                />
              </div>
              {documentMessage && <p className="text-sm text-gray-600">{documentMessage}</p>}

              {nonImageDocuments.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
                  Noch keine Dokumente hinterlegt.
                </div>
              ) : (
                <div className="divide-y divide-gray-200 rounded-lg border border-gray-200">
                  {nonImageDocuments.map((document) => (
                    <div key={document.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex flex-1 items-start gap-3">
                        <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
                          <FileText size={20} />
                        </div>
                        <div className="min-w-0 flex-1 space-y-2">
                          <div>
                            <p className="font-medium text-gray-900">{document.title}</p>
                            <p className="text-sm text-gray-500">
                              {getAssetDocumentKindLabel(document.kind, selectOptions)}{getAssetDocumentFileSize(document) ? ` · ${getAssetDocumentFileSize(document)}` : ''}
                              {' · '}{formatAssetDocumentTimestamp(getAssetDocumentUploadTimestamp(document))} · User: {getAssetDocumentUploadedBy(document)}
                            </p>
                          </div>
                          <div className="space-y-2">
                            <label htmlFor={`asset-document-comment-${document.id}`} className="text-xs font-medium text-gray-600">
                              Kommentar
                            </label>
                            <textarea
                              id={`asset-document-comment-${document.id}`}
                              value={documentCommentDrafts[document.id] ?? getAssetDocumentComment(document)}
                              onChange={(event) => handleAssetDocumentCommentChange(document.id, event.target.value)}
                              rows={2}
                              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500"
                              placeholder="Kommentar zum Dokument..."
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveAssetDocumentComment(document)}
                              className="text-xs font-medium text-blue-600 hover:text-blue-700"
                            >
                              Kommentar speichern
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {document.fileUrl && (
                          <a href={document.fileUrl} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:text-blue-700">
                            Öffnen
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteAssetDocument(document.id)}
                          className="inline-flex items-center gap-1 text-sm text-red-600 hover:text-red-700"
                        >
                          <Trash2 size={14} />
                          Löschen
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Historie */}
          {activeTab === 'asset-history' && (
            <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-6">
              <div className="flex items-center gap-2">
                <History size={20} className="text-blue-500" />
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Historie</h2>
                  <p className="text-sm text-gray-600">
                    Zuordnungen, Wartungen und hinzugefügte Dokumente für dieses Asset.
                  </p>
                </div>
              </div>

              {assetHistoryItems.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
                  Noch keine Historieneinträge vorhanden.
                </div>
              ) : (
                <div className="space-y-3">
                  {assetHistoryItems.map((item) => (
                    <div key={item.id} className="flex gap-3 rounded-lg border border-gray-200 bg-white p-4">
                      <div className="mt-1 rounded-full bg-blue-50 p-2 text-blue-600">
                        {item.icon === 'maintenance' ? <Wrench size={18} /> : item.icon === 'document' ? <FileText size={18} /> : <Link2 size={18} />}
                      </div>
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex items-center gap-2">
                            <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700">{item.category}</span>
                            <p className="font-medium text-gray-900">{item.title}</p>
                          </div>
                          <p className="text-xs text-gray-500">
                            {formatAssetDocumentTimestamp(item.occurredAt)} · User: {item.userName}
                          </p>
                        </div>
                        <p className="text-sm text-gray-700">{item.description}</p>
                        {item.details && <p className="text-sm text-gray-500">{item.details}</p>}
                        {item.linkTo && (
                          <Link to={item.linkTo} className="inline-flex text-sm font-medium text-blue-600 hover:text-blue-700">
                            Anfrage öffnen
                          </Link>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Verknüpfungen */}
          {activeTab === 'asset-links' && (
            <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-6">
              <div className="flex items-center gap-2">
                <Link2 size={20} className="text-blue-500" />
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Verknüpfungen</h2>
                  <p className="text-sm text-gray-600">Aktuelle und vergangene Anfrage-Verknüpfungen dieses Assets.</p>
                </div>
              </div>

              {assetInquiryLinks.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
                  Noch keine Anfrage-Verknüpfungen vorhanden.
                </div>
              ) : (
                <div className="divide-y divide-gray-200 rounded-lg border border-gray-200">
                  {assetInquiryLinks.map((link) => (
                    <div key={link.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">{link.status}</span>
                          <span className="text-xs text-gray-500">{formatAssetDocumentTimestamp(link.linkedAt)}</span>
                        </div>
                        <p className="mt-1 font-medium text-gray-900">{link.inquiryNumber} · {link.title}</p>
                      </div>
                      {link.inquiryId && (
                        <Link to={`/inquiries/${link.inquiryId}`} className="text-sm font-medium text-blue-600 hover:text-blue-700">
                          Anfrage öffnen
                        </Link>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Dirty Warning Modal */}
      {showDirtyWarning && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={handleDirtyWarningBackdropClick}>
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">Änderungen verwerfen?</h2>
            <p className="text-gray-600 mb-6">
              Sie haben ungespeicherte Änderungen. Möchten Sie wirklich abbrechen?
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDirtyWarning(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Zurück
              </button>
              <button
                onClick={confirmCancel}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Änderungen verwerfen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
