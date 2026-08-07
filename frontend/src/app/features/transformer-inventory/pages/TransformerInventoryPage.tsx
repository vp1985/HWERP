import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { ShieldAlert, X } from 'lucide-react';
import { DataTable } from '../../../components/ui/DataTable';
import { usePriceVisibility } from '../../../context/PriceVisibilityContext';
import { useAppStore } from '../../../context/AppStoreContext';
import { uuid } from '../../../lib/utils';
import type { AssetNode, Calculation, Customer, Material, Service, ServicePackage, ServicePackageItem } from '../../../lib/types';
import { pgAssetTypeStore, type AssetType } from '../../../lib/assetTypeStorage';
import { buildInventorySaleLineItem } from '../../../lib/calculationLineItems';
import {
  buildTransformerAssetFromDraft,
  buildTransformerInventoryRows,
  deriveNextManualTransformerPosition,
  type ManualTransformerOwnership,
  type TransformerAssetDraft,
} from '../manualTransformerAssets';
import {
  buildManualTransformerCostItem,
  buildPurchaseCostItem,
  buildTransformerCostItemFromMaterial,
  buildTransformerCostItemFromPackage,
  buildTransformerCostItemFromService,
  calculateTransformerCostTotal,
  hasPurchaseCostItem,
} from '../transformerInventoryCosts';
import { buildTransformerInventoryColumns, getDefaultTransformerInventoryColumnKeys } from '../tableConfig';
import type {
  TransformerInventoryAttachment,
  TransformerInventoryCalculationLink,
  TransformerInventoryCostItem,
  TransformerInventoryDetailOverride,
  TransformerInventoryItem,
  TransformerInventoryReservation,
  TransformerInventoryStatus,
} from '../types';
import {
  allTransformerInventoryStatusFilters,
  deriveTransformerInventorySummary,
  filterTransformerInventory,
  findActiveTransformerReservation,
  getLatestCalculationLink,
  mergeInventoryDetailOverride,
  toggleTransformerStatusFilter,
  validateTransformerReservationRequest,
} from '../utils';

function customerName(customers: Customer[], customerId: string | null | undefined): string {
  if (!customerId) return '—';
  return customers.find((customer) => customer.id === customerId)?.name ?? customerId;
}

function getOverrideDraft(item: TransformerInventoryItem) {
  return {
    manufacturer: item.manufacturer,
    powerKva: item.powerKva ?? '',
    primaryVoltageKv: item.primaryVoltageKv ?? '',
    secondaryVoltageV: item.secondaryVoltageV ?? '',
    vectorGroup: item.vectorGroup,
    serialNumber: item.serialNumber,
    constructionYear: item.constructionYear ?? '',
    constructionType: item.constructionType,
    weightKg: item.weightKg ?? '',
    origin: item.origin,
    connectionType: item.connectionType,
    note: item.note,
    priceNote: item.priceNote,
  };
}

type OverrideDraft = ReturnType<typeof getOverrideDraft>;

function createNewTransformerDraft(ownership: ManualTransformerOwnership, position: string): TransformerAssetDraft {
  return {
    ownership,
    position,
    inventoryOrigin: ownership === 'own' ? 'HT-VOLTEQ' : '',
    manufacturer: '',
    powerKva: '',
    primaryVoltageKv: '',
    secondaryVoltageV: '',
    vectorGroup: '',
    serialNumber: '',
    constructionYear: '',
    constructionType: '',
    weightKg: '',
    connectionType: '',
    priceNote: '',
    note: '',
    customerId: null,
    forSale: ownership === 'own',
  };
}

function findTransformerAssetTypeId(assetTypes: AssetType[]): string | null {
  return assetTypes.find((type) => type.code === 'trafo')?.id
    ?? assetTypes.find((type) => type.label.toLowerCase().includes('transformator'))?.id
    ?? null;
}

function toNullableNumber(value: string | number): number | null {
  if (value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

type TransformerCostDraft = {
  performedAt: string;
  serviceId: string;
  materialId: string;
  packageId: string;
  manualDescription: string;
  manualUnit: string;
  quantity: string;
  unitPrice: string;
  note: string;
};

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function createCostDraft(): TransformerCostDraft {
  return {
    performedAt: todayIsoDate(),
    serviceId: '',
    materialId: '',
    packageId: '',
    manualDescription: '',
    manualUnit: 'Pauschal',
    quantity: '1',
    unitPrice: '',
    note: '',
  };
}

function formatEuro(value: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value || 0);
}

interface TransformerCostSectionProps {
  title?: string;
  purchasePrice?: string;
  onPurchasePriceChange?: (value: string) => void;
  purchaseRequired?: boolean;
  items: TransformerInventoryCostItem[];
  draft: TransformerCostDraft;
  onDraftChange: (patch: Partial<TransformerCostDraft>) => void;
  services: Service[];
  materials: Material[];
  servicePackages: ServicePackage[];
  onAddService: () => void;
  onAddMaterial: () => void;
  onAddPackage: () => void;
  onAddManual: () => void;
}

function TransformerCostSection({
  title = 'Bereits erbrachte Leistungen / Kosten',
  purchasePrice,
  onPurchasePriceChange,
  purchaseRequired = false,
  items,
  draft,
  onDraftChange,
  services,
  materials,
  servicePackages,
  onAddService,
  onAddMaterial,
  onAddPackage,
  onAddManual,
}: TransformerCostSectionProps) {
  const total = calculateTransformerCostTotal([
    ...items,
    ...(purchasePrice !== undefined && purchasePrice !== '' && !hasPurchaseCostItem(items) ? [{ totalPrice: Number(purchasePrice) || 0 }] : []),
  ]);

  return (
    <section className="rounded-xl border bg-slate-50 p-4 lg:col-span-2">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-bold text-slate-900">{title}</h3>
          <p className="text-xs text-slate-500">Einkaufspreis und alle später erbrachten Arbeiten bleiben am Trafo hängen.</p>
        </div>
        <div className="rounded-lg bg-white px-3 py-2 text-right text-sm font-bold text-slate-900 shadow-sm">
          Gesamtpreis<br /><span className="text-blue-700">{formatEuro(total)}</span>
        </div>
      </div>

      {onPurchasePriceChange && (
        <div className="mb-3 grid gap-2 sm:grid-cols-3">
          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 sm:col-span-1">
            Einkaufspreis {purchaseRequired ? '*' : ''}
            <input
              type="number"
              min="0"
              step="0.01"
              value={purchasePrice ?? ''}
              onChange={(event) => onPurchasePriceChange(event.target.value)}
              placeholder="EK €"
              className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm normal-case tracking-normal text-slate-900"
            />
          </label>
          <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800 sm:col-span-2">
            Der Einkaufspreis ist Pflicht und wird als erste Kostenposition gespeichert. Weitere Prüfungen, Umbauten, Material oder Pakete können jederzeit ergänzt werden.
          </div>
        </div>
      )}

      <div className="mb-3 max-h-44 space-y-2 overflow-auto rounded-lg bg-white p-2">
        {items.length === 0 ? (
          <div className="rounded-lg border border-dashed p-3 text-sm text-slate-500">Noch keine Zusatzpositionen erfasst.</div>
        ) : items.map((item) => (
          <div key={item.id} className="grid gap-2 rounded-lg border p-2 text-sm sm:grid-cols-[110px_1fr_90px_90px_110px]">
            <div className="font-semibold text-slate-500">{item.type === 'purchase' ? 'Einkauf' : item.type === 'package' ? 'Paket' : item.type === 'material' ? 'Material' : 'Leistung'}</div>
            <div><b>{item.description}</b>{item.note ? <span className="text-slate-500"> · {item.note}</span> : null}</div>
            <div>{item.quantity} {item.unit}</div>
            <div>{formatEuro(item.unitPrice)}</div>
            <div className="font-bold text-slate-900">{formatEuro(item.totalPrice)}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-2 lg:grid-cols-4">
        <select value={draft.serviceId} onChange={(event) => onDraftChange({ serviceId: event.target.value })} className="rounded-lg border bg-white px-3 py-2 text-sm">
          <option value="">Leistung wählen</option>
          {services.filter((service) => service.active !== false).map((service) => <option key={service.id} value={service.id}>{service.name} · {formatEuro(service.price)}</option>)}
        </select>
        <select value={draft.materialId} onChange={(event) => onDraftChange({ materialId: event.target.value })} className="rounded-lg border bg-white px-3 py-2 text-sm">
          <option value="">Material wählen</option>
          {materials.map((material) => <option key={material.id} value={material.id}>{material.name} · {formatEuro(material.price)}</option>)}
        </select>
        <select value={draft.packageId} onChange={(event) => onDraftChange({ packageId: event.target.value })} className="rounded-lg border bg-white px-3 py-2 text-sm">
          <option value="">Leistungspaket wählen</option>
          {servicePackages.filter((pkg) => pkg.active !== false).map((pkg) => <option key={pkg.id} value={pkg.id}>{pkg.name}</option>)}
        </select>
        <input type="date" value={draft.performedAt} onChange={(event) => onDraftChange({ performedAt: event.target.value })} className="rounded-lg border bg-white px-3 py-2 text-sm" />
        <input value={draft.manualDescription} onChange={(event) => onDraftChange({ manualDescription: event.target.value })} placeholder="Freie Position / Änderung" className="rounded-lg border bg-white px-3 py-2 text-sm lg:col-span-2" />
        <input value={draft.quantity} onChange={(event) => onDraftChange({ quantity: event.target.value })} placeholder="Menge" className="rounded-lg border bg-white px-3 py-2 text-sm" />
        <input value={draft.unitPrice} onChange={(event) => onDraftChange({ unitPrice: event.target.value })} placeholder="Einzelpreis €" className="rounded-lg border bg-white px-3 py-2 text-sm" />
        <input value={draft.note} onChange={(event) => onDraftChange({ note: event.target.value })} placeholder="Notiz, z.B. Trafoprüfung" className="rounded-lg border bg-white px-3 py-2 text-sm lg:col-span-4" />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={onAddService} className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50">Leistung hinzufügen</button>
        <button type="button" onClick={onAddMaterial} className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50">Material hinzufügen</button>
        <button type="button" onClick={onAddPackage} className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50">Leistungspaket hinzufügen</button>
        <button type="button" onClick={onAddManual} className="rounded-lg border px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">Freie Position hinzufügen</button>
      </div>
    </section>
  );
}

export default function TransformerInventoryPage() {
  const navigate = useNavigate();
  const { state, repository, dispatch } = useAppStore();
  const [query, setQuery] = useState('');
  const [selectedStatuses, setSelectedStatuses] = useState<TransformerInventoryStatus[]>(allTransformerInventoryStatusFilters);
  const [selectedPosition, setSelectedPosition] = useState<string | null>(null);
  const [calcCustomerId, setCalcCustomerId] = useState('');
  const [calcPrice, setCalcPrice] = useState<number>(0);
  const [reservationCustomerId, setReservationCustomerId] = useState('');
  const [reservedFrom, setReservedFrom] = useState(new Date().toISOString().slice(0, 10));
  const [reservedUntil, setReservedUntil] = useState(new Date().toISOString().slice(0, 10));
  const [reservationNote, setReservationNote] = useState('');
  const [overrideDraft, setOverrideDraft] = useState<OverrideDraft | null>(null);
  const [attachmentCaption, setAttachmentCaption] = useState('');
  const [newTransformerOpen, setNewTransformerOpen] = useState(false);
  const [newTransformerDraft, setNewTransformerDraft] = useState<TransformerAssetDraft>(() => createNewTransformerDraft('own', 'HT0001'));
  const [newTransformerPurchasePrice, setNewTransformerPurchasePrice] = useState('');
  const [newTransformerCostItems, setNewTransformerCostItems] = useState<TransformerInventoryCostItem[]>([]);
  const [newCostDraft, setNewCostDraft] = useState<TransformerCostDraft>(() => createCostDraft());
  const [detailCostDraft, setDetailCostDraft] = useState<TransformerCostDraft>(() => createCostDraft());
  const [assetTypes, setAssetTypes] = useState<AssetType[]>([]);
  const [isSavingNewTransformer, setIsSavingNewTransformer] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const { permissions, hidePrices, revealPrices } = usePriceVisibility();
  const canViewPrices = permissions.can_view_prices;

  const customers = (state.customers as Customer[]) || [];
  const assets = (state.assets as AssetNode[]) || [];
  const materials = (state.materials as Material[]) || [];
  const services = (state.services as Service[]) || [];
  const servicePackages = (state.servicePackages as ServicePackage[]) || [];
  const servicePackageItems = (state.servicePackageItems as ServicePackageItem[]) || [];
  const costItems = (state.transformerInventoryCostItems as TransformerInventoryCostItem[]) || [];
  const calculationLinks = (state.transformerInventoryCalculationLinks as TransformerInventoryCalculationLink[]) || [];
  const reservations = (state.transformerInventoryReservations as TransformerInventoryReservation[]) || [];
  const overrides = (state.transformerInventoryDetailOverrides as TransformerInventoryDetailOverride[]) || [];
  const attachments = (state.transformerInventoryAttachments as TransformerInventoryAttachment[]) || [];
  const customerNamesById = useMemo(() => Object.fromEntries(customers.map((customer) => [customer.id, customer.name])), [customers]);

  useEffect(() => {
    let cancelled = false;
    async function loadAssetTypes() {
      await pgAssetTypeStore.seedIfEmpty().catch(() => undefined);
      const loaded = await pgAssetTypeStore.getAll().catch(() => [] as AssetType[]);
      if (!cancelled) setAssetTypes(loaded.filter((type) => type.isActive));
    }
    loadAssetTypes();
    return () => {
      cancelled = true;
    };
  }, []);

  const effectiveItems = useMemo(() => (
    buildTransformerInventoryRows(assets).map((item) => (
      mergeInventoryDetailOverride(item, overrides.find((override) => override.inventoryPosition === item.position))
    ))
  ), [assets, overrides]);

  const selectedItem = selectedPosition ? effectiveItems.find((item) => item.position === selectedPosition) ?? null : null;
  const selectedCostItems = selectedPosition ? costItems.filter((item) => item.inventoryPosition === selectedPosition).sort((a, b) => a.sortOrder - b.sortOrder) : [];
  const selectedAsset = selectedPosition ? assets.find((asset) => asset.internalAssetId === selectedPosition) ?? null : null;
  const selectedReservations = selectedPosition ? reservations.filter((reservation) => reservation.inventoryPosition === selectedPosition) : [];
  const selectedAttachments = selectedPosition ? attachments.filter((attachment) => attachment.inventoryPosition === selectedPosition) : [];
  const latestCalculationLink = selectedPosition ? getLatestCalculationLink(selectedPosition, calculationLinks) : null;
  const activeReservation = selectedPosition ? findActiveTransformerReservation(selectedPosition, reservations) : null;

  const summary = useMemo(() => deriveTransformerInventorySummary(effectiveItems, reservations), [effectiveItems, reservations]);
  const filteredItems = useMemo(
    () => filterTransformerInventory(effectiveItems, query, selectedStatuses, reservations, calculationLinks, customerNamesById),
    [effectiveItems, query, selectedStatuses, reservations, calculationLinks, customerNamesById],
  );

  const handleOpenNewTransformerModal = () => {
    const draft = createNewTransformerDraft('own', deriveNextManualTransformerPosition(assets, 'own'));
    setNewTransformerDraft(draft);
    setNewTransformerPurchasePrice('');
    setNewTransformerCostItems([]);
    setNewCostDraft(createCostDraft());
    setMessage(null);
    setNewTransformerOpen(true);
  };

  const handleNewTransformerOwnershipChange = (ownership: ManualTransformerOwnership) => {
    setNewTransformerDraft((current) => ({
      ...current,
      ownership,
      position: deriveNextManualTransformerPosition(assets, ownership),
      inventoryOrigin: ownership === 'own' ? 'HT-VOLTEQ' : '',
      customerId: ownership === 'own' ? null : current.customerId ?? null,
      forSale: ownership === 'own',
    }));
  };

  const updateNewTransformerDraft = (patch: Partial<TransformerAssetDraft>) => {
    setNewTransformerDraft((current) => ({ ...current, ...patch }));
  };

  const buildDraftCostOptions = (inventoryPosition: string, draft: TransformerCostDraft, sortOrder: number, assetId: string | null = null) => ({
    id: uuid(),
    inventoryPosition,
    assetId,
    quantity: draft.quantity,
    performedAt: draft.performedAt || todayIsoDate(),
    note: draft.note,
    sortOrder,
    now: new Date().toISOString(),
  });

  const addNewTransformerCostItem = (item: TransformerInventoryCostItem) => {
    setNewTransformerCostItems((current) => [...current, item]);
    setNewCostDraft(createCostDraft());
  };

  const handleAddNewServiceCost = () => {
    const service = services.find((item) => item.id === newCostDraft.serviceId);
    if (!service) return;
    addNewTransformerCostItem(buildTransformerCostItemFromService(service, buildDraftCostOptions(newTransformerDraft.position, newCostDraft, newTransformerCostItems.length * 100 + 100)));
  };

  const handleAddNewMaterialCost = () => {
    const material = materials.find((item) => item.id === newCostDraft.materialId);
    if (!material) return;
    addNewTransformerCostItem(buildTransformerCostItemFromMaterial(material, buildDraftCostOptions(newTransformerDraft.position, newCostDraft, newTransformerCostItems.length * 100 + 100)));
  };

  const handleAddNewPackageCost = () => {
    const pkg = servicePackages.find((item) => item.id === newCostDraft.packageId);
    if (!pkg) return;
    addNewTransformerCostItem(buildTransformerCostItemFromPackage(pkg, servicePackageItems, buildDraftCostOptions(newTransformerDraft.position, newCostDraft, newTransformerCostItems.length * 100 + 100)));
  };

  const handleAddNewManualCost = () => {
    if (!newCostDraft.manualDescription.trim()) return;
    addNewTransformerCostItem(buildManualTransformerCostItem({
      description: newCostDraft.manualDescription,
      unit: newCostDraft.manualUnit,
      unitPrice: newCostDraft.unitPrice,
      options: buildDraftCostOptions(newTransformerDraft.position, newCostDraft, newTransformerCostItems.length * 100 + 100),
    }));
  };

  const saveDetailCostItem = async (item: TransformerInventoryCostItem) => {
    const saved = await repository.upsert<TransformerInventoryCostItem>('transformerInventoryCostItems', item);
    dispatch({ type: 'ADD_ENTITY', entity: 'transformerInventoryCostItems', data: saved });
    setDetailCostDraft(createCostDraft());
    setMessage('Kostenposition gespeichert.');
  };

  const handleAddDetailServiceCost = async () => {
    if (!selectedItem) return;
    const service = services.find((item) => item.id === detailCostDraft.serviceId);
    if (!service) return;
    await saveDetailCostItem(buildTransformerCostItemFromService(service, buildDraftCostOptions(selectedItem.position, detailCostDraft, selectedCostItems.length * 100 + 100, selectedAsset?.id ?? null)));
  };

  const handleAddDetailMaterialCost = async () => {
    if (!selectedItem) return;
    const material = materials.find((item) => item.id === detailCostDraft.materialId);
    if (!material) return;
    await saveDetailCostItem(buildTransformerCostItemFromMaterial(material, buildDraftCostOptions(selectedItem.position, detailCostDraft, selectedCostItems.length * 100 + 100, selectedAsset?.id ?? null)));
  };

  const handleAddDetailPackageCost = async () => {
    if (!selectedItem) return;
    const pkg = servicePackages.find((item) => item.id === detailCostDraft.packageId);
    if (!pkg) return;
    await saveDetailCostItem(buildTransformerCostItemFromPackage(pkg, servicePackageItems, buildDraftCostOptions(selectedItem.position, detailCostDraft, selectedCostItems.length * 100 + 100, selectedAsset?.id ?? null)));
  };

  const handleAddDetailManualCost = async () => {
    if (!selectedItem || !detailCostDraft.manualDescription.trim()) return;
    await saveDetailCostItem(buildManualTransformerCostItem({
      description: detailCostDraft.manualDescription,
      unit: detailCostDraft.manualUnit,
      unitPrice: detailCostDraft.unitPrice,
      options: buildDraftCostOptions(selectedItem.position, detailCostDraft, selectedCostItems.length * 100 + 100, selectedAsset?.id ?? null),
    }));
  };

  const handleSaveNewTransformer = async () => {
    if (!newTransformerDraft.position.trim()) {
      setMessage('Bitte eine Lager-/Trafo-Nr. eintragen.');
      return;
    }
    if (newTransformerDraft.ownership === 'external' && !newTransformerDraft.inventoryOrigin?.trim() && !newTransformerDraft.customerId) {
      setMessage('Bitte beim Fremdtrafo einen Eigentümer oder Kunden wählen.');
      return;
    }
    if (newTransformerPurchasePrice === '') {
      setMessage('Bitte den Einkaufspreis eintragen.');
      return;
    }
    setIsSavingNewTransformer(true);
    try {
      const now = new Date().toISOString();
      const asset = buildTransformerAssetFromDraft(newTransformerDraft, {
        id: uuid(),
        now,
        assetTypeId: findTransformerAssetTypeId(assetTypes),
      });
      const saved = await repository.upsert<AssetNode>('assets', asset);
      dispatch({ type: 'ADD_ENTITY', entity: 'assets', data: saved });
      const purchaseCost = buildPurchaseCostItem(newTransformerPurchasePrice, {
        id: uuid(),
        inventoryPosition: saved.internalAssetId ?? newTransformerDraft.position,
        assetId: saved.id,
        performedAt: todayIsoDate(),
        sortOrder: 0,
        now,
      });
      const costsToSave = [
        purchaseCost,
        ...newTransformerCostItems.map((item, index) => ({
          ...item,
          inventoryPosition: saved.internalAssetId ?? newTransformerDraft.position,
          assetId: saved.id,
          sortOrder: (index + 1) * 100,
          updatedAt: now,
        })),
      ];
      for (const item of costsToSave) {
        const savedCost = await repository.upsert<TransformerInventoryCostItem>('transformerInventoryCostItems', item);
        dispatch({ type: 'ADD_ENTITY', entity: 'transformerInventoryCostItems', data: savedCost });
      }
      setNewTransformerOpen(false);
      setMessage('Neuer Trafo als Asset gespeichert.');
    } catch (error) {
      console.error('Failed to save transformer asset:', error);
      setMessage('Trafo konnte nicht gespeichert werden.');
    } finally {
      setIsSavingNewTransformer(false);
    }
  };

  const handleOpenDetail = (item: TransformerInventoryItem) => {
    setSelectedPosition(item.position);
    setOverrideDraft(getOverrideDraft(item));
    setCalcCustomerId('');
    setReservationCustomerId('');
    setMessage(null);
  };

  const handleStatusToggle = (status: TransformerInventoryStatus) => {
    setSelectedStatuses((current: TransformerInventoryStatus[]) => toggleTransformerStatusFilter(current, status));
  };

  const columns = useMemo(
    () => buildTransformerInventoryColumns({
      canViewPrices,
      hidePrices,
      revealPrices,
      reservations,
      onOpenDetail: handleOpenDetail,
      statusFilter: {
        selectedStatuses,
        summary,
        onToggle: handleStatusToggle,
        onSelectAll: () => setSelectedStatuses(allTransformerInventoryStatusFilters),
        onSelectNone: () => setSelectedStatuses([]),
      },
    }),
    [canViewPrices, hidePrices, revealPrices, reservations, selectedStatuses, summary],
  );

  const handleOpenCalculationPicker = () => {
    if (!selectedItem) return;
    navigate(`/calculations/new?inventoryPosition=${selectedItem.position}`);
  };

  const handleToggleSelectedAssetForSale = async (forSale: boolean) => {
    if (!selectedAsset) return;
    const updated: AssetNode = {
      ...selectedAsset,
      forSale,
      stockStatus: forSale && selectedAsset.stockStatus === 'unchecked' ? 'available' : selectedAsset.stockStatus,
      updatedAt: new Date().toISOString(),
    };
    const saved = await repository.upsert<AssetNode>('assets', updated);
    dispatch({ type: 'UPDATE_ENTITY', entity: 'assets', data: saved });
    setMessage(forSale ? 'Trafo ist als zu verkaufen markiert.' : 'Trafo ist nicht mehr als zu verkaufen markiert.');
  };

  const handleCreateCalculation = async () => {
    if (!selectedItem || !calcCustomerId) {
      setMessage('Bitte erst einen Kunden für die Kalkulation wählen.');
      return;
    }

    const now = new Date().toISOString();
    const calculationId = uuid();
    const calculation: Calculation = {
      id: calculationId,
      number: await repository.getNextCalcNumber(),
      title: `Verkauf ${selectedItem.position}`,
      description: `Verkaufskalkulation Lagertrafo ${selectedItem.position}`,
      customerId: calcCustomerId,
      locationId: null,
      assetId: null,
      status: 'DRAFT',
      createdAt: now,
      updatedAt: now,
    };
    const lineItem = buildInventorySaleLineItem({
      id: uuid(),
      calculationId,
      inventoryItem: selectedItem,
      price: calcPrice,
      now,
    });
    const link: TransformerInventoryCalculationLink = {
      id: uuid(),
      inventoryPosition: selectedItem.position,
      customerId: calcCustomerId,
      calculationId,
      calculatedAt: now,
      note: lineItem.description,
      createdAt: now,
      updatedAt: now,
    };

    await repository.upsert('calculations', calculation);
    await repository.upsert('calculationLineItems', lineItem);
    await repository.upsert('transformerInventoryCalculationLinks', link);
    dispatch({ type: 'ADD_ENTITY', entity: 'calculations', data: calculation });
    dispatch({ type: 'ADD_ENTITY', entity: 'calculationLineItems', data: lineItem });
    dispatch({ type: 'ADD_ENTITY', entity: 'transformerInventoryCalculationLinks', data: link });
    navigate(`/calculations/${calculationId}`);
  };

  const handleReserve = async () => {
    if (!selectedItem) return;
    const validation = validateTransformerReservationRequest(selectedItem, reservations, {
      customerId: reservationCustomerId,
      reservedFrom,
      reservedUntil,
    });
    if (!validation.valid) {
      setMessage(validation.reason);
      return;
    }
    const now = new Date().toISOString();
    const reservation: TransformerInventoryReservation = {
      id: uuid(),
      inventoryPosition: selectedItem.position,
      customerId: reservationCustomerId,
      calculationId: latestCalculationLink?.calculationId ?? null,
      reservedFrom,
      reservedUntil,
      status: 'active',
      note: reservationNote || null,
      createdByUserId: null,
      createdAt: now,
      updatedAt: now,
    };
    await repository.upsert('transformerInventoryReservations', reservation);
    dispatch({ type: 'ADD_ENTITY', entity: 'transformerInventoryReservations', data: reservation });
    setMessage('Reservierung gespeichert.');
  };

  const handleSaveOverride = async () => {
    if (!selectedItem || !overrideDraft) return;
    const now = new Date().toISOString();
    const existing = overrides.find((override) => override.inventoryPosition === selectedItem.position);
    const override: TransformerInventoryDetailOverride = {
      id: existing?.id ?? uuid(),
      inventoryPosition: selectedItem.position,
      fields: {
        manufacturer: overrideDraft.manufacturer,
        powerKva: toNullableNumber(overrideDraft.powerKva),
        primaryVoltageKv: toNullableNumber(overrideDraft.primaryVoltageKv),
        secondaryVoltageV: toNullableNumber(overrideDraft.secondaryVoltageV),
        vectorGroup: overrideDraft.vectorGroup,
        serialNumber: overrideDraft.serialNumber,
        constructionYear: toNullableNumber(overrideDraft.constructionYear),
        constructionType: overrideDraft.constructionType,
        weightKg: toNullableNumber(overrideDraft.weightKg),
        origin: overrideDraft.origin,
        connectionType: overrideDraft.connectionType,
        note: overrideDraft.note,
        priceNote: overrideDraft.priceNote,
      },
      updatedByUserId: null,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    await repository.upsert('transformerInventoryDetailOverrides', override);
    dispatch({
      type: 'SET_ENTITIES',
      entity: 'transformerInventoryDetailOverrides',
      data: [...overrides.filter((item) => item.id !== override.id), override],
    });
    setMessage('Trafodaten gespeichert.');
  };

  const handleAttachmentUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    if (!selectedItem) return;
    const file = event.target.files?.[0];
    if (!file) return;
    const now = new Date().toISOString();
    const attachment: TransformerInventoryAttachment = {
      id: uuid(),
      inventoryPosition: selectedItem.position,
      type: file.type.startsWith('image/') ? 'photo' : 'document',
      fileName: file.name,
      mimeType: file.type || null,
      storageKey: await fileToDataUrl(file),
      caption: attachmentCaption || null,
      uploadedByUserId: null,
      uploadedAt: now,
      createdAt: now,
      updatedAt: now,
    };
    await repository.upsert('transformerInventoryAttachments', attachment);
    dispatch({ type: 'ADD_ENTITY', entity: 'transformerInventoryAttachments', data: attachment });
    setAttachmentCaption('');
    setMessage('Anhang gespeichert.');
    event.target.value = '';
  };

  return (
    <div className="flex h-full min-h-0 w-full max-w-none flex-col p-2">
      {(!canViewPrices || (hidePrices && !revealPrices)) && (
        <div className="mb-2 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <ShieldAlert size={16} />
          Preisnotizen sind {canViewPrices ? 'maskiert, bis Preise eingeblendet werden' : 'für diese Rolle ausgeblendet'}.
        </div>
      )}

      <div className="min-h-0 flex-1">
        <DataTable<TransformerInventoryItem>
          title={`${filteredItems.length} Lagertrafos`}
          primaryAction={{
            label: 'Neuer Trafo',
            ariaLabel: 'Neuen Trafo anlegen',
            title: 'Neuen Trafo anlegen',
            iconOnly: true,
            onClick: handleOpenNewTransformerModal,
          }}
          search={{
            value: query,
            onChange: setQuery,
            placeholder: 'Suchen: HT-Nr., Hersteller, Seriennr., Kunde, Reservierungsnotiz …',
          }}
          columns={columns}
          rows={filteredItems}
          rowKey={(item: TransformerInventoryItem) => item.position}
          emptyState={{
            title: 'Keine Trafos gefunden',
            description: 'Suche oder Filter anpassen, um wieder Lagertrafos anzuzeigen.',
          }}
          columnVisibility={{
            enabled: true,
            storageKey: 'datatable.transformer-inventory.v2',
            defaultVisibleKeys: getDefaultTransformerInventoryColumnKeys(canViewPrices),
            enableReordering: true,
          }}
        />
      </div>

      {newTransformerOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-hidden bg-slate-950/40 p-4">
          <div className="flex h-[calc(100vh-2rem)] w-[calc(100vw-2rem)] max-w-none flex-col rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b px-6 py-4">
              <div>
                <h2 className="text-xl font-bold text-slate-950">Neuer Trafo</h2>
                <p className="text-sm text-slate-500">Speichert direkt als Asset; später kann der Trafo einem Kunden/Standort zugeordnet werden.</p>
              </div>
              <button type="button" onClick={() => setNewTransformerOpen(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Modal schließen">
                <X size={18} />
              </button>
            </div>

            {message && <div className="mx-6 mt-4 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-800">{message}</div>}

            <div className="min-h-0 flex-1 space-y-4 overflow-auto p-6">
              <section className="rounded-xl border p-4">
                <h3 className="mb-3 font-bold text-slate-900">Eigentümer</h3>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleNewTransformerOwnershipChange('own')}
                    className={`rounded-lg border px-4 py-2 text-sm font-semibold ${newTransformerDraft.ownership === 'own' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}
                  >
                    Eigener Trafo
                  </button>
                  <button
                    type="button"
                    onClick={() => handleNewTransformerOwnershipChange('external')}
                    className={`rounded-lg border px-4 py-2 text-sm font-semibold ${newTransformerDraft.ownership === 'external' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}
                  >
                    Fremdtrafo
                  </button>
                </div>
              </section>

              <section className="rounded-xl border p-4">
                <h3 className="mb-3 font-bold text-slate-900">Trafodaten</h3>
                <div className="grid gap-2 sm:grid-cols-4">
                  <input value={newTransformerDraft.position} onChange={(event) => updateNewTransformerDraft({ position: event.target.value })} placeholder="HT-/FT-Nr." className="rounded-lg border px-3 py-2" />
                  <input value={newTransformerDraft.inventoryOrigin ?? ''} onChange={(event) => updateNewTransformerDraft({ inventoryOrigin: event.target.value })} placeholder={newTransformerDraft.ownership === 'own' ? 'HT-VOLTEQ' : 'Eigentümer/Quelle'} className="rounded-lg border px-3 py-2" />
                  {newTransformerDraft.ownership === 'external' && (
                    <select value={newTransformerDraft.customerId ?? ''} onChange={(event) => updateNewTransformerDraft({ customerId: event.target.value || null })} className="rounded-lg border px-3 py-2 sm:col-span-2">
                      <option value="">Optional: Kunde/Eigentümer wählen</option>
                      {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
                    </select>
                  )}
                  <input value={newTransformerDraft.manufacturer ?? ''} onChange={(event) => updateNewTransformerDraft({ manufacturer: event.target.value })} placeholder="Hersteller" className="rounded-lg border px-3 py-2" />
                  <input value={newTransformerDraft.powerKva ?? ''} onChange={(event) => updateNewTransformerDraft({ powerKva: event.target.value })} placeholder="kVA" className="rounded-lg border px-3 py-2" />
                  <input value={newTransformerDraft.primaryVoltageKv ?? ''} onChange={(event) => updateNewTransformerDraft({ primaryVoltageKv: event.target.value })} placeholder="OS kV" className="rounded-lg border px-3 py-2" />
                  <input value={newTransformerDraft.secondaryVoltageV ?? ''} onChange={(event) => updateNewTransformerDraft({ secondaryVoltageV: event.target.value })} placeholder="US V" className="rounded-lg border px-3 py-2" />
                  <input value={newTransformerDraft.vectorGroup ?? ''} onChange={(event) => updateNewTransformerDraft({ vectorGroup: event.target.value })} placeholder="Schaltgruppe" className="rounded-lg border px-3 py-2" />
                  <input value={newTransformerDraft.serialNumber ?? ''} onChange={(event) => updateNewTransformerDraft({ serialNumber: event.target.value })} placeholder="Seriennr." className="rounded-lg border px-3 py-2" />
                  <input value={newTransformerDraft.constructionYear ?? ''} onChange={(event) => updateNewTransformerDraft({ constructionYear: event.target.value })} placeholder="Bj." className="rounded-lg border px-3 py-2" />
                  <input value={newTransformerDraft.weightKg ?? ''} onChange={(event) => updateNewTransformerDraft({ weightKg: event.target.value })} placeholder="Gewicht kg" className="rounded-lg border px-3 py-2" />
                  <input value={newTransformerDraft.constructionType ?? ''} onChange={(event) => updateNewTransformerDraft({ constructionType: event.target.value })} placeholder="Bauart" className="rounded-lg border px-3 py-2" />
                  <input value={newTransformerDraft.connectionType ?? ''} onChange={(event) => updateNewTransformerDraft({ connectionType: event.target.value })} placeholder="Anschluss" className="rounded-lg border px-3 py-2" />
                  <input value={newTransformerDraft.priceNote ?? ''} onChange={(event) => updateNewTransformerDraft({ priceNote: event.target.value })} placeholder="Preisnotiz" className="rounded-lg border px-3 py-2" />
                  <textarea value={newTransformerDraft.note ?? ''} onChange={(event) => updateNewTransformerDraft({ note: event.target.value })} placeholder="Notiz" className="rounded-lg border px-3 py-2 sm:col-span-4" />
                </div>
                {newTransformerDraft.ownership === 'own' && (
                  <label className="mt-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={Boolean(newTransformerDraft.forSale)}
                      onChange={(event) => updateNewTransformerDraft({ forSale: event.target.checked })}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    Zu verkaufen
                  </label>
                )}
              </section>

              <TransformerCostSection
                purchasePrice={newTransformerPurchasePrice}
                onPurchasePriceChange={setNewTransformerPurchasePrice}
                purchaseRequired
                items={newTransformerCostItems}
                draft={newCostDraft}
                onDraftChange={(patch) => setNewCostDraft((current) => ({ ...current, ...patch }))}
                services={services}
                materials={materials}
                servicePackages={servicePackages}
                onAddService={handleAddNewServiceCost}
                onAddMaterial={handleAddNewMaterialCost}
                onAddPackage={handleAddNewPackageCost}
                onAddManual={handleAddNewManualCost}
              />

              <div className="flex justify-end gap-2 border-t pt-4">
                <button type="button" onClick={() => setNewTransformerOpen(false)} className="rounded-lg border px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                  Abbrechen
                </button>
                <button type="button" onClick={handleSaveNewTransformer} disabled={isSavingNewTransformer} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
                  {isSavingNewTransformer ? 'Speichern …' : 'Als Asset speichern'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedItem && overrideDraft && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-hidden bg-slate-950/40 p-4">
          <div className="flex h-[calc(100vh-2rem)] w-[calc(100vw-2rem)] max-w-none flex-col rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b px-6 py-4">
              <div>
                <h2 className="text-xl font-bold text-slate-950">{selectedItem.position} · Trafo-Detail</h2>
                <p className="text-sm text-slate-500">Klick auf HT-Nummer öffnet Kalkulation, Reservierung, Verlauf, Quelle und Fotos.</p>
              </div>
              <button type="button" onClick={() => setSelectedPosition(null)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
                <X size={18} />
              </button>
            </div>

            {message && <div className="mx-6 mt-4 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-800">{message}</div>}

            <div className="min-h-0 flex-1 overflow-auto p-6">
              <div className="grid gap-4 lg:grid-cols-2">
              <section className="rounded-xl border p-4">
                <h3 className="mb-3 font-bold text-slate-900">Verkaufskalkulation</h3>
                <div className="mb-3 text-sm text-slate-600">
                  Zuletzt kalkuliert: <b>{latestCalculationLink ? new Date(latestCalculationLink.calculatedAt).toLocaleString('de-DE') : 'noch nicht'}</b><br />
                  Für: <b>{customerName(customers, latestCalculationLink?.customerId)}</b>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  <select value={calcCustomerId} onChange={(event) => setCalcCustomerId(event.target.value)} className="rounded-lg border px-3 py-2 sm:col-span-2">
                    <option value="">Kunde wählen</option>
                    {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
                  </select>
                  <input type="number" value={calcPrice} onChange={(event) => setCalcPrice(Number(event.target.value))} placeholder="VK €" className="rounded-lg border px-3 py-2" />
                </div>
                <button type="button" onClick={handleCreateCalculation} className="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
                  Verkaufskalkulation anlegen + Trafo hinzufügen
                </button>
                <button type="button" onClick={handleOpenCalculationPicker} className="ml-2 mt-3 rounded-lg border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50">
                  In neuer Kalkulation öffnen
                </button>
                {selectedAsset && (
                  <label className="mt-4 flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={Boolean(selectedAsset.forSale)}
                      onChange={(event) => handleToggleSelectedAssetForSale(event.target.checked)}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    Zu verkaufen
                  </label>
                )}
              </section>

              <section className="rounded-xl border p-4">
                <h3 className="mb-3 font-bold text-slate-900">Reservierung</h3>
                <div className="mb-3 text-sm text-slate-600">
                  Aktuell: <b>{activeReservation ? `${customerName(customers, activeReservation.customerId)} bis ${activeReservation.reservedUntil}` : 'nicht reserviert'}</b>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <select value={reservationCustomerId} onChange={(event) => setReservationCustomerId(event.target.value)} className="rounded-lg border px-3 py-2 sm:col-span-2">
                    <option value="">Kunde wählen</option>
                    {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
                  </select>
                  <input type="date" value={reservedFrom} onChange={(event) => setReservedFrom(event.target.value)} className="rounded-lg border px-3 py-2" />
                  <input type="date" value={reservedUntil} onChange={(event) => setReservedUntil(event.target.value)} className="rounded-lg border px-3 py-2" />
                  <input value={reservationNote} onChange={(event) => setReservationNote(event.target.value)} placeholder="Notiz" className="rounded-lg border px-3 py-2 sm:col-span-2" />
                </div>
                <button type="button" onClick={handleReserve} className="mt-3 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
                  Für Zeitraum reservieren
                </button>
              </section>

              <section className="rounded-xl border p-4 lg:col-span-2">
                <h3 className="mb-3 font-bold text-slate-900">Trafodaten bearbeiten</h3>
                <div className="grid gap-2 sm:grid-cols-4">
                  <input value={overrideDraft.manufacturer} onChange={(event) => setOverrideDraft({ ...overrideDraft, manufacturer: event.target.value })} placeholder="Hersteller" className="rounded-lg border px-3 py-2" />
                  <input value={overrideDraft.powerKva} onChange={(event) => setOverrideDraft({ ...overrideDraft, powerKva: event.target.value })} placeholder="kVA" className="rounded-lg border px-3 py-2" />
                  <input value={overrideDraft.primaryVoltageKv} onChange={(event) => setOverrideDraft({ ...overrideDraft, primaryVoltageKv: event.target.value })} placeholder="OS kV" className="rounded-lg border px-3 py-2" />
                  <input value={overrideDraft.secondaryVoltageV} onChange={(event) => setOverrideDraft({ ...overrideDraft, secondaryVoltageV: event.target.value })} placeholder="US V" className="rounded-lg border px-3 py-2" />
                  <input value={overrideDraft.vectorGroup} onChange={(event) => setOverrideDraft({ ...overrideDraft, vectorGroup: event.target.value })} placeholder="Schaltgruppe" className="rounded-lg border px-3 py-2" />
                  <input value={overrideDraft.serialNumber} onChange={(event) => setOverrideDraft({ ...overrideDraft, serialNumber: event.target.value })} placeholder="Seriennr." className="rounded-lg border px-3 py-2" />
                  <input value={overrideDraft.constructionYear} onChange={(event) => setOverrideDraft({ ...overrideDraft, constructionYear: event.target.value })} placeholder="Bj." className="rounded-lg border px-3 py-2" />
                  <input value={overrideDraft.weightKg} onChange={(event) => setOverrideDraft({ ...overrideDraft, weightKg: event.target.value })} placeholder="Gewicht kg" className="rounded-lg border px-3 py-2" />
                  <input value={overrideDraft.constructionType} onChange={(event) => setOverrideDraft({ ...overrideDraft, constructionType: event.target.value })} placeholder="Bauart" className="rounded-lg border px-3 py-2" />
                  <input value={overrideDraft.origin} onChange={(event) => setOverrideDraft({ ...overrideDraft, origin: event.target.value })} placeholder="Herkunft" className="rounded-lg border px-3 py-2" />
                  <input value={overrideDraft.connectionType} onChange={(event) => setOverrideDraft({ ...overrideDraft, connectionType: event.target.value })} placeholder="Anschluss" className="rounded-lg border px-3 py-2" />
                  <input value={overrideDraft.priceNote} onChange={(event) => setOverrideDraft({ ...overrideDraft, priceNote: event.target.value })} placeholder="Preisnotiz" className="rounded-lg border px-3 py-2" />
                  <textarea value={overrideDraft.note} onChange={(event) => setOverrideDraft({ ...overrideDraft, note: event.target.value })} placeholder="Notiz" className="rounded-lg border px-3 py-2 sm:col-span-4" />
                </div>
                <button type="button" onClick={handleSaveOverride} className="mt-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100">
                  Trafodaten speichern
                </button>
              </section>

              <TransformerCostSection
                items={selectedCostItems}
                draft={detailCostDraft}
                onDraftChange={(patch) => setDetailCostDraft((current) => ({ ...current, ...patch }))}
                services={services}
                materials={materials}
                servicePackages={servicePackages}
                onAddService={handleAddDetailServiceCost}
                onAddMaterial={handleAddDetailMaterialCost}
                onAddPackage={handleAddDetailPackageCost}
                onAddManual={handleAddDetailManualCost}
              />

              <section className="rounded-xl border p-4">
                <h3 className="mb-3 font-bold text-slate-900">Verlauf</h3>
                <div className="space-y-2 text-sm">
                  {calculationLinks.filter((link) => link.inventoryPosition === selectedItem.position).map((link) => (
                    <div key={link.id} className="rounded-lg bg-slate-50 p-2">
                      Kalkuliert am {new Date(link.calculatedAt).toLocaleString('de-DE')} für {customerName(customers, link.customerId)}
                    </div>
                  ))}
                  {selectedReservations.map((reservation) => (
                    <div key={reservation.id} className="rounded-lg bg-blue-50 p-2">
                      Reserviert {reservation.reservedFrom}–{reservation.reservedUntil} für {customerName(customers, reservation.customerId)} · {reservation.status}
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-xl border p-4">
                <h3 className="mb-3 font-bold text-slate-900">Fotos / Dokumente</h3>
                <input value={attachmentCaption} onChange={(event) => setAttachmentCaption(event.target.value)} placeholder="Bild-/Dateinotiz" className="mb-2 w-full rounded-lg border px-3 py-2" />
                <input type="file" onChange={handleAttachmentUpload} className="mb-3 text-sm" />
                <div className="grid gap-2 sm:grid-cols-2">
                  {selectedAttachments.map((attachment) => (
                    <a key={attachment.id} href={attachment.storageKey} target="_blank" rel="noreferrer" className="rounded-lg border p-2 text-sm hover:bg-slate-50">
                      {attachment.mimeType?.startsWith('image/') && <img src={attachment.storageKey} alt={attachment.caption ?? attachment.fileName} className="mb-2 h-24 w-full rounded object-cover" />}
                      <b>{attachment.fileName}</b><br />{attachment.caption || attachment.type}
                    </a>
                  ))}
                </div>
              </section>

              <section className="rounded-xl border bg-slate-50 p-4 lg:col-span-2">
                <h3 className="mb-2 font-bold text-slate-900">Quelle</h3>
                <p className="text-sm text-slate-600">Dieser Lagertrafo kommt direkt aus dem HWERP-Assetbestand. Manuelle Änderungen bleiben am Asset bzw. als Detail-Overlay per HT-Nummer gespeichert.</p>
                <pre className="mt-3 max-h-40 overflow-auto rounded-lg bg-white p-3 text-xs">{JSON.stringify(selectedAsset ?? selectedItem, null, 2)}</pre>
              </section>
            </div>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
