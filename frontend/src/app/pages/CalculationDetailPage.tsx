import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { Save, X, Plus, Trash2, Box, ChevronUp, ChevronDown, GripVertical, Search, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Car, FileText, Warehouse } from 'lucide-react';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { useAppStore } from '../context/AppStoreContext';
import {
  Calculation,
  Customer,
  Location,
  AssetNode,
  LocationCustomer,
  CalculationLineItem,
  Material,
  Service,
} from '../lib/types';
import DevTooltip from '../components/DevTooltip';
import Tooltip from '../components/Tooltip';
import SearchableSelect from '../components/SearchableSelect';
import FahrtblockDialog from '../components/FahrtblockDialog';
import AdjustReturnTripDialog from '../components/AdjustReturnTripDialog';
import { uuid } from '../lib/utils';
import { usePriceVisibility } from '../context/PriceVisibilityContext';
import { useModalClose } from '../hooks/useModalClose';
import { assignPositionNumbers, computeHeaderAggregates, getGroupIndices } from '../lib/calculationUtils';
import { buildInfoCalculationLineItem, buildInventorySaleLineItem } from '../lib/calculationLineItems';
import { buildTransformerInventoryRows } from '../features/transformer-inventory/manualTransformerAssets';
import type { TransformerInventoryCalculationLink, TransformerInventoryItem } from '../features/transformer-inventory/types';

// ── Dezimal-Hilfsfunktion ────────────────────────────────────────────────────
const parseQuantity = (raw: string) => parseFloat(raw.replace(',', '.')) || 0;

// ── Hierarchie-Hilfsfunktionen ────────────────────────────────────────────────

/** Tiefe eines Items: 0 = root, 1 = Kind von root-Header, 2 = Enkel, … */
function getDepth(item: CalculationLineItem, items: CalculationLineItem[]): number {
  if (!item.assetHeaderId) return 0;
  const parent = items.find((i) => i.id === item.assetHeaderId);
  return parent ? 1 + getDepth(parent, items) : 0;
}

/** Geschwister: alle Items mit gleichem assetHeaderId, in flat-array Reihenfolge */
function getSiblings(item: CalculationLineItem, items: CalculationLineItem[]): CalculationLineItem[] {
  return items.filter((i) => i.assetHeaderId === item.assetHeaderId);
}

// ── Drag & Drop Typen ────────────────────────────────────────────────────────
const LINE_ITEM_TYPE = 'calc_line_item';
interface DragItem { id: string; index: number; }

interface DraggableRowProps {
  id: string;
  index: number;
  onMove: (from: number, to: number) => void;
  onDropIntoHeader?: (fromIndex: number) => void;
  rowClassName?: string;
  children: React.ReactNode;
}

function DraggableRow({ id, index, onMove, onDropIntoHeader, rowClassName, children }: DraggableRowProps) {
  const rowRef = useRef<HTMLTableRowElement>(null);
  const handleRef = useRef<HTMLTableCellElement>(null);

  const [{ isDragging }, drag, preview] = useDrag<DragItem, void, { isDragging: boolean }>({
    type: LINE_ITEM_TYPE,
    item: () => ({ id, index }),
    collect: (monitor) => ({ isDragging: monitor.isDragging() }),
  }, [id, index]);

  const [{ isOver }, drop] = useDrop<DragItem, void, { isOver: boolean }>({
    accept: LINE_ITEM_TYPE,
    hover(dragItem, monitor) {
      if (!rowRef.current) return;
      const from = dragItem.index;
      const to = index;
      if (from === to) return;
      const rect = rowRef.current.getBoundingClientRect();
      const mouseY = monitor.getClientOffset()!.y;

      // Drop-into-Header: untere 35% der Header-Zeile → kein Reorder
      if (onDropIntoHeader && mouseY > rect.bottom - rect.height * 0.35) {
        return;
      }

      const midY = rect.top + rect.height / 2;
      if (from < to && mouseY < midY) return;
      if (from > to && mouseY > midY) return;
      onMove(from, to);
      dragItem.index = to;
    },
    drop(dragItem, monitor) {
      if (!onDropIntoHeader) return;
      if (!rowRef.current) return;
      const rect = rowRef.current.getBoundingClientRect();
      const mouseY = monitor.getClientOffset()?.y ?? 0;
      if (mouseY > rect.bottom - rect.height * 0.35) {
        onDropIntoHeader(dragItem.index);
      }
    },
    collect: (monitor) => ({ isOver: monitor.isOver() }),
  }, [id, index, onMove, onDropIntoHeader]);

  drag(handleRef);
  drop(preview(rowRef));

  // Visueller Indikator: blauer Unterrand wenn über Header-Drop-Zone
  const dropZoneIndicator = onDropIntoHeader && isOver
    ? 'border-b-2 border-b-blue-500'
    : '';

  return (
    <tr
      ref={rowRef}
      className={`${rowClassName ?? ''} ${isDragging ? 'opacity-30' : ''} ${isOver && !onDropIntoHeader ? 'ring-2 ring-inset ring-blue-400' : ''} ${dropZoneIndicator}`}
    >
      <td
        ref={handleRef}
        className="pl-2 pr-1 w-7 cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 transition-colors select-none"
      >
        <GripVertical size={14} />
      </td>
      {children}
    </tr>
  );
}

/**
 * Detailseite für Kalkulationen (Create / Edit)
 *
 * Häppchen E: Mit Positionen (Material-LineItems)
 * Nummer wird erst beim ersten Speichern via Sequence-Entity vergeben.
 */
export default function CalculationDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { state, dispatch, repository } = useAppStore();
  const { pricesVisible } = usePriceVisibility();

  const isNew = !id || id === 'new';

  // Lokaler State für das Formular
  const [formData, setFormData] = useState<Partial<Calculation>>({
    title: '',
    description: '',
    customerId: '',
    locationId: '',
    assetId: '',
    status: 'DRAFT',
  });

  // LineItems separat (lokale State vor Speichern)
  const [lineItems, setLineItems] = useState<CalculationLineItem[]>([]);

  // Auswahl-Dialoge
  const [showMaterialDialog, setShowMaterialDialog] = useState(false);
  const [showServiceDialog, setShowServiceDialog] = useState(false);
  const [showInfoDialog, setShowInfoDialog] = useState(false);
  const [infoText, setInfoText] = useState('');

  // Asset-Dialog (zweistufig: Auswahl → Behandlungsart)
  const [showAssetDialog, setShowAssetDialog] = useState(false);
  const [assetDialogStep, setAssetDialogStep] = useState<'pick' | 'treatment'>('pick');
  const [selectedAssetForTreatment, setSelectedAssetForTreatment] = useState<AssetNode | null>(null);
  const [buySellPrice, setBuySellPrice] = useState<number>(0);
  const [assetPickerSearch, setAssetPickerSearch] = useState('');
  const [showAllAssetsInPicker, setShowAllAssetsInPicker] = useState(false);

  // Lagertrafo-Dialog: Asset-basierten Lagertrafo als Angebotsposition einfügen
  const [showInventoryDialog, setShowInventoryDialog] = useState(false);
  const [inventoryPickerSearch, setInventoryPickerSearch] = useState('');
  const [inventorySalePrice, setInventorySalePrice] = useState<number>(0);

  // FahrtblockDialog
  const [showFahrtblockDialog, setShowFahrtblockDialog] = useState(false);
  const [fahrtblockAsset, setFahrtblockAsset] = useState<AssetNode | null>(null);
  const [fahrtblockHeaderId, setFahrtblockHeaderId] = useState<string | null>(null);

  // AdjustReturnTripDialog
  const [showAdjustReturnDialog, setShowAdjustReturnDialog] = useState(false);
  const [pendingTravelItems, setPendingTravelItems] = useState<Partial<CalculationLineItem>[]>([]);

  // „Unterhalb hinzufügen"-Dropdown
  const [insertDropdownId, setInsertDropdownId] = useState<string | null>(null);
  const [insertAfterId, setInsertAfterId] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(!isNew);
  const [isSaving, setIsSaving] = useState(false);

  // Daten laden (Kunden, Standorte, Assets für Dropdowns + Calculation bei Edit)
  useEffect(() => {
    async function loadData() {
      try {
        const [custs, locs, assetsData, locCusts, mats, srvs] = await Promise.all([
          repository.list<Customer>('customers'),
          repository.list<Location>('locations'),
          repository.list<AssetNode>('assets'),
          repository.list<LocationCustomer>('locationCustomers'),
          repository.list<Material>('materials'),
          repository.list<Service>('services'),
        ]);

        dispatch({ type: 'SET_ENTITIES', entity: 'customers', data: custs });
        dispatch({ type: 'SET_ENTITIES', entity: 'locations', data: locs });
        dispatch({ type: 'SET_ENTITIES', entity: 'assets', data: assetsData });
        dispatch({ type: 'SET_ENTITIES', entity: 'locationCustomers', data: locCusts });
        dispatch({ type: 'SET_ENTITIES', entity: 'materials', data: mats });
        dispatch({ type: 'SET_ENTITIES', entity: 'services', data: srvs });

        if (!isNew && id) {
          const calc = await repository.get<Calculation>('calculations', id);
          if (calc) {
            setFormData(calc);
            // LineItems laden
            const items = await repository.list<CalculationLineItem>('calculationLineItems');
            setLineItems(items.filter((item) => item.calculationId === id));
          } else {
            console.error('Kalkulation nicht gefunden');
            navigate('/calculations');
          }
        }
      } catch (error) {
        console.error('Fehler beim Laden der Daten:', error);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [id, isNew, repository, dispatch, navigate]);

  const customers = (state.customers as Customer[]) || [];
  const locations = (state.locations as Location[]) || [];
  const assets = (state.assets as AssetNode[]) || [];
  const inventoryItems = useMemo(() => buildTransformerInventoryRows(assets), [assets]);
  const locationCustomers = (state.locationCustomers as LocationCustomer[]) || [];
  const materials = (state.materials as Material[]) || [];
  const services = (state.services as Service[]) || [];

  useEffect(() => {
    const requestedInventoryPosition = searchParams.get('inventoryPosition');
    if (!requestedInventoryPosition) return;

    setInventoryPickerSearch(requestedInventoryPosition);
    setShowInventoryDialog(true);
  }, [searchParams]);

  // Kaskadierende Filterung: Standorte → nur Standorte des gewählten Kunden
  const filteredLocations = useMemo(() => {
    if (!formData.customerId) return locations;
    const allowedLocationIds = new Set(
      locationCustomers
        .filter((lc) => lc.customerId === formData.customerId)
        .map((lc) => lc.locationId)
    );
    return locations.filter((l) => allowedLocationIds.has(l.id));
  }, [formData.customerId, locations, locationCustomers]);

  // Kaskadierende Filterung: Assets → nur Assets des gewählten Kunden/Standorts
  const filteredAssets = useMemo(() => {
    let result = assets;
    if (formData.customerId) {
      result = result.filter((a) => a.customerId === formData.customerId);
    }
    if (formData.locationId) {
      result = result.filter((a) => a.locationId === formData.locationId);
    }
    return result;
  }, [formData.customerId, formData.locationId, assets]);

  // Kundenwechsel: Standort und Asset zurücksetzen wenn nicht mehr gültig
  const handleCustomerChange = (newCustomerId: string) => {
    const updates: Partial<Calculation> = { customerId: newCustomerId };

    if (newCustomerId) {
      // Prüfe ob aktueller Standort zum neuen Kunden gehört
      const allowedLocationIds = new Set(
        locationCustomers
          .filter((lc) => lc.customerId === newCustomerId)
          .map((lc) => lc.locationId)
      );
      if (formData.locationId && !allowedLocationIds.has(formData.locationId)) {
        updates.locationId = '';
      }

      // Prüfe ob aktuelles Asset zum neuen Kunden gehört
      const locationId =
        updates.locationId !== undefined ? updates.locationId : formData.locationId;
      const assetStillValid =
        formData.assetId &&
        assets.some(
          (a) =>
            a.id === formData.assetId &&
            a.customerId === newCustomerId &&
            (!locationId || a.locationId === locationId)
        );
      if (!assetStillValid) {
        updates.assetId = '';
      }
    } else {
      // Kein Kunde → alles zurücksetzen
      updates.locationId = '';
      updates.assetId = '';
    }

    setFormData({ ...formData, ...updates });
  };

  // Standortwechsel: Asset zurücksetzen wenn nicht mehr gültig
  const handleLocationChange = (newLocationId: string) => {
    const updates: Partial<Calculation> = { locationId: newLocationId };

    if (newLocationId && formData.assetId) {
      const assetStillValid = assets.some(
        (a) => a.id === formData.assetId && a.locationId === newLocationId
      );
      if (!assetStillValid) {
        updates.assetId = '';
      }
    }

    setFormData({ ...formData, ...updates });
  };

  // ========================================================
  // LineItem Funktionen
  // ========================================================

  const addMaterialToCalculation = (material: Material) => {
    const newLineItem: CalculationLineItem = {
      id: uuid(),
      calculationId: id || '',
      positionNumber: null,
      assetHeaderId: null,
      type: 'material',
      materialId: material.id,
      serviceId: null,
      description: material.name,
      quantity: 1,
      unit: material.unit,
      unitPrice: material.price,
      totalPrice: material.price,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (insertAfterId) {
      insertAfterItem(insertAfterId, [newLineItem]);
      setInsertAfterId(null);
    } else {
      setLineItems(assignPositionNumbers([...lineItems, newLineItem]));
    }
    setShowMaterialDialog(false);
  };

  const addServiceToCalculation = (service: Service) => {
    const newLineItem: CalculationLineItem = {
      id: uuid(),
      calculationId: id || '',
      positionNumber: null,
      assetHeaderId: null,
      type: 'service',
      materialId: null,
      serviceId: service.id,
      description: service.name,
      quantity: 1,
      unit: service.unit,
      unitPrice: service.price,
      totalPrice: service.price,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (insertAfterId) {
      insertAfterItem(insertAfterId, [newLineItem]);
      setInsertAfterId(null);
    } else {
      setLineItems(assignPositionNumbers([...lineItems, newLineItem]));
    }
    setShowServiceDialog(false);
  };

  const addInventoryTransformerToCalculation = (inventoryItem: TransformerInventoryItem) => {
    const newLineItem = buildInventorySaleLineItem({
      id: uuid(),
      calculationId: id || '',
      inventoryItem,
      price: inventorySalePrice,
    });

    if (insertAfterId) {
      insertAfterItem(insertAfterId, [newLineItem]);
      setInsertAfterId(null);
    } else {
      setLineItems(assignPositionNumbers([...lineItems, newLineItem]));
    }

    setShowInventoryDialog(false);
    setInventoryPickerSearch('');
    setInventorySalePrice(0);
    setSearchParams((current) => {
      current.delete('inventoryPosition');
      return current;
    }, { replace: true });
  };

  const addInfoToCalculation = () => {
    const description = infoText.trim();
    if (!description) return;

    const newLineItem = buildInfoCalculationLineItem({
      id: uuid(),
      calculationId: id || '',
      description,
    });

    if (insertAfterId) {
      insertAfterItem(insertAfterId, [newLineItem]);
      setInsertAfterId(null);
    } else {
      setLineItems(assignPositionNumbers([...lineItems, newLineItem]));
    }

    setInfoText('');
    setShowInfoDialog(false);
  };

  const addAssetToCalculation = (
    asset: AssetNode,
    treatment: 'buy_sell' | 'workshop' | 'on_site',
    price: number = 0
  ) => {
    const base = {
      calculationId: id || '',
      materialId: null as null,
      serviceId: null as null,
      assetHeaderId: null as null,
      positionNumber: null as null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const newItems: CalculationLineItem[] = [];

    if (treatment === 'buy_sell') {
      newItems.push({
        ...base,
        id: uuid(),
        type: 'asset_header',
        assetNodeId: asset.id,
        description: asset.name,
        quantity: 1,
        unit: 'Stk',
        unitPrice: price,
        totalPrice: price,
      });
    } else if (treatment === 'workshop') {
      newItems.push({
        ...base,
        id: uuid(),
        type: 'asset_header',
        assetNodeId: asset.id,
        description: asset.name,
        quantity: 1,
        unit: 'Stk',
        unitPrice: 0,
        totalPrice: 0,
      });
    } else if (treatment === 'on_site') {
      const headerId = uuid();

      // 1. Asset-Header
      newItems.push({
        ...base,
        id: headerId,
        type: 'asset_header',
        assetNodeId: asset.id,
        description: asset.name,
        quantity: 1,
        unit: 'Stk',
        unitPrice: 0,
        totalPrice: 0,
      });

      // 2. Standort als Info-Zeile (Child des Headers)
      const location = locations.find((l) => l.id === formData.locationId);
      newItems.push(buildInfoCalculationLineItem({
        id: uuid(),
        calculationId: id || '',
        assetHeaderId: headerId,
        description: `Standort: ${location?.name ?? 'Vor Ort'}`,
      }));

      // Asset-Header + Info-Zeile sofort einfügen, dann FahrtblockDialog öffnen
      setLineItems(assignPositionNumbers([...lineItems, ...newItems]));
      setShowAssetDialog(false);
      setAssetDialogStep('pick');
      setSelectedAssetForTreatment(null);
      setBuySellPrice(0);

      // FahrtblockDialog öffnen für Fahrtzeilen-Konfiguration
      setFahrtblockAsset(asset);
      setFahrtblockHeaderId(headerId);
      setShowFahrtblockDialog(true);
      return;
    }

    setLineItems(assignPositionNumbers([...lineItems, ...newItems]));
    setShowAssetDialog(false);
    setAssetDialogStep('pick');
    setSelectedAssetForTreatment(null);
    setBuySellPrice(0);
  };

  const updateLineItem = (itemId: string, updates: Partial<CalculationLineItem>) => {
    setLineItems(
      lineItems.map((item) => {
        if (item.id === itemId) {
          const updated = { ...item, ...updates };
          // Recalculate totalPrice
          updated.totalPrice = updated.quantity * updated.unitPrice;
          return updated;
        }
        return item;
      })
    );
  };

  const deleteLineItem = (itemId: string) => {
    setLineItems(lineItems.filter((item) => item.id !== itemId));
  };

  // Tauscht Positionen anhand ihrer Indizes; verschiebt asset_header-Gruppen als Block
  const moveLineItem = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= lineItems.length) return;

    let reordered: CalculationLineItem[];

    if (lineItems[fromIndex]?.type === 'asset_header') {
      // Ganze Gruppe als Block verschieben (Header + alle direkten Children via assetHeaderId)
      const groupIndices = getGroupIndices(lineItems, fromIndex);
      const groupItems = groupIndices.map(i => lineItems[i]);
      const rest = lineItems.filter((_, i) => !groupIndices.includes(i));
      const insertAt = toIndex <= fromIndex
        ? Math.max(0, toIndex)
        : toIndex - groupItems.length + 1;
      const clampedInsert = Math.max(0, Math.min(insertAt, rest.length));
      reordered = [...rest.slice(0, clampedInsert), ...groupItems, ...rest.slice(clampedInsert)];
    } else {
      // Einzelnes Item verschieben
      reordered = [...lineItems];
      const [moved] = reordered.splice(fromIndex, 1);
      reordered.splice(toIndex, 0, moved);
    }

    setLineItems(assignPositionNumbers(reordered));
  };

  const moveLineItemByStep = (itemId: string, direction: 'up' | 'down') => {
    const index = lineItems.findIndex((item) => item.id === itemId);
    if (index === -1) return;
    moveLineItem(index, direction === 'up' ? index - 1 : index + 1);
  };

  // Hängt ein Child-Item an einen anderen Header um (Reparenting via Drop-on-Header)
  const reparentToHeader = (fromIndex: number, headerIndex: number) => {
    if (fromIndex === headerIndex) return;
    const headerId = lineItems[headerIndex].id;
    const updated = lineItems.map((item, i) =>
      i === fromIndex ? { ...item, assetHeaderId: headerId } : item
    );
    setLineItems(assignPositionNumbers(updated));
  };

  // Fügt newItems direkt nach afterId ein (nach dem Ende der Gruppe bei asset_header)
  const insertAfterItem = (afterId: string, newItems: CalculationLineItem[]) => {
    const idx = lineItems.findIndex((i) => i.id === afterId);
    if (idx === -1) return;
    const anchor = lineItems[idx];

    const insertAt = anchor.type === 'asset_header'
      ? Math.max(...getGroupIndices(lineItems, idx)) + 1
      : idx + 1;

    const withParent = newItems.map((i) => ({ ...i, assetHeaderId: anchor.assetHeaderId }));
    const updated = [...lineItems];
    updated.splice(insertAt, 0, ...withParent);
    setLineItems(assignPositionNumbers(updated));
  };

  // ── Fahrtblock-Bestätigung ─────────────────────────────────────────────────

  const handleFahrtblockConfirm = useCallback(
    (travelItems: Partial<CalculationLineItem>[]) => {
      setShowFahrtblockDialog(false);

      if (travelItems.length === 0 || !fahrtblockHeaderId) return;

      // Fahrtzeilen dem Header zuweisen
      const withHeader = travelItems.map((item) => ({
        ...item,
        assetHeaderId: fahrtblockHeaderId,
        calculationId: id || '',
      })) as CalculationLineItem[];

      // Prüfen ob bereits Rückfahrt-Items in den lineItems vorhanden sind
      const existingReturnItems = lineItems.filter((i) => i.travelRole === 'outbound');

      // lineItems mit neuen Fahrtzeilen zusammenführen
      const updated = assignPositionNumbers([...lineItems, ...withHeader]);

      if (existingReturnItems.length > 0 && withHeader.some((i) => i.travelRole === 'outbound')) {
        // AdjustReturnTripDialog anbieten
        setPendingTravelItems(withHeader);
        setLineItems(updated);
        setShowAdjustReturnDialog(true);
      } else {
        setLineItems(updated);
      }

      setFahrtblockAsset(null);
      setFahrtblockHeaderId(null);
    },
    [fahrtblockHeaderId, id, lineItems]
  );

  const handleRemoveReturn = useCallback(
    (ids: string[]) => {
      setLineItems((prev) => assignPositionNumbers(prev.filter((i) => !ids.includes(i.id))));
      setPendingTravelItems([]);
    },
    []
  );

  // ── Pfeil-Buttons: Umsortieren und Umhängen ───────────────────────────────

  /**
   * Hilfsfunktion: Berechnet insertAt (Position in `rest`) für Blockswaps.
   * Zählt Einträge vor `blockStart` im Originalarray, die NICHT in `allMoving` sind.
   */
  const calcInsertAt = (blockStart: number, allMoving: Set<number>) => {
    let count = 0;
    for (let i = 0; i < blockStart; i++) {
      if (!allMoving.has(i)) count++;
    }
    return count;
  };

  const moveUp = (id: string) => {
    const items = lineItems;
    const itemIndex = items.findIndex((i) => i.id === id);
    if (itemIndex === -1) return;
    const item = items[itemIndex];
    const siblings = getSiblings(item, items);
    const sibIdx = siblings.findIndex((s) => s.id === id);
    if (sibIdx <= 0) return;

    const prevSibling = siblings[sibIdx - 1];
    const prevSibIdx = items.findIndex((i) => i.id === prevSibling.id);

    const itemGroup = item.type === 'asset_header' ? getGroupIndices(items, itemIndex) : [itemIndex];
    const prevGroup = prevSibling.type === 'asset_header' ? getGroupIndices(items, prevSibIdx) : [prevSibIdx];

    const allMoving = new Set([...itemGroup, ...prevGroup]);
    const itemBlock = itemGroup.map((i) => items[i]);
    const prevBlock = prevGroup.map((i) => items[i]);
    const rest = items.filter((_, i) => !allMoving.has(i));

    const insertAt = calcInsertAt(Math.min(...prevGroup), allMoving);
    setLineItems(assignPositionNumbers([...rest.slice(0, insertAt), ...itemBlock, ...prevBlock, ...rest.slice(insertAt)]));
  };

  const moveDown = (id: string) => {
    const items = lineItems;
    const itemIndex = items.findIndex((i) => i.id === id);
    if (itemIndex === -1) return;
    const item = items[itemIndex];
    const siblings = getSiblings(item, items);
    const sibIdx = siblings.findIndex((s) => s.id === id);
    if (sibIdx >= siblings.length - 1) return;

    const nextSibling = siblings[sibIdx + 1];
    const nextSibIdx = items.findIndex((i) => i.id === nextSibling.id);

    const itemGroup = item.type === 'asset_header' ? getGroupIndices(items, itemIndex) : [itemIndex];
    const nextGroup = nextSibling.type === 'asset_header' ? getGroupIndices(items, nextSibIdx) : [nextSibIdx];

    const allMoving = new Set([...itemGroup, ...nextGroup]);
    const itemBlock = itemGroup.map((i) => items[i]);
    const nextBlock = nextGroup.map((i) => items[i]);
    const rest = items.filter((_, i) => !allMoving.has(i));

    const insertAt = calcInsertAt(Math.min(...itemGroup), allMoving);
    setLineItems(assignPositionNumbers([...rest.slice(0, insertAt), ...nextBlock, ...itemBlock, ...rest.slice(insertAt)]));
  };

  /** Promote: eine Ebene nach oben (Kind des Großeltern-Headers werden) */
  const promote = (id: string) => {
    const items = lineItems;
    const itemIndex = items.findIndex((i) => i.id === id);
    if (itemIndex === -1) return;
    const item = items[itemIndex];
    if (!item.assetHeaderId) return; // Bereits Root

    const parent = items.find((i) => i.id === item.assetHeaderId);
    if (!parent) return;

    const itemGroup = item.type === 'asset_header' ? getGroupIndices(items, itemIndex) : [itemIndex];
    const itemGroupSet = new Set(itemGroup);
    const itemBlock = itemGroup.map((i) => ({
      ...items[i],
      ...(items[i].id === id ? { assetHeaderId: parent.assetHeaderId } : {}),
    }));

    const withoutItem = items.filter((_, i) => !itemGroupSet.has(i));
    const parentIdxInRem = withoutItem.findIndex((i) => i.id === parent.id);
    if (parentIdxInRem === -1) return;
    const parentGroup = getGroupIndices(withoutItem, parentIdxInRem);
    const insertAt = Math.max(...parentGroup) + 1;

    setLineItems(assignPositionNumbers([...withoutItem.slice(0, insertAt), ...itemBlock, ...withoutItem.slice(insertAt)]));
  };

  /** Demote: eine Ebene nach unten (Kind des vorigen Geschwister-Headers werden) */
  const demote = (id: string) => {
    const items = lineItems;
    const itemIndex = items.findIndex((i) => i.id === id);
    if (itemIndex === -1) return;
    const item = items[itemIndex];

    const siblings = getSiblings(item, items);
    const sibIdx = siblings.findIndex((s) => s.id === id);
    if (sibIdx <= 0) return;
    const prevSibling = siblings[sibIdx - 1];
    if (prevSibling.type !== 'asset_header') return;

    const itemGroup = item.type === 'asset_header' ? getGroupIndices(items, itemIndex) : [itemIndex];
    const itemGroupSet = new Set(itemGroup);
    const itemBlock = itemGroup.map((i) => ({
      ...items[i],
      ...(items[i].id === id ? { assetHeaderId: prevSibling.id } : {}),
    }));

    const withoutItem = items.filter((_, i) => !itemGroupSet.has(i));
    const prevSibIdxInRem = withoutItem.findIndex((i) => i.id === prevSibling.id);
    if (prevSibIdxInRem === -1) return;
    const prevSibGroup = getGroupIndices(withoutItem, prevSibIdxInRem);
    const insertAt = Math.max(...prevSibGroup) + 1;

    setLineItems(assignPositionNumbers([...withoutItem.slice(0, insertAt), ...itemBlock, ...withoutItem.slice(insertAt)]));
  };

  // Erzeugt 4 leere Fahrt-Items (für „+ Fahrt (auto)" im Dropdown)
  const buildFahrtAutoItems = (now = new Date().toISOString()): CalculationLineItem[] => [
    { id: uuid(), calculationId: id || '', positionNumber: null, assetHeaderId: null, type: 'service', materialId: null, serviceId: null, travelRole: 'inbound', isAutoGenerated: true, relatedAssetId: null, description: 'Hinfahrt (km)', quantity: 0, unit: 'km', unitPrice: 1.00, totalPrice: 0, createdAt: now, updatedAt: now },
    { id: uuid(), calculationId: id || '', positionNumber: null, assetHeaderId: null, type: 'service', materialId: null, serviceId: null, travelRole: 'inbound', isAutoGenerated: true, relatedAssetId: null, description: 'Hinfahrt (Zeit)', quantity: 0, unit: 'Std', unitPrice: 50.00, totalPrice: 0, createdAt: now, updatedAt: now },
    { id: uuid(), calculationId: id || '', positionNumber: null, assetHeaderId: null, type: 'service', materialId: null, serviceId: null, travelRole: 'outbound', isAutoGenerated: true, relatedAssetId: null, description: 'Rückfahrt (km)', quantity: 0, unit: 'km', unitPrice: 1.00, totalPrice: 0, createdAt: now, updatedAt: now },
    { id: uuid(), calculationId: id || '', positionNumber: null, assetHeaderId: null, type: 'service', materialId: null, serviceId: null, travelRole: 'outbound', isAutoGenerated: true, relatedAssetId: null, description: 'Rückfahrt (Zeit)', quantity: 0, unit: 'Std', unitPrice: 50.00, totalPrice: 0, createdAt: now, updatedAt: now },
  ];

  // Aggregatpreise pro asset_header (computed, nicht gespeichert)
  const headerAggregates = useMemo(() => computeHeaderAggregates(lineItems), [lineItems]);

  // Gesamtsumme berechnen
  const totalSum = useMemo(() => {
    return lineItems.reduce((sum, item) => sum + item.totalPrice, 0);
  }, [lineItems]);

  const handleCloseMaterialDialog = useCallback(() => setShowMaterialDialog(false), []);
  const handleMaterialBackdropClick = useModalClose(showMaterialDialog, handleCloseMaterialDialog);

  const handleCloseServiceDialog = useCallback(() => setShowServiceDialog(false), []);
  const handleServiceBackdropClick = useModalClose(showServiceDialog, handleCloseServiceDialog);

  const handleCloseInfoDialog = useCallback(() => {
    setShowInfoDialog(false);
    setInfoText('');
    setInsertAfterId(null);
  }, []);
  const handleInfoBackdropClick = useModalClose(showInfoDialog, handleCloseInfoDialog);

  const handleCloseAssetDialog = useCallback(() => {
    setShowAssetDialog(false);
    setAssetDialogStep('pick');
    setSelectedAssetForTreatment(null);
    setBuySellPrice(0);
    setAssetPickerSearch('');
    setShowAllAssetsInPicker(false);
  }, []);
  const handleAssetBackdropClick = useModalClose(showAssetDialog, handleCloseAssetDialog);

  const handleCloseInventoryDialog = useCallback(() => {
    setShowInventoryDialog(false);
    setInventoryPickerSearch('');
    setInventorySalePrice(0);
    setSearchParams((current) => {
      current.delete('inventoryPosition');
      return current;
    }, { replace: true });
  }, [setSearchParams]);
  const handleInventoryBackdropClick = useModalClose(showInventoryDialog, handleCloseInventoryDialog);

  const handleCloseFahrtblockDialog = useCallback(() => {
    setShowFahrtblockDialog(false);
    setFahrtblockAsset(null);
    setFahrtblockHeaderId(null);
  }, []);

  const handleCloseAdjustReturnDialog = useCallback(() => {
    setShowAdjustReturnDialog(false);
    setPendingTravelItems([]);
  }, []);

  // Click-outside: Insert-Dropdown schließen
  useEffect(() => {
    if (!insertDropdownId) return;
    const handler = () => setInsertDropdownId(null);
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [insertDropdownId]);

  // Speichern-Logik
  const handleSave = async () => {
    setIsSaving(true);
    try {
      let finalCalc: Calculation;
      let calculationId = id;

      if (isNew) {
        // Kalkulationsnummer via dediziertem Sequenz-Endpunkt holen
        const formattedNumber = await repository.getNextCalcNumber();

        calculationId = uuid();
        finalCalc = {
          id: calculationId,
          number: formattedNumber,
          title: formData.title || null,
          description: formData.description || null,
          customerId: formData.customerId || null,
          locationId: formData.locationId || null,
          assetId: formData.assetId || null,
          status: 'DRAFT',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      } else {
        // Update bestehend
        finalCalc = {
          ...(formData as Calculation),
          updatedAt: new Date().toISOString(),
        };
      }

      // Persistieren
      await repository.upsert('calculations', finalCalc);

      // LineItems speichern
      const savedInventoryLinks: TransformerInventoryCalculationLink[] = [];
      for (const item of lineItems) {
        const itemToSave = {
          ...item,
          calculationId: calculationId!,
        };
        await repository.upsert('calculationLineItems', itemToSave);

        if (item.inventoryPosition && finalCalc.customerId) {
          const inventoryPosition = item.inventoryPosition.replace(/^own:/, '');
          const existingLink = (state.transformerInventoryCalculationLinks as TransformerInventoryCalculationLink[]).find(
            (link) => link.inventoryPosition === inventoryPosition && link.calculationId === calculationId,
          );
          const now = new Date().toISOString();
          const link: TransformerInventoryCalculationLink = {
            id: existingLink?.id ?? uuid(),
            inventoryPosition,
            customerId: finalCalc.customerId,
            calculationId: calculationId!,
            calculatedAt: existingLink?.calculatedAt ?? now,
            note: item.description,
            createdAt: existingLink?.createdAt ?? now,
            updatedAt: now,
          };
          await repository.upsert('transformerInventoryCalculationLinks', link);
          savedInventoryLinks.push(link);
        }
      }

      if (savedInventoryLinks.length > 0) {
        const savedIds = new Set(savedInventoryLinks.map((link) => link.id));
        dispatch({
          type: 'SET_ENTITIES',
          entity: 'transformerInventoryCalculationLinks',
          data: [
            ...(state.transformerInventoryCalculationLinks as TransformerInventoryCalculationLink[]).filter((link) => !savedIds.has(link.id)),
            ...savedInventoryLinks,
          ],
        });
      }

      dispatch({
        type: 'SET_ENTITIES',
        entity: 'calculations',
        data: [
          ...(state.calculations as Calculation[]).filter((c) => c.id !== finalCalc.id),
          finalCalc,
        ],
      });

      navigate('/calculations');
    } catch (error) {
      console.error('Fehler beim Speichern:', error);
      alert('Speichern fehlgeschlagen.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <p className="text-gray-600 italic">Lade Kalkulationsdaten...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Sticky Header */}
      <header className="bg-white border-b border-gray-200 px-8 py-4 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex flex-col">
            <h1 className="text-2xl font-bold text-gray-900">
              {isNew ? 'Kalkulation anlegen' : 'Kalkulation bearbeiten'}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm font-medium text-gray-500">
                Nummer:{' '}
                {isNew ? (
                  <span className="italic text-blue-600">wird beim Speichern vergeben</span>
                ) : (
                  <span className="font-mono text-gray-900">{formData.number}</span>
                )}
              </span>
              {isNew && (
                <DevTooltip
                  text="DEV: Nummer wird erst beim Speichern vergeben, damit keine Lücken durch abgebrochene Drafts entstehen."
                  placement="bottom"
                />
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/calculations')}
              className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <X size={18} />
              Abbrechen
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50"
            >
              <Save size={18} />
              {isSaving ? 'Speichert...' : 'Speichern'}
            </button>
          </div>
        </div>
      </header>

      {/* Main Form Content */}
      <main className="p-8 flex-1">
        <div className="max-w-5xl mx-auto bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
            {/* Zeile 1: Titel | Status */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-gray-700">Titel</label>
              <input
                type="text"
                placeholder="Name der Kalkulation"
                value={formData.title || ''}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-gray-700">Status</label>
              <div className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-500 font-medium">
                Entwurf
              </div>
            </div>

            {/* Zeile 2: Kunde | Standort */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-gray-700">Kunde</label>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-blue-400 opacity-50">Neu anlegen</span>
                  <Tooltip
                    text="Kommt im nächsten Schritt (Inline-Anlegen aus Kalkulation)."
                    placement="left"
                  />
                </div>
              </div>
              <SearchableSelect
                value={formData.customerId || null}
                onChange={(id) => handleCustomerChange(id || '')}
                options={customers.map((c) => ({ id: c.id, label: c.name }))}
                placeholder="-- Kein Kunde --"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-gray-700">(Erster) Standort</label>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-blue-400 opacity-50">Neu anlegen</span>
                  <Tooltip
                    text="Kommt im nächsten Schritt (Inline-Anlegen aus Kalkulation)."
                    placement="left"
                  />
                </div>
              </div>
              <SearchableSelect
                value={formData.locationId || null}
                onChange={(id) => handleLocationChange(id || '')}
                options={filteredLocations.map((l) => ({ id: l.id, label: l.name }))}
                placeholder="-- Kein Standort --"
              />
            </div>


            {/* Zeile 4: Beschreibung (Full Width) */}
            <div className="md:col-span-2 flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-gray-700">Beschreibung</label>
              <textarea
                placeholder="Zusätzliche Details zur Kalkulation..."
                rows={5}
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none"
              />
            </div>
          </div>
        </div>

        {/* ================================================================ */}
        {/* Positions-Tabelle (LineItems)                                   */}
        {/* ================================================================ */}
        <DndProvider backend={HTML5Backend}>
        <div className="max-w-5xl mx-auto bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden mt-8">
          <div className="p-6 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">Positionen</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowMaterialDialog(true)}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
              >
                <Plus size={16} />
                Material
              </button>
              <button
                onClick={() => setShowServiceDialog(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
              >
                <Plus size={16} />
                Service
              </button>
              <button
                onClick={() => { setShowInventoryDialog(true); setInventoryPickerSearch(''); setInventorySalePrice(0); }}
                className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors text-sm"
              >
                <Warehouse size={16} />
                Lagertrafo hinzufügen
              </button>
              <button
                onClick={() => setShowInfoDialog(true)}
                className="flex items-center gap-2 px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors text-sm"
              >
                <FileText size={16} />
                Hinweistext hinzufügen
              </button>
              <button
                onClick={() => { setShowAssetDialog(true); setAssetDialogStep('pick'); setAssetPickerSearch(''); setShowAllAssetsInPicker(false); }}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm"
              >
                <Box size={16} />
                Asset
              </button>
            </div>
          </div>

          {/* Tabelle */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="w-7" />
                  <th className="text-left px-4 py-3 font-medium text-gray-600 w-16">Pos.</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Beschreibung</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 w-24">Menge</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 w-24">Einheit</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600 w-32">
                    Einzelpreis
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600 w-32">
                    Gesamt
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600 w-24">
                    Aktionen
                  </th>
                </tr>
              </thead>
              <tbody>
                {lineItems.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-8 text-center text-gray-400"
                    >
                      Noch keine Positionen. Klicken Sie auf „Material" oder „Service" um
                      zu starten.
                    </td>
                  </tr>
                ) : (
                  lineItems.map((item, index) => {
                    // Gemeinsame Disabled-States für Pfeil-Buttons
                    const _siblings = getSiblings(item, lineItems);
                    const _sibIdx = _siblings.findIndex((s) => s.id === item.id);
                    const isFirstSib = _sibIdx <= 0;
                    const isLastSib = _sibIdx >= _siblings.length - 1;
                    const canPromoteItem = item.assetHeaderId !== null;
                    const canDemoteItem = _sibIdx > 0 && _siblings[_sibIdx - 1].type === 'asset_header';
                    const depth = getDepth(item, lineItems);

                    const arrowBtnClass = 'p-1 rounded hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed';

                    // ── asset_header ──────────────────────────────────────
                    if (item.type === 'asset_header') {
                      const hasBuySellPrice = item.unitPrice > 0;
                      const location = locations.find((l) => l.id === formData.locationId);
                      return (
                        <DraggableRow
                          key={item.id}
                          id={item.id}
                          index={index}
                          onMove={moveLineItem}
                          onDropIntoHeader={(fromIndex) => reparentToHeader(fromIndex, index)}
                          rowClassName={`border-b ${hasBuySellPrice ? 'bg-amber-50 border-amber-200' : 'bg-purple-50 border-purple-200'}`}
                        >
                          <td className="px-4 py-2 text-gray-500 font-mono text-xs">{item.positionNumber ?? '—'}</td>
                          <td className="px-4 py-2" colSpan={hasBuySellPrice ? 1 : 3} style={{ paddingLeft: depth > 0 ? `${depth * 1.5}rem` : undefined }}>
                            <div className="flex items-center gap-2">
                              <Box size={14} className={hasBuySellPrice ? 'text-amber-600' : 'text-purple-600'} />
                              <input
                                type="text"
                                value={item.description}
                                onChange={(e) => updateLineItem(item.id, { description: e.target.value })}
                                className={`font-semibold bg-transparent border-none outline-none text-sm w-full ${hasBuySellPrice ? 'text-amber-900' : 'text-purple-900'}`}
                              />
                              <span className={`text-xs px-1.5 py-0.5 rounded shrink-0 ${hasBuySellPrice ? 'bg-amber-100 text-amber-700' : 'bg-purple-100 text-purple-700'}`}>
                                {hasBuySellPrice ? 'Kauf/Verkauf' : 'Asset'}
                              </span>
                            </div>
                          </td>
                          {hasBuySellPrice && (
                            <>
                              <td className="px-4 py-2">
                                <input type="number" step="1" min="0" value={item.quantity}
                                  onChange={(e) => updateLineItem(item.id, { quantity: parseFloat(e.target.value) || 0 })}
                                  className="w-full px-2 py-1 border border-gray-300 rounded outline-none text-sm font-mono text-right" />
                              </td>
                              <td className="px-4 py-2 text-gray-600 text-sm">{item.unit}</td>
                              <td className="px-4 py-2">
                                <input type="number" step="1" min="0" value={item.unitPrice}
                                  onChange={(e) => updateLineItem(item.id, { unitPrice: parseFloat(e.target.value) || 0 })}
                                  className="w-full px-2 py-1 border border-gray-300 rounded outline-none text-sm font-mono text-right" />
                              </td>
                              <td className="px-4 py-2 text-right font-mono text-amber-900 font-semibold">
                                {item.totalPrice.toFixed(2)} €
                              </td>
                            </>
                          )}
                          {!hasBuySellPrice && (
                            <td className="px-4 py-2 text-right font-mono text-purple-700 text-sm" colSpan={2}>
                              {(() => {
                                const agg = headerAggregates.get(item.id);
                                return agg !== undefined && agg > 0 ? `${agg.toFixed(2)} €` : '—';
                              })()}
                            </td>
                          )}
                          <td className="px-4 py-2 relative">
                            <div className="flex items-center justify-end gap-0.5">
                              <button onClick={() => moveUp(item.id)} disabled={isFirstSib} className={arrowBtnClass} title="Nach oben"><ArrowUp size={12} /></button>
                              <button onClick={() => moveDown(item.id)} disabled={isLastSib} className={arrowBtnClass} title="Nach unten"><ArrowDown size={12} /></button>
                              <button onClick={() => promote(item.id)} disabled={!canPromoteItem} className={arrowBtnClass} title="Ebene hoch"><ArrowLeft size={12} /></button>
                              <button onClick={() => demote(item.id)} disabled={!canDemoteItem} className={arrowBtnClass} title="Ebene tiefer"><ArrowRight size={12} /></button>
                              <button
                                onMouseDown={(e) => { e.stopPropagation(); setInsertDropdownId(insertDropdownId === item.id ? null : item.id); }}
                                className="p-1 rounded hover:bg-gray-100 transition-colors text-gray-400 hover:text-blue-600" title="Unterhalb hinzufügen"
                              ><Plus size={12} /></button>
                              <button onClick={() => deleteLineItem(item.id)}
                                className="p-1.5 rounded hover:bg-red-100 transition-colors text-gray-400 hover:text-red-600 ml-1" title="Löschen">
                                <Trash2 size={14} />
                              </button>
                            </div>
                            {insertDropdownId === item.id && (
                              <div onMouseDown={(e) => e.stopPropagation()} className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded shadow-lg z-30 text-sm min-w-[150px]">
                                <button className="w-full text-left px-3 py-1.5 hover:bg-gray-50" onClick={() => { setInsertAfterId(item.id); setShowMaterialDialog(true); setInsertDropdownId(null); }}>+ Material</button>
                                <button className="w-full text-left px-3 py-1.5 hover:bg-gray-50" onClick={() => { setInsertAfterId(item.id); setShowServiceDialog(true); setInsertDropdownId(null); }}>+ Service</button>
                                <button className="w-full text-left px-3 py-1.5 hover:bg-gray-50" onClick={() => { insertAfterItem(item.id, [buildInfoCalculationLineItem({ id: uuid(), calculationId: id || '', description: `Standort: ${location?.name ?? '—'}` })]); setInsertDropdownId(null); }}>+ Standort</button>
                                <button className="w-full text-left px-3 py-1.5 hover:bg-gray-50" onClick={() => { insertAfterItem(item.id, buildFahrtAutoItems()); setInsertDropdownId(null); }}>+ Fahrt (auto)</button>
                                <button className="w-full text-left px-3 py-1.5 hover:bg-gray-50" onClick={() => { setInsertAfterId(item.id); setShowInfoDialog(true); setInsertDropdownId(null); }}>+ Hinweistext</button>
                              </div>
                            )}
                          </td>
                        </DraggableRow>
                      );
                    }

                    // ── info ──────────────────────────────────────────────
                    if (item.type === 'info') {
                      const location = locations.find((l) => l.id === formData.locationId);
                      return (
                        <DraggableRow
                          key={item.id}
                          id={item.id}
                          index={index}
                          onMove={moveLineItem}
                          rowClassName="border-b border-gray-100 bg-gray-50"
                        >
                          <td className="px-4 py-1.5 text-gray-400 font-mono text-xs">{item.positionNumber ?? '—'}</td>
                          <td className="px-4 py-1.5" colSpan={5} style={{ paddingLeft: depth > 0 ? `${depth * 1.5}rem` : undefined }}>
                            <input
                              type="text"
                              value={item.description}
                              onChange={(e) => updateLineItem(item.id, { description: e.target.value })}
                              className="w-full px-2 py-1 border border-slate-200 rounded outline-none text-xs italic text-gray-600 bg-white"
                              placeholder="Hinweistext"
                            />
                          </td>
                          <td className="px-4 py-1.5 relative">
                            <div className="flex items-center justify-end gap-0.5">
                              <button onClick={() => moveUp(item.id)} disabled={isFirstSib} className={arrowBtnClass} title="Nach oben"><ArrowUp size={12} /></button>
                              <button onClick={() => moveDown(item.id)} disabled={isLastSib} className={arrowBtnClass} title="Nach unten"><ArrowDown size={12} /></button>
                              <button onClick={() => promote(item.id)} disabled={!canPromoteItem} className={arrowBtnClass} title="Ebene hoch"><ArrowLeft size={12} /></button>
                              <button onClick={() => demote(item.id)} disabled={!canDemoteItem} className={arrowBtnClass} title="Ebene tiefer"><ArrowRight size={12} /></button>
                              <button
                                onMouseDown={(e) => { e.stopPropagation(); setInsertDropdownId(insertDropdownId === item.id ? null : item.id); }}
                                className="p-1 rounded hover:bg-gray-100 transition-colors text-gray-400 hover:text-blue-600" title="Unterhalb hinzufügen"
                              ><Plus size={12} /></button>
                              <button onClick={() => deleteLineItem(item.id)}
                                className="p-1.5 rounded hover:bg-red-100 transition-colors text-gray-300 hover:text-red-600 ml-1" title="Löschen">
                                <Trash2 size={14} />
                              </button>
                            </div>
                            {insertDropdownId === item.id && (
                              <div onMouseDown={(e) => e.stopPropagation()} className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded shadow-lg z-30 text-sm min-w-[150px]">
                                <button className="w-full text-left px-3 py-1.5 hover:bg-gray-50" onClick={() => { setInsertAfterId(item.id); setShowMaterialDialog(true); setInsertDropdownId(null); }}>+ Material</button>
                                <button className="w-full text-left px-3 py-1.5 hover:bg-gray-50" onClick={() => { setInsertAfterId(item.id); setShowServiceDialog(true); setInsertDropdownId(null); }}>+ Service</button>
                                <button className="w-full text-left px-3 py-1.5 hover:bg-gray-50" onClick={() => { insertAfterItem(item.id, [buildInfoCalculationLineItem({ id: uuid(), calculationId: id || '', description: `Standort: ${location?.name ?? '—'}` })]); setInsertDropdownId(null); }}>+ Standort</button>
                                <button className="w-full text-left px-3 py-1.5 hover:bg-gray-50" onClick={() => { insertAfterItem(item.id, buildFahrtAutoItems()); setInsertDropdownId(null); }}>+ Fahrt (auto)</button>
                                <button className="w-full text-left px-3 py-1.5 hover:bg-gray-50" onClick={() => { setInsertAfterId(item.id); setShowInfoDialog(true); setInsertDropdownId(null); }}>+ Hinweistext</button>
                              </div>
                            )}
                          </td>
                        </DraggableRow>
                      );
                    }

                    // ── travel (travelRole gesetzt) ────────────────────────
                    if (item.travelRole != null) {
                      const isInbound = item.travelRole === 'inbound';
                      const isStd = item.unit === 'Std';
                      const location = locations.find((l) => l.id === formData.locationId);
                      return (
                        <DraggableRow
                          key={item.id}
                          id={item.id}
                          index={index}
                          onMove={moveLineItem}
                          rowClassName="border-b border-green-100 hover:bg-green-50 transition-colors"
                        >
                          <td className="px-4 py-2 text-gray-500 font-mono text-xs">{item.positionNumber ?? '—'}</td>
                          <td className="px-4 py-2" style={{ paddingLeft: depth > 0 ? `${depth * 1.5}rem` : undefined }}>
                            <div className="flex items-center gap-2">
                              <Car size={13} className={isInbound ? 'text-green-600 shrink-0' : 'text-blue-400 shrink-0'} />
                              <input
                                type="text"
                                value={item.description}
                                onChange={(e) => updateLineItem(item.id, { description: e.target.value })}
                                className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent outline-none text-sm bg-transparent"
                              />
                              <span className={`text-xs px-1.5 py-0.5 rounded shrink-0 ${isInbound ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                                {isInbound ? 'Hinfahrt' : 'Rückfahrt'}
                              </span>
                              <span className={`text-xs px-1.5 py-0.5 rounded shrink-0 ${isStd ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
                                {item.unit}
                              </span>
                              {item.isAutoGenerated && (
                                <span className="text-xs px-1.5 py-0.5 rounded bg-orange-100 text-orange-600 shrink-0">
                                  auto
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-2">
                            <input
                              type={isStd ? 'text' : 'number'}
                              step={isStd ? undefined : '1'}
                              min={isStd ? undefined : '0'}
                              value={isStd ? String(item.quantity) : item.quantity}
                              onChange={(e) => updateLineItem(item.id, { quantity: isStd ? parseQuantity(e.target.value) : parseFloat(e.target.value) || 0 })}
                              className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent outline-none text-sm font-mono text-right"
                            />
                          </td>
                          <td className="px-4 py-2 text-gray-600 text-sm">{item.unit}</td>
                          <td className="px-4 py-2">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={item.unitPrice}
                              onChange={(e) => updateLineItem(item.id, { unitPrice: parseFloat(e.target.value) || 0 })}
                              className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent outline-none text-sm font-mono text-right"
                            />
                          </td>
                          <td className="px-4 py-2 text-right font-mono text-gray-900">
                            {item.totalPrice.toFixed(2)} €
                          </td>
                          <td className="px-4 py-2 relative">
                            <div className="flex items-center justify-end gap-0.5">
                              <button onClick={() => moveUp(item.id)} disabled={isFirstSib} className={arrowBtnClass} title="Nach oben"><ArrowUp size={12} /></button>
                              <button onClick={() => moveDown(item.id)} disabled={isLastSib} className={arrowBtnClass} title="Nach unten"><ArrowDown size={12} /></button>
                              <button onClick={() => promote(item.id)} disabled={!canPromoteItem} className={arrowBtnClass} title="Ebene hoch"><ArrowLeft size={12} /></button>
                              <button onClick={() => demote(item.id)} disabled={!canDemoteItem} className={arrowBtnClass} title="Ebene tiefer"><ArrowRight size={12} /></button>
                              <button
                                onMouseDown={(e) => { e.stopPropagation(); setInsertDropdownId(insertDropdownId === item.id ? null : item.id); }}
                                className="p-1 rounded hover:bg-gray-100 transition-colors text-gray-400 hover:text-blue-600" title="Unterhalb hinzufügen"
                              ><Plus size={12} /></button>
                              <button onClick={() => deleteLineItem(item.id)}
                                className="p-1.5 rounded hover:bg-red-100 transition-colors text-gray-400 hover:text-red-600 ml-1" title="Löschen">
                                <Trash2 size={14} />
                              </button>
                            </div>
                            {insertDropdownId === item.id && (
                              <div onMouseDown={(e) => e.stopPropagation()} className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded shadow-lg z-30 text-sm min-w-[150px]">
                                <button className="w-full text-left px-3 py-1.5 hover:bg-gray-50" onClick={() => { setInsertAfterId(item.id); setShowMaterialDialog(true); setInsertDropdownId(null); }}>+ Material</button>
                                <button className="w-full text-left px-3 py-1.5 hover:bg-gray-50" onClick={() => { setInsertAfterId(item.id); setShowServiceDialog(true); setInsertDropdownId(null); }}>+ Service</button>
                                <button className="w-full text-left px-3 py-1.5 hover:bg-gray-50" onClick={() => { insertAfterItem(item.id, [buildInfoCalculationLineItem({ id: uuid(), calculationId: id || '', description: `Standort: ${location?.name ?? '—'}` })]); setInsertDropdownId(null); }}>+ Standort</button>
                                <button className="w-full text-left px-3 py-1.5 hover:bg-gray-50" onClick={() => { insertAfterItem(item.id, buildFahrtAutoItems()); setInsertDropdownId(null); }}>+ Fahrt (auto)</button>
                                <button className="w-full text-left px-3 py-1.5 hover:bg-gray-50" onClick={() => { setInsertAfterId(item.id); setShowInfoDialog(true); setInsertDropdownId(null); }}>+ Hinweistext</button>
                              </div>
                            )}
                          </td>
                        </DraggableRow>
                      );
                    }

                    // ── material / service ─────────────────────────────────
                    const material = materials.find((m) => m.id === item.materialId);
                    const isStdUnit = item.unit === 'Std';
                    const location = locations.find((l) => l.id === formData.locationId);
                    return (
                      <DraggableRow
                        key={item.id}
                        id={item.id}
                        index={index}
                        onMove={moveLineItem}
                        rowClassName="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                      >
                        {/* Position */}
                        <td className="px-4 py-3 text-gray-600 font-mono">
                          {item.positionNumber}
                        </td>

                        {/* Beschreibung */}
                        <td className="px-4 py-3" style={{ paddingLeft: depth > 0 ? `${depth * 1.5}rem` : undefined }}>
                          <input
                            type="text"
                            value={item.description}
                            onChange={(e) =>
                              updateLineItem(item.id, { description: e.target.value })
                            }
                            className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
                          />
                          {item.type === 'material' && material && (
                            <div className="text-xs text-gray-400 mt-0.5">
                              {material.articleNumber}
                            </div>
                          )}
                          {item.type === 'service' && (() => {
                            const service = services.find((s) => s.id === item.serviceId);
                            return service ? (
                              <div className="text-xs text-blue-400 mt-0.5">
                                {service.serviceNumber}
                              </div>
                            ) : null;
                          })()}
                        </td>

                        {/* Menge */}
                        <td className="px-4 py-3">
                          <input
                            type={isStdUnit ? 'text' : 'number'}
                            step={isStdUnit ? undefined : '1'}
                            min={isStdUnit ? undefined : '0'}
                            value={isStdUnit ? String(item.quantity) : item.quantity}
                            onChange={(e) =>
                              updateLineItem(item.id, {
                                quantity: isStdUnit ? parseQuantity(e.target.value) : parseFloat(e.target.value) || 0,
                              })
                            }
                            className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent outline-none text-sm font-mono text-right"
                          />
                        </td>

                        {/* Einheit */}
                        <td className="px-4 py-3 text-gray-600">{item.unit}</td>

                        {/* Einzelpreis */}
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            step="1"
                            min="0"
                            value={item.unitPrice}
                            onChange={(e) =>
                              updateLineItem(item.id, {
                                unitPrice: parseFloat(e.target.value) || 0,
                              })
                            }
                            className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent outline-none text-sm font-mono text-right"
                          />
                        </td>

                        {/* Gesamtpreis */}
                        <td className="px-4 py-3 text-right font-mono text-gray-900">
                          {item.totalPrice.toFixed(2)} €
                        </td>

                        {/* Aktionen */}
                        <td className="px-4 py-3 relative">
                          <div className="flex items-center justify-end gap-0.5">
                            <button onClick={() => moveUp(item.id)} disabled={isFirstSib} className={arrowBtnClass} title="Nach oben"><ArrowUp size={12} /></button>
                            <button onClick={() => moveDown(item.id)} disabled={isLastSib} className={arrowBtnClass} title="Nach unten"><ArrowDown size={12} /></button>
                            <button onClick={() => promote(item.id)} disabled={!canPromoteItem} className={arrowBtnClass} title="Ebene hoch"><ArrowLeft size={12} /></button>
                            <button onClick={() => demote(item.id)} disabled={!canDemoteItem} className={arrowBtnClass} title="Ebene tiefer"><ArrowRight size={12} /></button>
                            <button
                              onMouseDown={(e) => { e.stopPropagation(); setInsertDropdownId(insertDropdownId === item.id ? null : item.id); }}
                              className="p-1 rounded hover:bg-gray-100 transition-colors text-gray-400 hover:text-blue-600" title="Unterhalb hinzufügen"
                            ><Plus size={12} /></button>
                            <button
                              onClick={() => deleteLineItem(item.id)}
                              className="p-1.5 rounded hover:bg-red-100 transition-colors text-gray-500 hover:text-red-600 ml-1"
                              title="Löschen"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                          {insertDropdownId === item.id && (
                            <div onMouseDown={(e) => e.stopPropagation()} className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded shadow-lg z-30 text-sm min-w-[150px]">
                              <button className="w-full text-left px-3 py-1.5 hover:bg-gray-50" onClick={() => { setInsertAfterId(item.id); setShowMaterialDialog(true); setInsertDropdownId(null); }}>+ Material</button>
                              <button className="w-full text-left px-3 py-1.5 hover:bg-gray-50" onClick={() => { setInsertAfterId(item.id); setShowServiceDialog(true); setInsertDropdownId(null); }}>+ Service</button>
                              <button className="w-full text-left px-3 py-1.5 hover:bg-gray-50" onClick={() => { insertAfterItem(item.id, [buildInfoCalculationLineItem({ id: uuid(), calculationId: id || '', description: `Standort: ${location?.name ?? '—'}` })]); setInsertDropdownId(null); }}>+ Standort</button>
                              <button className="w-full text-left px-3 py-1.5 hover:bg-gray-50" onClick={() => { insertAfterItem(item.id, buildFahrtAutoItems()); setInsertDropdownId(null); }}>+ Fahrt (auto)</button>
                              <button className="w-full text-left px-3 py-1.5 hover:bg-gray-50" onClick={() => { setInsertAfterId(item.id); setShowInfoDialog(true); setInsertDropdownId(null); }}>+ Hinweistext</button>
                            </div>
                          )}
                        </td>
                      </DraggableRow>
                    );
                  })
                )}
              </tbody>

              {/* Footer: Gesamtsumme */}
              {lineItems.length > 0 && (
                <tfoot>
                  <tr className="bg-gray-50 border-t-2 border-gray-300">
                    <td colSpan={6} className="px-4 py-3 text-right font-bold text-gray-700">
                      Gesamtsumme (netto):
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-gray-900 font-mono text-lg">
                      {totalSum.toFixed(2)} €
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {lineItems.length > 0 && (
            <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 text-xs text-gray-500">
              {lineItems.length} Position{lineItems.length !== 1 ? 'en' : ''}
            </div>
          )}
        </div>
        </DndProvider>
      </main>

      {/* ================================================================ */}
      {/* Hinweistext-Dialog                                              */}
      {/* ================================================================ */}
      {showInfoDialog && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={handleInfoBackdropClick}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-xl mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-bold">Hinweistext hinzufügen</h2>
              <button
                onClick={handleCloseInfoDialog}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="px-6 py-4 space-y-3">
              <p className="text-sm text-gray-600">Hinweiszeilen sind eigene Positionen ohne Menge, Einheit oder Preiswirkung.</p>
              <textarea
                value={infoText}
                onChange={(e) => setInfoText(e.target.value)}
                placeholder="z. B. Arbeiten nur nach Freischaltung und Erdung."
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none resize-none text-sm"
                autoFocus
              />
            </div>
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-2">
              <button
                onClick={handleCloseInfoDialog}
                className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Abbrechen
              </button>
              <button
                onClick={addInfoToCalculation}
                disabled={!infoText.trim()}
                className="px-4 py-2 text-sm text-white bg-slate-600 rounded-lg hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Hinweistext hinzufügen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* Material-Auswahl-Dialog                                          */}
      {/* ================================================================ */}
      {showMaterialDialog && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={handleMaterialBackdropClick}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl mx-4 max-h-[80vh] flex flex-col">
            {/* Dialog Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-bold">Material auswählen</h2>
              <button
                onClick={() => setShowMaterialDialog(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Dialog Body - Scrollable */}
            <div className="px-6 py-4 overflow-y-auto flex-1">
              <div className="space-y-2">
                {materials.length === 0 ? (
                  <p className="text-gray-400 text-center py-8">
                    Keine Materialien verfügbar. Legen Sie zuerst Materialien an.
                  </p>
                ) : (
                  materials.map((material) => (
                    <button
                      key={material.id}
                      onClick={() => addMaterialToCalculation(material)}
                      className="w-full text-left px-4 py-3 border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">{material.name}</div>
                          <div className="text-sm text-gray-500 mt-0.5">
                            Art.-Nr.: <span className="font-mono">{material.articleNumber}</span>
                            {material.description && (
                              <span className="ml-2">• {material.description}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-4 ml-4">
                          <div className="text-right">
                            <div className="text-xs text-gray-500">Einheit</div>
                            <div className="font-medium text-gray-700">{material.unit}</div>
                          </div>
                          {pricesVisible && (
                            <div className="text-right">
                              <div className="text-xs text-gray-500">Preis</div>
                              <div className="font-mono font-medium text-gray-900">
                                {material.price.toFixed(2)} €
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      {material.category && (
                        <div className="mt-2">
                          <span className="inline-block px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                            {material.category}
                          </span>
                        </div>
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Dialog Footer */}
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => setShowMaterialDialog(false)}
                className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ================================================================ */}
      {/* Lagertrafo-Auswahl-Dialog                                      */}
      {/* ================================================================ */}
      {showInventoryDialog && (() => {
        const q = inventoryPickerSearch.trim().toLowerCase();
        const pickerItems = q
          ? inventoryItems.filter((item) =>
              item.position.toLowerCase().includes(q) ||
              item.manufacturer.toLowerCase().includes(q) ||
              item.serialNumber.toLowerCase().includes(q) ||
              `${item.powerKva ?? ''}`.includes(q) ||
              `${item.primaryVoltageKv ?? ''}/${item.secondaryVoltageV ?? ''}`.includes(q)
            )
          : inventoryItems.slice(0, 30);

        return (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={handleInventoryBackdropClick}>
            <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl mx-4 max-h-[80vh] flex flex-col">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-bold">Lagertrafo hinzufügen</h2>
                <button
                  onClick={handleCloseInventoryDialog}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="px-6 pt-4 pb-2 grid grid-cols-1 md:grid-cols-[1fr_180px] gap-3">
                <div className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg">
                  <Search size={14} className="text-gray-400 shrink-0" />
                  <input
                    type="text"
                    value={inventoryPickerSearch}
                    onChange={(event) => setInventoryPickerSearch(event.target.value)}
                    placeholder="HT-Nr., Hersteller, Seriennr., kVA suchen..."
                    className="w-full outline-none bg-transparent text-sm"
                    autoFocus
                  />
                </div>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={inventorySalePrice}
                  onChange={(event) => setInventorySalePrice(parseFloat(event.target.value) || 0)}
                  placeholder="VK Preis €"
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>

              <div className="px-6 pb-4 overflow-y-auto flex-1">
                <div className="space-y-2">
                  {pickerItems.length === 0 ? (
                    <p className="text-gray-400 text-center py-8">Keine Lagertrafos gefunden.</p>
                  ) : (
                    pickerItems.map((item) => (
                      <button
                        key={item.position}
                        onClick={() => addInventoryTransformerToCalculation(item)}
                        className="w-full text-left px-4 py-3 border border-gray-200 rounded-lg hover:bg-amber-50 hover:border-amber-300 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="font-medium text-gray-900">
                              {item.position} · {item.manufacturer || 'Hersteller offen'} · {item.powerKva ? `${item.powerKva} kVA` : 'kVA offen'}
                            </div>
                            <div className="text-sm text-gray-500 mt-0.5">
                              {[item.primaryVoltageKv ? `${item.primaryVoltageKv} kV` : null, item.secondaryVoltageV ? `${item.secondaryVoltageV} V` : null, item.vectorGroup || null, item.serialNumber ? `SN ${item.serialNumber}` : null].filter(Boolean).join(' · ')}
                            </div>
                          </div>
                          <span className="text-xs font-semibold text-amber-700">Als Angebotsposition</span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>

              <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
                <button
                  onClick={handleCloseInventoryDialog}
                  className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Abbrechen
                </button>
              </div>
            </div>
          </div>
        );
      })()}
      {/* ================================================================ */}
      {/* Asset-Auswahl-Dialog (zweistufig)                              */}
      {/* ================================================================ */}
      {showAssetDialog && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={handleAssetBackdropClick}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl mx-4 max-h-[80vh] flex flex-col">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-bold">
                {assetDialogStep === 'pick' ? 'Asset auswählen' : `Asset: ${selectedAssetForTreatment?.name}`}
              </h2>
              <button
                onClick={() => { setShowAssetDialog(false); setAssetDialogStep('pick'); setSelectedAssetForTreatment(null); setBuySellPrice(0); setAssetPickerSearch(''); setShowAllAssetsInPicker(false); }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Step 1: Asset-Liste */}
            {assetDialogStep === 'pick' && (() => {
              const hasCustomerFilter = !!formData.customerId;
              const baseList = (hasCustomerFilter && !showAllAssetsInPicker) ? filteredAssets : assets;
              const q = assetPickerSearch.trim().toLowerCase();
              const pickerAssets = q
                ? baseList.filter((a) =>
                    a.name.toLowerCase().includes(q) ||
                    (a.manufacturer && a.manufacturer.toLowerCase().includes(q)) ||
                    (a.typeModel && a.typeModel.toLowerCase().includes(q))
                  )
                : baseList;

              return (
                <>
                  {/* Suchzeile + Toggle */}
                  <div className="px-6 pt-4 pb-2 space-y-2">
                    <div className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg">
                      <Search size={14} className="text-gray-400 shrink-0" />
                      <input
                        type="text"
                        value={assetPickerSearch}
                        onChange={(e) => setAssetPickerSearch(e.target.value)}
                        placeholder="Asset suchen..."
                        className="w-full outline-none bg-transparent text-sm"
                        autoFocus
                      />
                    </div>
                    {hasCustomerFilter && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">
                          {showAllAssetsInPicker
                            ? `Alle Assets (${assets.length})`
                            : `Kundenassets (${filteredAssets.length})`}
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowAllAssetsInPicker((v) => !v)}
                          className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                            showAllAssetsInPicker
                              ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                              : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                          }`}
                        >
                          {showAllAssetsInPicker ? 'Nur Kundenassets' : 'Alle Assets anzeigen'}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Liste */}
                  <div className="px-6 pb-4 overflow-y-auto flex-1">
                    <div className="space-y-2">
                      {pickerAssets.length === 0 ? (
                        <p className="text-gray-400 text-center py-8">
                          {q ? 'Keine Treffer.' : 'Keine Assets vorhanden.'}
                        </p>
                      ) : (
                        pickerAssets.map((asset) => (
                          <button
                            key={asset.id}
                            onClick={() => { setSelectedAssetForTreatment(asset); setAssetDialogStep('treatment'); }}
                            className="w-full text-left px-4 py-3 border border-gray-200 rounded-lg hover:bg-purple-50 hover:border-purple-300 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <Box size={16} className="text-purple-500 shrink-0" />
                              <div>
                                <div className="font-medium text-gray-900">{asset.name}</div>
                                {(asset.manufacturer || asset.typeModel) && (
                                  <div className="text-sm text-gray-500 mt-0.5">
                                    {[asset.manufacturer, asset.typeModel].filter(Boolean).join(' · ')}
                                  </div>
                                )}
                              </div>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </>
              );
            })()}

            {/* Step 2: Behandlungsart */}
            {assetDialogStep === 'treatment' && selectedAssetForTreatment && (
              <div className="px-6 py-6 flex flex-col gap-4">
                <p className="text-sm text-gray-600">Wie soll dieses Asset im Angebot erscheinen?</p>

                {/* Kaufen / Verkaufen */}
                <div className="border border-amber-200 rounded-lg p-4 hover:bg-amber-50 transition-colors">
                  <div className="font-semibold text-amber-800 mb-1">Kaufen / Verkaufen</div>
                  <p className="text-sm text-gray-600 mb-3">Asset als Position mit Betrag hinzufügen.</p>
                  <div className="flex items-center gap-3">
                    <label className="text-sm font-medium text-gray-700 shrink-0">Preis (€)</label>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      value={buySellPrice}
                      onChange={(e) => setBuySellPrice(parseFloat(e.target.value) || 0)}
                      className="w-40 px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-amber-400 outline-none"
                      placeholder="0.00"
                    />
                    <button
                      onClick={() => addAssetToCalculation(selectedAssetForTreatment, 'buy_sell', buySellPrice)}
                      className="ml-auto px-4 py-1.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors text-sm font-medium"
                    >
                      Hinzufügen
                    </button>
                  </div>
                </div>

                {/* In unserer Werkstatt */}
                <button
                  onClick={() => addAssetToCalculation(selectedAssetForTreatment, 'workshop')}
                  className="border border-blue-200 rounded-lg p-4 text-left hover:bg-blue-50 transition-colors"
                >
                  <div className="font-semibold text-blue-800 mb-1">In unserer Werkstatt</div>
                  <p className="text-sm text-gray-600">Asset ohne Betrag als Gruppen-Header hinzufügen. Alle Positionen darunter gehören zu diesem Asset.</p>
                </button>

                {/* Vor Ort */}
                <button
                  onClick={() => addAssetToCalculation(selectedAssetForTreatment, 'on_site')}
                  className="border border-green-200 rounded-lg p-4 text-left hover:bg-green-50 transition-colors"
                >
                  <div className="font-semibold text-green-800 mb-1">Vor Ort</div>
                  <p className="text-sm text-gray-600">
                    Asset ohne Betrag + Standort als Info-Position + automatische Fahrtkosten-Positionen (Servicewagen km, Servicemitarbeiter).
                  </p>
                </button>

                <div className="flex justify-start pt-2">
                  <button
                    onClick={() => { setAssetDialogStep('pick'); setSelectedAssetForTreatment(null); setBuySellPrice(0); }}
                    className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    ← Anderes Asset auswählen
                  </button>
                </div>
              </div>
            )}

            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => { setShowAssetDialog(false); setAssetDialogStep('pick'); setSelectedAssetForTreatment(null); setBuySellPrice(0); setAssetPickerSearch(''); setShowAllAssetsInPicker(false); }}
                className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* Service-Auswahl-Dialog                                          */}
      {/* ================================================================ */}
      {showServiceDialog && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={handleServiceBackdropClick}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl mx-4 max-h-[80vh] flex flex-col">
            {/* Dialog Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-bold">Service auswählen</h2>
              <button
                onClick={() => setShowServiceDialog(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Dialog Body - Scrollable */}
            <div className="px-6 py-4 overflow-y-auto flex-1">
              <div className="space-y-2">
                {services.length === 0 ? (
                  <p className="text-gray-400 text-center py-8">
                    Keine Services verfügbar. Legen Sie zuerst Services unter{' '}
                    <strong>Services</strong> an.
                  </p>
                ) : (
                  services.map((service) => (
                    <button
                      key={service.id}
                      onClick={() => addServiceToCalculation(service)}
                      className="w-full text-left px-4 py-3 border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">{service.name}</div>
                          <div className="text-sm text-gray-500 mt-0.5">
                            Srv.-Nr.: <span className="font-mono">{service.serviceNumber}</span>
                            {service.description && (
                              <span className="ml-2">• {service.description}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-4 ml-4">
                          <div className="text-right">
                            <div className="text-xs text-gray-500">Einheit</div>
                            <div className="font-medium text-gray-700">{service.unit}</div>
                          </div>
                          {pricesVisible && (
                            <div className="text-right">
                              <div className="text-xs text-gray-500">Preis</div>
                              <div className="font-mono font-medium text-gray-900">
                                {service.price.toFixed(2)} €
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      {service.category && (
                        <div className="mt-2">
                          <span className="inline-block px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">
                            {service.category}
                          </span>
                        </div>
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Dialog Footer */}
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => setShowServiceDialog(false)}
                className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* FahrtblockDialog                                                 */}
      {/* ================================================================ */}
      {showFahrtblockDialog && fahrtblockAsset && (
        <FahrtblockDialog
          open={showFahrtblockDialog}
          onClose={handleCloseFahrtblockDialog}
          asset={fahrtblockAsset}
          fromLocation={locations.find((l) => l.id === formData.locationId) ?? null}
          toLocation={
            fahrtblockAsset.locationId
              ? locations.find((l) => l.id === fahrtblockAsset.locationId) ?? null
              : null
          }
          allLocations={locations}
          onConfirm={handleFahrtblockConfirm}
        />
      )}

      {/* ================================================================ */}
      {/* AdjustReturnTripDialog                                           */}
      {/* ================================================================ */}
      {showAdjustReturnDialog && (
        <AdjustReturnTripDialog
          open={showAdjustReturnDialog}
          onClose={handleCloseAdjustReturnDialog}
          existingReturnItems={lineItems.filter(
            (i) => i.travelRole === 'outbound' && !pendingTravelItems.some((p) => p.id === i.id)
          )}
          newAssetName={fahrtblockAsset?.name ?? ''}
          onRemoveReturn={handleRemoveReturn}
        />
      )}
    </div>
  );
}
