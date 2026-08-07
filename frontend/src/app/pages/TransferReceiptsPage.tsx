import { useEffect, useMemo, useState } from 'react';
import { CheckCircle, FileText, Plus, Printer, Trash2 } from 'lucide-react';
import SearchableSelect from '../components/SearchableSelect';
import { useAppStore } from '../context/AppStoreContext';
import type { AssetDocument, AssetNode, Customer, Location, TransferReceipt, TransferReceiptItem, TransferReceiptType } from '../lib/types';
import { reserveNumberCircle, TRANSFER_RECEIPT_NUMBER_CIRCLE_KEY } from '../lib/numberCircles';
import {
  TRANSFER_RECEIPT_TYPE_LABELS,
  TRANSFER_RECEIPT_WASTE_CATEGORY,
  TRANSFER_RECEIPT_WASTE_CODE,
  buildAddressSnapshot,
  buildAssetDocumentsForFinalizedReceipt,
  buildDefaultDisposerSnapshot,
  buildManualTransferReceiptItem,
  buildSignedLine,
  buildTransferReceiptItemFromAsset,
  formatDateDe,
} from '../lib/transferReceiptUtils';
import { formatCustomerAddress } from './customerAddress';

function nowIso() {
  return new Date().toISOString();
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function toDateInputValue(value: string) {
  return value.includes('T') ? value.slice(0, 10) : value;
}

function newId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createEmptyReceipt(receiptNumber: string): TransferReceipt {
  const today = todayDate();
  const now = nowIso();
  return {
    id: newId(),
    number: receiptNumber,
    type: 'used_devices',
    status: 'draft',
    customerId: null,
    locationId: null,
    serviceDate: today,
    ownReference: '',
    customerReference: '',
    wasteCategory: TRANSFER_RECEIPT_WASTE_CATEGORY,
    wasteCode: TRANSFER_RECEIPT_WASTE_CODE,
    signedBy: 'Valentin Polinski',
    signedPlace: 'Cloppenburg',
    signedDate: today,
    producerSnapshot: null,
    disposerSnapshot: buildDefaultDisposerSnapshot(),
    finalizedAt: null,
    notes: null,
    createdAt: now,
    updatedAt: now,
  };
}

function itemDetails(item: TransferReceiptItem, type: TransferReceiptType) {
  if (type === 'oil_containing_parts') {
    return [item.freeText, item.totalWeightKg ? `${item.totalWeightKg} kg` : ''].filter(Boolean);
  }

  const details = [
    item.manufacturer ? `Hersteller: ${item.manufacturer}` : '',
    item.typeModel ? `Typ: ${item.typeModel}` : '',
    item.nominalPowerKva ? `Nennleistung: ${item.nominalPowerKva} kVA` : '',
    item.insulatingMedium ? `Isoliermittel: ${item.insulatingMedium}` : '',
    item.fieldsCount ? `Felder: ${item.fieldsCount}` : '',
    item.serialNumber ? `Seriennummer: ${item.serialNumber}` : '',
    item.constructionYear ? `Baujahr: ${item.constructionYear}` : '',
    item.totalWeightKg ? `Gesamtgewicht: ${item.totalWeightKg} kg` : '',
    item.freeText,
  ];

  return details.filter(Boolean);
}

export default function TransferReceiptsPage() {
  const { repository, dispatch } = useAppStore();
  const [receipts, setReceipts] = useState<TransferReceipt[]>([]);
  const [items, setItems] = useState<TransferReceiptItem[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [assets, setAssets] = useState<AssetNode[]>([]);
  const [assetDocuments, setAssetDocuments] = useState<AssetDocument[]>([]);
  const [selectedReceiptId, setSelectedReceiptId] = useState<string | null>(null);
  const [assetToAddId, setAssetToAddId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function loadData() {
      const [nextReceipts, nextItems, nextCustomers, nextLocations, nextAssets, nextAssetDocuments] = await Promise.all([
        repository.list<TransferReceipt>('transferReceipts'),
        repository.list<TransferReceiptItem>('transferReceiptItems'),
        repository.list<Customer>('customers'),
        repository.list<Location>('locations'),
        repository.list<AssetNode>('assets'),
        repository.list<AssetDocument>('assetDocuments'),
      ]);
      if (!active) return;
      const sortedReceipts = [...nextReceipts].sort((a, b) => b.number.localeCompare(a.number));
      setReceipts(sortedReceipts);
      setItems(nextItems);
      setCustomers(nextCustomers);
      setLocations(nextLocations);
      setAssets(nextAssets);
      setAssetDocuments(nextAssetDocuments);
      dispatch({ type: 'SET_ENTITIES', entity: 'transferReceipts', data: nextReceipts });
      dispatch({ type: 'SET_ENTITIES', entity: 'transferReceiptItems', data: nextItems });
      dispatch({ type: 'SET_ENTITIES', entity: 'assetDocuments', data: nextAssetDocuments });
      setSelectedReceiptId((current) => current ?? sortedReceipts[0]?.id ?? null);
    }
    loadData();
    return () => {
      active = false;
    };
  }, [repository, dispatch]);

  const selectedReceipt = useMemo(
    () => receipts.find((receipt) => receipt.id === selectedReceiptId) ?? null,
    [receipts, selectedReceiptId],
  );

  const receiptItems = useMemo(
    () => items.filter((item) => item.receiptId === selectedReceiptId).sort((a, b) => a.sortOrder - b.sortOrder),
    [items, selectedReceiptId],
  );

  const selectedCustomer = customers.find((customer) => customer.id === selectedReceipt?.customerId) ?? null;
  const selectedLocation = locations.find((location) => location.id === selectedReceipt?.locationId) ?? null;
  const producer = selectedReceipt?.producerSnapshot ?? buildAddressSnapshot(selectedCustomer, selectedLocation);
  const disposer = selectedReceipt?.disposerSnapshot ?? buildDefaultDisposerSnapshot();

  const customerOptions = customers.map((customer) => ({ id: customer.id, label: customer.name, sublabel: formatCustomerAddress(customer) }));
  const locationOptions = locations.map((location) => ({ id: location.id, label: location.name, sublabel: location.addressLine ?? '' }));
  const assetOptions = assets.map((asset) => ({
    id: asset.id,
    label: `${asset.internalAssetId ? `${asset.internalAssetId} · ` : ''}${asset.name}`,
    sublabel: [asset.manufacturer, asset.serialNumber, asset.powerKva ? `${asset.powerKva} kVA` : ''].filter(Boolean).join(' · '),
  }));

  async function createReceipt() {
    let reserved = await reserveNumberCircle(TRANSFER_RECEIPT_NUMBER_CIRCLE_KEY);
    let receiptNumber = reserved.number;
    const existingNumbers = new Set(receipts.map((receipt) => receipt.number));

    while (existingNumbers.has(receiptNumber)) {
      reserved = await reserveNumberCircle(TRANSFER_RECEIPT_NUMBER_CIRCLE_KEY);
      receiptNumber = reserved.number;
    }

    const draft = createEmptyReceipt(receiptNumber);
    const saved = await repository.create<TransferReceipt>('transferReceipts', draft);
    setReceipts((current) => [saved, ...current]);
    setSelectedReceiptId(saved.id);
    dispatch({ type: 'ADD_ENTITY', entity: 'transferReceipts', data: saved });
    setMessage(`✓ ${saved.number} angelegt.`);
  }

  async function updateReceipt(patch: Partial<TransferReceipt>) {
    if (!selectedReceipt || selectedReceipt.status === 'final') return;
    const updated = { ...selectedReceipt, ...patch, updatedAt: nowIso() };
    const saved = await repository.update<TransferReceipt>('transferReceipts', updated.id, updated);
    setReceipts((current) => current.map((receipt) => (receipt.id === saved.id ? saved : receipt)));
    dispatch({ type: 'UPDATE_ENTITY', entity: 'transferReceipts', data: saved });
  }

  async function addManualItem() {
    if (!selectedReceipt || selectedReceipt.status === 'final') return;
    const draft = buildManualTransferReceiptItem(selectedReceipt.id, (receiptItems.length + 1) * 100, nowIso());
    const saved = await repository.create<TransferReceiptItem>('transferReceiptItems', draft);
    setItems((current) => [...current, saved]);
    dispatch({ type: 'ADD_ENTITY', entity: 'transferReceiptItems', data: saved });
  }

  async function addAssetItem() {
    if (!selectedReceipt || selectedReceipt.status === 'final' || !assetToAddId) return;
    const asset = assets.find((entry) => entry.id === assetToAddId);
    if (!asset) return;
    const draft = buildTransferReceiptItemFromAsset(asset, selectedReceipt.id, (receiptItems.length + 1) * 100, nowIso());
    draft.id = newId();
    const saved = await repository.create<TransferReceiptItem>('transferReceiptItems', draft);
    setItems((current) => [...current, saved]);
    dispatch({ type: 'ADD_ENTITY', entity: 'transferReceiptItems', data: saved });
    setAssetToAddId(null);
  }

  async function updateItem(item: TransferReceiptItem, patch: Partial<TransferReceiptItem>) {
    if (!selectedReceipt || selectedReceipt.status === 'final') return;
    const updated = { ...item, ...patch, updatedAt: nowIso() };
    const saved = await repository.update<TransferReceiptItem>('transferReceiptItems', updated.id, updated);
    setItems((current) => current.map((entry) => (entry.id === saved.id ? saved : entry)));
    dispatch({ type: 'UPDATE_ENTITY', entity: 'transferReceiptItems', data: saved });
  }

  async function deleteItem(itemId: string) {
    if (!selectedReceipt || selectedReceipt.status === 'final') return;
    await repository.delete('transferReceiptItems', itemId);
    setItems((current) => current.filter((entry) => entry.id !== itemId));
    dispatch({ type: 'DELETE_ENTITY', entity: 'transferReceiptItems', id: itemId });
  }

  async function finalizeReceipt() {
    if (!selectedReceipt || selectedReceipt.status === 'final') return;
    const now = nowIso();
    const finalReceipt: TransferReceipt = {
      ...selectedReceipt,
      status: 'final',
      producerSnapshot: buildAddressSnapshot(selectedCustomer, selectedLocation),
      disposerSnapshot: buildDefaultDisposerSnapshot(),
      finalizedAt: now,
      updatedAt: now,
    };
    const savedReceipt = await repository.update<TransferReceipt>('transferReceipts', finalReceipt.id, finalReceipt);
    const docs = buildAssetDocumentsForFinalizedReceipt(savedReceipt, receiptItems, assetDocuments, now);
    const savedDocs: AssetDocument[] = [];
    for (const document of docs) {
      savedDocs.push(await repository.create<AssetDocument>('assetDocuments', document));
    }
    setReceipts((current) => current.map((receipt) => (receipt.id === savedReceipt.id ? savedReceipt : receipt)));
    setAssetDocuments((current) => [...current, ...savedDocs]);
    dispatch({ type: 'UPDATE_ENTITY', entity: 'transferReceipts', data: savedReceipt });
    savedDocs.forEach((document) => dispatch({ type: 'ADD_ENTITY', entity: 'assetDocuments', data: document }));
    setMessage(`✓ ${savedReceipt.number} finalisiert und an ${savedDocs.length} Asset-Dokument(e) verlinkt.`);
  }

  return (
    <main className="space-y-6 p-6">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .transfer-receipt-print-area, .transfer-receipt-print-area * { visibility: visible; }
          .transfer-receipt-print-area { position: absolute; left: 0; top: 0; width: 100%; box-shadow: none !important; border: 0 !important; }
          .no-print { display: none !important; }
        }
      `}</style>

      <header className="no-print flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-blue-600">Dokumente</p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900">Übernahmebelege</h1>
          <p className="text-sm text-gray-600">PDF-only MVP: Beleg anlegen, Positionen aus Assets oder manuell erfassen, drucken/finalisieren.</p>
        </div>
        <button onClick={createReceipt} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          <Plus size={16} />
          Neuer Übernahmebeleg
        </button>
      </header>

      {message && <div className="no-print rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">{message}</div>}

      <div className="grid gap-4 xl:grid-cols-[300px_1fr]">
        <aside className="no-print rounded-xl border bg-white p-3 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-gray-700">Belege</h2>
          <div className="space-y-2">
            {receipts.length === 0 ? (
              <p className="text-sm text-gray-500">Noch keine Übernahmebelege.</p>
            ) : receipts.map((receipt) => (
              <button key={receipt.id} onClick={() => setSelectedReceiptId(receipt.id)} className={`w-full rounded-lg px-3 py-2 text-left text-sm ${receipt.id === selectedReceiptId ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50'}`}>
                <span className="block font-semibold">{receipt.number}</span>
                <span className="block text-xs text-gray-500">{TRANSFER_RECEIPT_TYPE_LABELS[receipt.type]} · {receipt.status === 'final' ? 'final' : 'Entwurf'}</span>
              </button>
            ))}
          </div>
        </aside>

        {selectedReceipt ? (
          <section className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_520px]">
            <div className="no-print space-y-4 rounded-xl border bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">{selectedReceipt.number}</h2>
                  <p className="text-sm text-gray-500">Status: {selectedReceipt.status === 'final' ? 'finalisiert' : 'Entwurf'}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                    <Printer size={16} /> PDF drucken
                  </button>
                  <button type="button" disabled={selectedReceipt.status === 'final'} onClick={finalizeReceipt} className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-300">
                    <CheckCircle size={16} /> Finalisieren
                  </button>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <label className="text-sm font-medium text-gray-700">Typ
                  <select disabled={selectedReceipt.status === 'final'} value={selectedReceipt.type} onChange={(event) => updateReceipt({ type: event.target.value as TransferReceiptType })} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm">
                    {Object.entries(TRANSFER_RECEIPT_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
                <label className="text-sm font-medium text-gray-700">Leistungsdatum
                  <input disabled={selectedReceipt.status === 'final'} type="date" value={toDateInputValue(selectedReceipt.serviceDate)} onChange={(event) => updateReceipt({ serviceDate: event.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" />
                </label>
                <label className="text-sm font-medium text-gray-700">Unterschriftsdatum
                  <input disabled={selectedReceipt.status === 'final'} type="date" value={toDateInputValue(selectedReceipt.signedDate)} onChange={(event) => updateReceipt({ signedDate: event.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" />
                </label>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="text-sm font-medium text-gray-700">Kunde / Abfallerzeuger
                  <div className="mt-1"><SearchableSelect value={selectedReceipt.customerId} onChange={(id) => updateReceipt({ customerId: id })} options={customerOptions} placeholder="Kunde wählen" searchPlaceholder="Kunden suchen..." /></div>
                </label>
                <label className="text-sm font-medium text-gray-700">Standort
                  <div className="mt-1"><SearchableSelect value={selectedReceipt.locationId} onChange={(id) => updateReceipt({ locationId: id })} options={locationOptions} placeholder="Standort optional" searchPlaceholder="Standort suchen..." /></div>
                </label>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="text-sm font-medium text-gray-700">Unsere Referenznummer
                  <input disabled={selectedReceipt.status === 'final'} value={selectedReceipt.ownReference} onChange={(event) => updateReceipt({ ownReference: event.target.value })} placeholder="z.B. AU200815" className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" />
                </label>
                <label className="text-sm font-medium text-gray-700">Ihre Referenznummer
                  <input disabled={selectedReceipt.status === 'final'} value={selectedReceipt.customerReference} onChange={(event) => updateReceipt({ customerReference: event.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" />
                </label>
              </div>

              <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-3">
                <h3 className="mb-2 text-sm font-semibold text-blue-900">Position hinzufügen</h3>
                <div className="grid gap-2 md:grid-cols-[1fr_auto_auto] md:items-end">
                  <SearchableSelect value={assetToAddId} onChange={setAssetToAddId} options={assetOptions} placeholder="Asset suchen/übernehmen" searchPlaceholder="HT-Nr., Hersteller, Seriennr..." />
                  <button type="button" onClick={addAssetItem} disabled={!assetToAddId || selectedReceipt.status === 'final'} className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-gray-300">Asset übernehmen</button>
                  <button type="button" onClick={addManualItem} disabled={selectedReceipt.status === 'final'} className="rounded-lg border px-3 py-2 text-sm font-medium text-gray-700 hover:bg-white disabled:text-gray-400">Manuell</button>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-800">Positionen</h3>
                {receiptItems.length === 0 ? <p className="rounded-lg border border-dashed p-4 text-sm text-gray-500">Noch keine Positionen.</p> : receiptItems.map((item, index) => (
                  <div key={item.id} className="rounded-xl border p-3">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-gray-900">Position {index + 1}</span>
                      <button type="button" onClick={() => deleteItem(item.id)} disabled={selectedReceipt.status === 'final'} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:text-gray-300"><Trash2 size={14} /> Entfernen</button>
                    </div>
                    <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                      <label className="text-xs font-medium text-gray-600">Menge<input disabled={selectedReceipt.status === 'final'} type="number" step="0.001" value={item.quantity} onChange={(event) => updateItem(item, { quantity: Number(event.target.value) })} className="mt-1 w-full rounded border px-2 py-1.5 text-sm" /></label>
                      <label className="text-xs font-medium text-gray-600 xl:col-span-3">Bezeichnung<input disabled={selectedReceipt.status === 'final'} value={item.description} onChange={(event) => updateItem(item, { description: event.target.value })} className="mt-1 w-full rounded border px-2 py-1.5 text-sm" /></label>
                      <label className="text-xs font-medium text-gray-600">Hersteller<input disabled={selectedReceipt.status === 'final'} value={item.manufacturer} onChange={(event) => updateItem(item, { manufacturer: event.target.value })} className="mt-1 w-full rounded border px-2 py-1.5 text-sm" /></label>
                      <label className="text-xs font-medium text-gray-600">Typ<input disabled={selectedReceipt.status === 'final'} value={item.typeModel} onChange={(event) => updateItem(item, { typeModel: event.target.value })} className="mt-1 w-full rounded border px-2 py-1.5 text-sm" /></label>
                      <label className="text-xs font-medium text-gray-600">kVA<input disabled={selectedReceipt.status === 'final'} type="number" value={item.nominalPowerKva ?? ''} onChange={(event) => updateItem(item, { nominalPowerKva: event.target.value ? Number(event.target.value) : null })} className="mt-1 w-full rounded border px-2 py-1.5 text-sm" /></label>
                      <label className="text-xs font-medium text-gray-600">Isoliermittel<input disabled={selectedReceipt.status === 'final'} value={item.insulatingMedium} onChange={(event) => updateItem(item, { insulatingMedium: event.target.value })} className="mt-1 w-full rounded border px-2 py-1.5 text-sm" /></label>
                      <label className="text-xs font-medium text-gray-600">Seriennummer<input disabled={selectedReceipt.status === 'final'} value={item.serialNumber} onChange={(event) => updateItem(item, { serialNumber: event.target.value })} className="mt-1 w-full rounded border px-2 py-1.5 text-sm" /></label>
                      <label className="text-xs font-medium text-gray-600">Baujahr<input disabled={selectedReceipt.status === 'final'} type="number" value={item.constructionYear ?? ''} onChange={(event) => updateItem(item, { constructionYear: event.target.value ? Number(event.target.value) : null })} className="mt-1 w-full rounded border px-2 py-1.5 text-sm" /></label>
                      <label className="text-xs font-medium text-gray-600">Gewicht kg<input disabled={selectedReceipt.status === 'final'} type="number" step="0.001" value={item.totalWeightKg ?? ''} onChange={(event) => updateItem(item, { totalWeightKg: event.target.value ? Number(event.target.value) : null })} className="mt-1 w-full rounded border px-2 py-1.5 text-sm" /></label>
                      <label className="text-xs font-medium text-gray-600">Felder<input disabled={selectedReceipt.status === 'final'} type="number" value={item.fieldsCount ?? ''} onChange={(event) => updateItem(item, { fieldsCount: event.target.value ? Number(event.target.value) : null })} className="mt-1 w-full rounded border px-2 py-1.5 text-sm" /></label>
                      <label className="text-xs font-medium text-gray-600 xl:col-span-4">Freitext<textarea disabled={selectedReceipt.status === 'final'} value={item.freeText} onChange={(event) => updateItem(item, { freeText: event.target.value })} className="mt-1 h-16 w-full rounded border px-2 py-1.5 text-sm" /></label>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <article className="transfer-receipt-print-area rounded-xl border bg-white p-8 text-gray-950 shadow-sm">
              <div className="mb-8 flex items-start gap-4">
                <FileText className="mt-1 text-blue-600" size={28} />
                <div>
                  <h2 className="text-2xl font-bold">Übernahmebeleg für</h2>
                  <p className="text-xl font-semibold">{TRANSFER_RECEIPT_TYPE_LABELS[selectedReceipt.type]} - AVV 16 02 14</p>
                  <p className="mt-1 text-sm text-gray-500">{selectedReceipt.number}</p>
                </div>
              </div>

              <div className="mb-8 grid grid-cols-2 gap-8 text-sm">
                <div>
                  <h3 className="mb-2 font-semibold">Abfallerzeuger:</h3>
                  <p className="font-medium">{producer.name || '—'}</p>
                  {producer.locationName && <p>{producer.locationName}</p>}
                  <p className="whitespace-pre-line">{producer.address || '—'}</p>
                </div>
                <div>
                  <h3 className="mb-2 font-semibold">Entsorger:</h3>
                  <p className="font-medium">{disposer.name}</p>
                  <p>{disposer.address}</p>
                </div>
              </div>

              <div className="mb-8 grid grid-cols-2 gap-4 text-sm">
                <p><span className="font-semibold">Leistungsdatum:</span> {formatDateDe(selectedReceipt.serviceDate)}</p>
                <p><span className="font-semibold">Unsere Referenznummer:</span> {selectedReceipt.ownReference || '—'}</p>
                <p><span className="font-semibold">Ihre Referenznummer:</span> {selectedReceipt.customerReference || '—'}</p>
              </div>

              <p className="mb-4 text-sm">Hiermit bestätigen wir die Übernahme folgender elektrischer Betriebsmittel:</p>
              <div className="mb-8 space-y-5 text-sm">
                {receiptItems.length === 0 ? <p className="text-gray-500">Keine Positionen erfasst.</p> : receiptItems.map((item) => (
                  <div key={item.id}>
                    <p className="font-semibold">{item.quantity}x {item.description}</p>
                    {itemDetails(item, selectedReceipt.type).map((line) => <p key={line}>{line}</p>)}
                  </div>
                ))}
              </div>

              <p className="mb-6 text-sm">Die Deklaration erfolgte gemäß KrWG & Abfallverzeichnis-Verordnung (AVV).</p>
              <div className="mb-10 text-sm">
                <p><span className="font-semibold">Kategorie:</span> {selectedReceipt.wasteCategory}</p>
                <p><span className="font-semibold">Abfallschlüssel:</span> {selectedReceipt.wasteCode}</p>
              </div>

              <p className="text-sm"><span className="font-semibold">Gezeichnet:</span> {buildSignedLine(selectedReceipt.signedDate)}</p>
            </article>
          </section>
        ) : (
          <section className="rounded-xl border border-dashed bg-white p-8 text-center text-gray-500">
            Lege den ersten Übernahmebeleg an.
          </section>
        )}
      </div>
    </main>
  );
}
