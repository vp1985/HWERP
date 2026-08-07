import { useEffect, useMemo, useState } from 'react';
import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { useNavigate } from 'react-router';
import { CheckCircle2, CloudOff, CloudUpload, Copy, FileJson, FileText, RefreshCcw, Wifi, WifiOff } from 'lucide-react';
import { demoCustomers, demoOrders, demoReports, demoReservedNumbers, demoSyncQueue, NUMBER_CIRCLES, SERVICE_TECHNICIANS } from '../data/demoData';
import { NUMBER_STATUSES, REPORT_STATUSES, REPORT_TYPES, ReservedNumber, ServiceOrder, ServiceReport, SyncQueueItem } from '../types';
import { allAssets, duplicateReportDraft, findCustomer, findLocation, lastSyncText, nextNumbersForCircle, orderLabel, pathForServiceTab, reportToExport, reportTypeLabel, validateReportForm } from '../utils';
import type { ServiceTab } from '../utils';

const TAB_ITEMS: { key: ServiceTab; label: string }[] = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'orders', label: 'Aufträge' },
  { key: 'numbers', label: 'Nummernreservierung' },
  { key: 'reports', label: 'Berichte' },
  { key: 'templates', label: 'Vorlagen' },
  { key: 'sync', label: 'Sync' },
];

export default function ServiceReportsModulePage({ initialTab = 'dashboard' }: { initialTab?: ServiceTab }) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<ServiceTab>(initialTab);
  const [isOnline, setIsOnline] = useState(true);
  const [orders, setOrders] = useState<ServiceOrder[]>(demoOrders);
  const [reservedNumbers, setReservedNumbers] = useState<ReservedNumber[]>(demoReservedNumbers);
  const [reports, setReports] = useState<ServiceReport[]>(demoReports);
  const [syncQueue, setSyncQueue] = useState<SyncQueueItem[]>(demoSyncQueue);
  const [jsonPreview, setJsonPreview] = useState<string>('');
  const [selectedReport, setSelectedReport] = useState<ServiceReport | null>(null);
  const [formErrors, setFormErrors] = useState<string[]>([]);

  const [selectedCircle, setSelectedCircle] = useState(NUMBER_CIRCLES[0]);
  const [reserveQuantity, setReserveQuantity] = useState(5);
  const [selectedOrderId, setSelectedOrderId] = useState(orders[0]?.id ?? '');

  const [selectedType, setSelectedType] = useState<typeof REPORT_TYPES[number]>('measurement_protocol');
  const [formValues, setFormValues] = useState<Record<string, string | boolean | string[]>>({
    reportNumber: 'LS-2026-000150',
    customerId: demoCustomers[0].id,
    locationId: demoCustomers[0].locations[0].id,
    assetId: demoCustomers[0].locations[0].assets[0].id,
    technician: SERVICE_TECHNICIANS[0],
    date: '2026-04-24',
  });

  const assets = useMemo(() => allAssets(demoCustomers), []);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const stats = useMemo(() => {
    const openOrders = orders.filter((order) => order.status !== 'abgeschlossen' && order.status !== 'synchronisiert').length;
    const reserved = reservedNumbers.filter((number) => number.status === 'reserviert').length;
    const consumed = reservedNumbers.filter((number) => number.status === 'verwendet').length;
    const editing = reports.filter((report) => report.status === 'Entwurf').length;
    const readySync = reports.filter((report) => report.status === 'bereit zum Sync').length;
    return { openOrders, reserved, consumed, editing, readySync };
  }, [orders, reservedNumbers, reports]);

  const handleReserve = () => {
    if (!selectedOrderId) return;
    const selectedOrder = orders.find((order) => order.id === selectedOrderId);
    if (!selectedOrder) return;

    const generated = nextNumbersForCircle(selectedCircle, reserveQuantity, reservedNumbers.map((item) => item.value));
    const newNumbers: ReservedNumber[] = generated.map((value, index) => ({
      id: `n-${Date.now()}-${index}`,
      numberCircle: selectedCircle,
      value,
      orderId: selectedOrder.id,
      customerId: selectedOrder.customerId,
      status: 'reserviert',
    }));

    setReservedNumbers((current) => [...newNumbers, ...current]);
    setOrders((current) => current.map((order) => order.id === selectedOrder.id
      ? { ...order, reservedNumbers: [...order.reservedNumbers, ...generated] }
      : order));
  };

  const markNumberAsUsed = (numberId: string) => {
    setReservedNumbers((current) => current.map((number) => (number.id === numberId ? { ...number, status: 'verwendet' } : number)));
  };

  const createReport = () => {
    const errors = validateReportForm(selectedType, formValues, demoCustomers, reports);
    setFormErrors(errors);
    if (errors.length > 0) return;

    const reportNumber = String(formValues.reportNumber || `LS-2026-${String(Date.now()).slice(-6)}`);
    const report: ServiceReport = {
      id: `r-${Date.now()}`,
      reportNumber,
      type: selectedType,
      customerId: String(formValues.customerId || demoCustomers[0].id),
      locationId: String(formValues.locationId || demoCustomers[0].locations[0].id),
      assetId: String(formValues.assetId || ''),
      orderNumber: String(formValues.orderNumber || ''),
      values: formValues,
      status: 'Entwurf',
      syncStatus: 'pending',
      createdBy: String(formValues.technician || SERVICE_TECHNICIANS[0]),
      createdAt: new Date().toISOString(),
    };

    setReports((current) => [report, ...current]);
    setSyncQueue((current) => [{ reportId: report.id, reportNumber: report.reportNumber, queuedAt: new Date().toISOString() }, ...current]);
    setSelectedReport(report);
    setActiveTab('reports');
    navigate(pathForServiceTab('reports'));
  };

  const duplicateReport = (report: ServiceReport) => {
    const now = new Date().toISOString();
    const copy = duplicateReportDraft(report, `copy-${Date.now()}`, now);
    setReports((current) => [copy, ...current]);
    setSyncQueue((current) => [{ reportId: copy.id, reportNumber: copy.reportNumber, queuedAt: now }, ...current]);
    setSelectedReport(copy);
  };

  const openReport = (report: ServiceReport) => {
    setSelectedReport(report);
    setJsonPreview('');
  };

  const openJson = (report: ServiceReport) => {
    setJsonPreview(JSON.stringify(reportToExport(report, demoCustomers), null, 2));
  };

  const syncNow = () => {
    if (!isOnline) return;
    const queuedIds = new Set(syncQueue.map((item) => item.reportId));
    setReports((current) => current.map((report) => queuedIds.has(report.id) ? { ...report, syncStatus: 'synced', status: report.status === 'Entwurf' ? 'bereit zum Sync' : report.status } : report));
    setSyncQueue([]);
  };

  const statusChip = (value: string) => (
    <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-700 text-xs font-medium">{value}</span>
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-wrap gap-3 justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Serviceberichte & Prüfprotokolle</h1>
          <p className="text-sm text-gray-500">Kunde → Standort → Asset → Auftrag → Nummernreservierung → Bericht → PDF/JSON → Sync</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setIsOnline(false)} className="px-3 py-2 rounded-lg border text-sm bg-gray-50 hover:bg-gray-100 inline-flex items-center gap-2"><WifiOff size={16} /> Offline schalten</button>
          <button onClick={() => setIsOnline(true)} className="px-3 py-2 rounded-lg border text-sm bg-green-50 hover:bg-green-100 inline-flex items-center gap-2"><Wifi size={16} /> Online schalten</button>
          <span className={`px-3 py-2 rounded-lg text-sm ${isOnline ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>{isOnline ? 'Online' : 'Offline'}</span>
        </div>
      </div>

      <div className="bg-white border rounded-xl p-2 flex flex-wrap gap-2">
        {TAB_ITEMS.map((tab) => (
          <button key={tab.key} onClick={() => {
            setActiveTab(tab.key);
            navigate(pathForServiceTab(tab.key));
          }} className={`px-4 py-2 rounded-lg text-sm ${activeTab === tab.key ? 'bg-blue-600 text-white' : 'bg-gray-50 hover:bg-gray-100'}`}>{tab.label}</button>
        ))}
      </div>

      {activeTab === 'dashboard' && (
        <div className="space-y-4">
          <div className="grid md:grid-cols-3 gap-4">
            <StatCard label="offene Aufträge" value={String(stats.openOrders)} />
            <StatCard label="reservierte Nummern" value={String(stats.reserved)} />
            <StatCard label="verbrauchte Nummern" value={String(stats.consumed)} />
            <StatCard label="Berichte in Bearbeitung" value={String(stats.editing)} />
            <StatCard label="bereit zur Synchronisation" value={String(stats.readySync)} />
            <StatCard label="letzter Sync-Status" value={lastSyncText(isOnline, reports)} />
          </div>
          <div className="bg-white border rounded-xl p-4">
            <h2 className="font-semibold mb-3">Kunden, Standorte & Assets (Demo)</h2>
            <div className="grid lg:grid-cols-2 gap-4">
              {demoCustomers.map((customer) => (
                <div key={customer.id} className="border rounded-lg p-3">
                  <p className="font-medium">{customer.name} ({customer.customerNumber})</p>
                  <p className="text-sm text-gray-500">{customer.contactPerson} · {customer.email} · {customer.phone}</p>
                  {customer.locations.map((location) => (
                    <div key={location.id} className="mt-2 bg-gray-50 rounded p-2">
                      <p className="text-sm font-medium">Standort: {location.name}</p>
                      {location.assets.map((asset) => (
                        <div key={asset.id} className="text-xs text-gray-700 mt-1">
                          {asset.name} · {asset.assetNumber} · {asset.type} · letzter Status: {asset.lastInspectionStatus} · nächster Termin: {asset.nextInspectionDate} · letzte Berichtnr.: {asset.lastReportNumber}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'orders' && (
        <div className="bg-white border rounded-xl p-4 overflow-x-auto">
          <h2 className="font-semibold mb-3">Auftragsübersicht</h2>
          <table className="w-full text-sm min-w-[900px]"><thead><tr className="text-left border-b">
            <th className="py-2">Auftragsnummer</th><th>Kunde</th><th>Standort</th><th>Techniker</th><th>Termin</th><th>Beschreibung</th><th>Assets</th><th>Reservierte Nummern</th><th>Berichte</th><th>Status</th>
          </tr></thead><tbody>
            {orders.map((order) => {
              const customer = findCustomer(demoCustomers, order.customerId);
              const location = findLocation(demoCustomers, order.customerId, order.locationId);
              return <tr key={order.id} className="border-b align-top"><td className="py-2 font-mono">{order.orderNumber}</td><td>{customer?.name}</td><td>{location?.name}</td><td>{order.technician}</td><td>{order.plannedDate}</td><td>{order.description}</td><td>{order.assetIds.map((id) => assets.find((asset) => asset.id === id)?.name).filter(Boolean).join(', ')}</td><td>{order.reservedNumbers.join(', ') || '–'}</td><td>{order.reportIds.join(', ') || '–'}</td><td>{statusChip(order.status)}</td></tr>;
            })}
          </tbody></table>
        </div>
      )}

      {activeTab === 'numbers' && (
        <div className="grid lg:grid-cols-3 gap-4">
          <div className="bg-white border rounded-xl p-4 space-y-3">
            <h2 className="font-semibold">Nummernreservierung</h2>
            <p className="text-xs text-orange-700 bg-orange-50 border border-orange-100 p-2 rounded">Hinweis: Nummern werden serverseitig reserviert und offline nur verwendet, nicht neu erfunden.</p>
            <label className="text-sm block">Nummernkreis
              <select className="w-full border rounded mt-1 p-2" value={selectedCircle} onChange={(event) => setSelectedCircle(event.target.value)}>
                {NUMBER_CIRCLES.map((circle) => <option key={circle} value={circle}>{circle}</option>)}
              </select>
            </label>
            <label className="text-sm block">Menge reservieren
              <input type="number" min={1} max={50} className="w-full border rounded mt-1 p-2" value={reserveQuantity} onChange={(event) => setReserveQuantity(Number(event.target.value))} />
            </label>
            <label className="text-sm block">Auftrag
              <select className="w-full border rounded mt-1 p-2" value={selectedOrderId} onChange={(event) => setSelectedOrderId(event.target.value)}>
                {orders.map((order) => <option key={order.id} value={order.id}>{order.orderNumber}</option>)}
              </select>
            </label>
            <button onClick={handleReserve} className="w-full px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700">Reservieren</button>
            <p className="text-xs text-gray-500">Beispiel: LS-2026-000120 bis LS-2026-000149 für Auftrag A-2026-0042.</p>
          </div>
          <div className="lg:col-span-2 bg-white border rounded-xl p-4 overflow-x-auto">
            <h3 className="font-semibold mb-2">Reservierte Nummern</h3>
            <table className="w-full text-sm min-w-[650px]"><thead><tr className="border-b text-left"><th className="py-2">Nummer</th><th>Kreis</th><th>Auftrag</th><th>Status</th><th>Aktion</th></tr></thead>
              <tbody>
                {reservedNumbers.map((number) => (
                  <tr key={number.id} className={`border-b ${number.status === 'verwendet' ? 'bg-green-50' : ''}`}>
                    <td className="font-mono py-2">{number.value}</td>
                    <td>{number.numberCircle}</td>
                    <td>{orderLabel(orders, number.orderId)}</td>
                    <td>{statusChip(number.status)}</td>
                    <td>{number.status === 'reserviert' ? <button onClick={() => markNumberAsUsed(number.id)} className="text-xs px-2 py-1 rounded border hover:bg-gray-50">Als verwendet markieren</button> : '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              {NUMBER_STATUSES.map((status) => <span key={status} className="px-2 py-1 border rounded">{status}</span>)}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'reports' && (
        <div className="space-y-4">
          <div className="bg-white border rounded-xl p-4">
            <h2 className="font-semibold mb-3">Berichtstypen (klickbare Formulare)</h2>
            <div className="flex flex-wrap gap-2 mb-3">{REPORT_TYPES.map((type) => <button key={type} onClick={() => {
              setSelectedType(type);
              setFormErrors([]);
            }} className={`px-3 py-2 rounded border text-sm ${selectedType === type ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white'}`}>{reportTypeLabel[type]}</button>)}</div>
            {formErrors.length > 0 && (
              <div role="alert" className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                <p className="font-medium">Bitte Eingaben prüfen:</p>
                <ul className="list-disc pl-5">
                  {formErrors.map((error) => <li key={error}>{error}</li>)}
                </ul>
              </div>
            )}
            <ReportForm selectedType={selectedType} formValues={formValues} setFormValues={setFormValues} createReport={createReport} />
          </div>

          <div className="bg-white border rounded-xl p-4 overflow-x-auto">
            <h2 className="font-semibold mb-3">Berichtsliste</h2>
            <table className="w-full text-sm min-w-[1050px]"><thead><tr className="border-b text-left"><th className="py-2">Berichtnummer</th><th>Typ</th><th>Kunde</th><th>Standort</th><th>Asset</th><th>Status</th><th>Sync-Status</th><th>Erstellt von</th><th>Erstellt am</th><th>Aktionen</th></tr></thead>
              <tbody>
                {reports.map((report) => {
                  const customer = findCustomer(demoCustomers, report.customerId);
                  const location = findLocation(demoCustomers, report.customerId, report.locationId);
                  const asset = assets.find((item) => item.id === report.assetId);
                  return (
                    <tr key={report.id} className="border-b align-top">
                      <td className="font-mono py-2">{report.reportNumber}</td><td>{reportTypeLabel[report.type]}</td><td>{customer?.name}</td><td>{location?.name}</td><td>{asset?.name || '–'}</td><td>{statusChip(report.status)}</td><td>{statusChip(report.syncStatus)}</td><td>{report.createdBy}</td><td>{new Date(report.createdAt).toLocaleString('de-DE')}</td>
                      <td>
                        <div className="flex flex-wrap gap-1">
                          <button onClick={() => openReport(report)} className="text-xs border rounded px-2 py-1">öffnen</button>
                          <button onClick={() => duplicateReport(report)} className="text-xs border rounded px-2 py-1">duplizieren</button>
                          <button onClick={() => openJson(report)} className="text-xs border rounded px-2 py-1 inline-flex items-center gap-1"><FileJson size={12} /> JSON</button>
                          <button onClick={() => window.print()} className="text-xs border rounded px-2 py-1">Druckansicht</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {selectedReport && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-blue-900">Berichtsdetails</h3>
                  <p className="text-sm text-blue-800 font-mono">{selectedReport.reportNumber}</p>
                </div>
                <button onClick={() => setSelectedReport(null)} className="text-xs border border-blue-200 rounded px-2 py-1 bg-white">schließen</button>
              </div>
              <div className="mt-3 grid md:grid-cols-3 gap-3 text-sm">
                <div><span className="text-blue-700">Typ:</span> {reportTypeLabel[selectedReport.type]}</div>
                <div><span className="text-blue-700">Status:</span> {selectedReport.status}</div>
                <div><span className="text-blue-700">Sync:</span> {selectedReport.syncStatus}</div>
                <div><span className="text-blue-700">Kunde:</span> {findCustomer(demoCustomers, selectedReport.customerId)?.name ?? selectedReport.customerId}</div>
                <div><span className="text-blue-700">Standort:</span> {findLocation(demoCustomers, selectedReport.customerId, selectedReport.locationId)?.name ?? selectedReport.locationId}</div>
                <div><span className="text-blue-700">Asset-ID:</span> {selectedReport.assetId || '–'}</div>
              </div>
            </div>
          )}

          {jsonPreview && (
            <div className="bg-gray-900 text-gray-100 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2"><p className="font-semibold">JSON-Export</p><button onClick={() => navigator.clipboard.writeText(jsonPreview)} className="text-xs px-2 py-1 border border-gray-700 rounded inline-flex items-center gap-1"><Copy size={12} /> Kopieren</button></div>
              <pre className="text-xs overflow-auto">{jsonPreview}</pre>
            </div>
          )}

          <div className="bg-white border rounded-xl p-6 print:p-8">
            <div className="border-b pb-3 mb-4 flex justify-between"><div><p className="font-bold">HWERP Serviceberichte</p><p className="text-xs text-gray-500">Firmenkopf · Musterstraße 1 · 12345 Beispielstadt</p></div><FileText /></div>
            <h3 className="font-semibold mb-2">A4-Druckvorschau</h3>
            <p className="text-sm text-gray-700">Berichtnummer, Kundeninformationen, Messwerte/Formulardaten, Unterschriftsfelder und Fußzeile sind vorbereitet. Aktuell erfolgt Export über Browser-Druck.</p>
            <div className="grid grid-cols-2 gap-3 mt-3 text-sm"><div className="border rounded p-2">Unterschrift Kunde</div><div className="border rounded p-2">Unterschrift Techniker</div></div>
            <p className="text-xs text-gray-400 mt-4">Seite 1/1 · Prototyp</p>
          </div>
        </div>
      )}

      {activeTab === 'templates' && (
        <div className="bg-white border rounded-xl p-4">
          <h2 className="font-semibold">Vorlagen</h2>
          <p className="text-sm text-gray-600 mt-2">Platzhalter für spätere serverseitige Vorlagenverwaltung (Template-API, Versionierung, Freigaben).</p>
        </div>
      )}

      {activeTab === 'sync' && (
        <div className="space-y-4">
          {!isOnline && <div className="bg-orange-50 text-orange-700 border border-orange-200 rounded-lg px-4 py-3 text-sm">Offline-Modus aktiv: Synchronisation ist aktuell nicht möglich.</div>}
          <div className="bg-white border rounded-xl p-4">
            <div className="flex flex-wrap justify-between gap-2 items-center mb-3">
              <h2 className="font-semibold">Sync-Warteschlange</h2>
              <button onClick={syncNow} className="px-3 py-2 rounded bg-blue-600 text-white text-sm inline-flex items-center gap-2 disabled:opacity-50" disabled={!isOnline}><RefreshCcw size={14} /> Jetzt synchronisieren</button>
            </div>
            <div className="space-y-2">
              {syncQueue.length === 0 ? <p className="text-sm text-gray-500">Keine offenen Sync-Einträge.</p> : syncQueue.map((item) => <div key={item.reportId} className="border rounded p-2 text-sm flex justify-between"><span>{item.reportNumber}</span><span className="text-gray-500">queued {new Date(item.queuedAt).toLocaleString('de-DE')}</span></div>)}
            </div>
          </div>
          <div className="grid md:grid-cols-3 gap-3">
            <InfoTile icon={<CloudOff size={16} />} label="Pending" value={String(reports.filter((report) => report.syncStatus === 'pending').length)} />
            <InfoTile icon={<CloudUpload size={16} />} label="Synced" value={String(reports.filter((report) => report.syncStatus === 'synced').length)} />
            <InfoTile icon={<CheckCircle2 size={16} />} label="Report-Statuswerte" value={REPORT_STATUSES.join(', ')} />
          </div>
        </div>
      )}
    </div>
  );
}

function ReportForm({ selectedType, formValues, setFormValues, createReport }: {
  selectedType: typeof REPORT_TYPES[number];
  formValues: Record<string, string | boolean | string[]>;
  setFormValues: Dispatch<SetStateAction<Record<string, string | boolean | string[]>>>;
  createReport: () => void;
}) {
  const setValue = (key: string, value: string | boolean | string[]) => setFormValues((current) => ({ ...current, [key]: value }));

  return (
    <div className="space-y-3">
      <div className="grid md:grid-cols-3 gap-3">
        <Input label="Berichtnummer" value={String(formValues.reportNumber || '')} onChange={(value) => setValue('reportNumber', value)} />
        <Input label="Kunde-ID" value={String(formValues.customerId || '')} onChange={(value) => setValue('customerId', value)} />
        <Input label="Standort-ID" value={String(formValues.locationId || '')} onChange={(value) => setValue('locationId', value)} />
        <Input label="Asset-ID" value={String(formValues.assetId || '')} onChange={(value) => setValue('assetId', value)} />
        <Input label="Techniker" value={String(formValues.technician || '')} onChange={(value) => setValue('technician', value)} />
        <Input label="Datum" value={String(formValues.date || '')} onChange={(value) => setValue('date', value)} />
      </div>

      {selectedType === 'measurement_protocol' && (
        <div className="grid md:grid-cols-2 gap-3">
          <Input label="Sichtprüfung bestanden (ja/nein)" value={String(formValues.visualInspectionPassed || '')} onChange={(value) => setValue('visualInspectionPassed', value)} />
          <Input label="Kontaktwiderstand in mΩ" value={String(formValues.contactResistance || '')} onChange={(value) => setValue('contactResistance', value)} />
          <Input label="Auslösezeit in ms" value={String(formValues.tripTime || '')} onChange={(value) => setValue('tripTime', value)} />
          <Input label="Isolationswiderstand in MΩ" value={String(formValues.insulationResistance || '')} onChange={(value) => setValue('insulationResistance', value)} />
          <Input label="Bemerkung" value={String(formValues.remark || '')} onChange={(value) => setValue('remark', value)} />
          <Input label="Unterschrift Kunde" value={String(formValues.customerSignature || '')} onChange={(value) => setValue('customerSignature', value)} />
          <Input label="Unterschrift Techniker" value={String(formValues.technicianSignature || '')} onChange={(value) => setValue('technicianSignature', value)} />
        </div>
      )}

      {selectedType === 'maintenance_report' && (
        <div className="grid md:grid-cols-2 gap-3">
          <Input label="Auftrag" value={String(formValues.orderNumber || '')} onChange={(value) => setValue('orderNumber', value)} />
          <Input label="Ausgeführte Arbeiten" value={String(formValues.workDone || '')} onChange={(value) => setValue('workDone', value)} />
          <Input label="Verwendetes Material" value={String(formValues.materialUsed || '')} onChange={(value) => setValue('materialUsed', value)} />
          <Input label="Arbeitszeit" value={String(formValues.workingTime || '')} onChange={(value) => setValue('workingTime', value)} />
          <Input label="Mängel vorhanden ja/nein" value={String(formValues.defectsPresent || '')} onChange={(value) => setValue('defectsPresent', value)} />
          <Input label="Empfohlene Maßnahmen" value={String(formValues.recommendations || '')} onChange={(value) => setValue('recommendations', value)} />
          <Input label="Status" value={String(formValues.status || 'Entwurf')} onChange={(value) => setValue('status', value)} />
        </div>
      )}

      {selectedType === 'checklist' && (
        <div className="grid md:grid-cols-2 gap-3">
          <Input label="Checklistenname" value={String(formValues.checklistName || '')} onChange={(value) => setValue('checklistName', value)} />
          <Input label="Prüfpunkte (CSV)" value={String(formValues.checkpoints || '')} onChange={(value) => setValue('checkpoints', value)} />
          <Input label="Mängelnotiz je Prüfpunkt" value={String(formValues.defectNotes || '')} onChange={(value) => setValue('defectNotes', value)} />
          <Input label="Gesamtbewertung" value={String(formValues.score || '')} onChange={(value) => setValue('score', value)} />
          <Input label="Status" value={String(formValues.status || 'Entwurf')} onChange={(value) => setValue('status', value)} />
        </div>
      )}

      <button onClick={createReport} className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700">Bericht anlegen</button>
    </div>
  );
}

function Input({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="text-sm">{label}<input className="w-full border rounded mt-1 p-2" value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

function StatCard({ label, value }: { label: string; value: string }) {
  return <div className="bg-white border rounded-xl p-4"><p className="text-xs text-gray-500">{label}</p><p className="text-xl font-semibold mt-1">{value}</p></div>;
}

function InfoTile({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return <div className="bg-white border rounded-xl p-4"><div className="text-gray-500 inline-flex items-center gap-2 text-sm">{icon} {label}</div><p className="mt-1 font-semibold">{value}</p></div>;
}
