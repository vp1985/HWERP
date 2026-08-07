import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent, ClipboardEvent, Dispatch, ReactNode, SetStateAction } from 'react';
import { CheckCircle2, CloudOff, CloudUpload, Copy, FileJson, FileText, ImagePlus, RefreshCcw, Trash2, Wifi, WifiOff } from 'lucide-react';
import { demoCustomers, demoOrders, demoReports, demoReservedNumbers, demoSyncQueue, SERVICE_TECHNICIANS } from '../data/demoData';
import { NUMBER_STATUSES, REPORT_STATUSES, REPORT_TYPES } from '../types';
import type { ReportAttachment, ReportType, ReportValue, ReservedNumber, ServiceOrder, ServiceReport, SyncQueueItem } from '../types';
import { allAssets, findCustomer, findLocation, lastSyncText, orderLabel, reportToExport, reportTypeLabel } from '../utils';
import { listNumberCircles, reserveNumberCircle, returnNumberCircle } from '../../../lib/numberCircles';
import type { NumberCircle } from '../../../lib/numberCircles';
import { fetchServiceReports, syncServiceReports } from '../components/serviceApi';
import { serviceReportsOfflineStore } from '../offlineStore';

type ServiceTab = 'dashboard' | 'orders' | 'numbers' | 'reports' | 'templates' | 'sync';
type ReportFormValues = Record<string, ReportValue>;

const TAB_ITEMS: { key: ServiceTab; label: string }[] = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'orders', label: 'Aufträge' },
  { key: 'numbers', label: 'Nummernreservierung' },
  { key: 'reports', label: 'Berichte' },
  { key: 'templates', label: 'Vorlagen' },
  { key: 'sync', label: 'Sync' },
];

const FALLBACK_SERVICE_CIRCLES: NumberCircle[] = [
  { key: 'service_ls', label: 'Servicebericht LS', prefix: 'LS-{YYYY}', formatTemplate: '{PREFIX}-{NUMBER}', padding: 6, nextValue: 1, resetYearly: true, lastYear: new Date().getFullYear(), isActive: true },
  { key: 'service_wb', label: 'Wartungsbericht WB', prefix: 'WB-{YYYY}', formatTemplate: '{PREFIX}-{NUMBER}', padding: 6, nextValue: 1, resetYearly: true, lastYear: new Date().getFullYear(), isActive: true },
  { key: 'service_dguv', label: 'DGUV-Prüfung', prefix: 'DGUV-{YYYY}', formatTemplate: '{PREFIX}-{NUMBER}', padding: 6, nextValue: 1, resetYearly: true, lastYear: new Date().getFullYear(), isActive: true },
  { key: 'asset_numbers', label: 'Gerätenummern', prefix: 'AST', formatTemplate: '{PREFIX}-{NUMBER}', padding: 4, nextValue: 1, resetYearly: false, lastYear: new Date().getFullYear(), isActive: true },
];

function isReservableNumberCircle(circle: NumberCircle) {
  return circle.isActive && (circle.key.startsWith('service_') || circle.key === 'asset_numbers');
}

function initialValues(): ReportFormValues {
  return {
    customerId: demoCustomers[0].id,
    locationId: demoCustomers[0].locations[0].id,
    assetId: demoCustomers[0].locations[0].assets[0].id,
    orderNumber: demoOrders[0]?.orderNumber ?? '',
    technician: SERVICE_TECHNICIANS[0],
    date: new Date().toISOString().slice(0, 10),
  };
}

export default function OfflineServiceReportsModulePage({ initialTab = 'dashboard' }: { initialTab?: ServiceTab }) {
  const [activeTab, setActiveTab] = useState<ServiceTab>(initialTab);
  const [isOnline, setIsOnline] = useState(() => typeof navigator === 'undefined' ? true : navigator.onLine);
  const [isLoaded, setIsLoaded] = useState(false);
  const [storeError, setStoreError] = useState('');
  const [orders, setOrders] = useState<ServiceOrder[]>(demoOrders);
  const [reservedNumbers, setReservedNumbers] = useState<ReservedNumber[]>(demoReservedNumbers);
  const [reports, setReports] = useState<ServiceReport[]>(demoReports);
  const [syncQueue, setSyncQueue] = useState<SyncQueueItem[]>(demoSyncQueue);
  const [attachments, setAttachments] = useState<ReportAttachment[]>([]);
  const [jsonPreview, setJsonPreview] = useState('');

  const [numberCircles, setNumberCircles] = useState<NumberCircle[]>(FALLBACK_SERVICE_CIRCLES);
  const [selectedCircle, setSelectedCircle] = useState(FALLBACK_SERVICE_CIRCLES[0].key);
  const [reserveQuantity, setReserveQuantity] = useState(5);
  const [selectedOrderId, setSelectedOrderId] = useState(demoOrders[0]?.id ?? '');
  const [isReserving, setIsReserving] = useState(false);
  const [isReturningNumbers, setIsReturningNumbers] = useState(false);
  const [numberReservationError, setNumberReservationError] = useState('');

  const [selectedType, setSelectedType] = useState<ReportType>('measurement_protocol');
  const [formValues, setFormValues] = useState<ReportFormValues>(() => initialValues());
  const [selectedReportId, setSelectedReportId] = useState('');
  const [editorValues, setEditorValues] = useState<ReportFormValues>(() => initialValues());
  const [editorError, setEditorError] = useState('');
  const [syncMessage, setSyncMessage] = useState('');

  const assets = useMemo(() => allAssets(demoCustomers), []);
  const selectedReport = reports.find((report) => report.id === selectedReportId);
  const selectedAttachments = attachments
    .filter((attachment) => attachment.reportId === selectedReportId)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const visibleReservedNumbers = reservedNumbers.filter((number) => number.status !== 'zurückgegeben');
  const returnableNumbers = reservedNumbers.filter((number) => number.status === 'reserviert');

  useEffect(() => setActiveTab(initialTab), [initialTab]);

  useEffect(() => {
    const online = () => setIsOnline(true);
    const offline = () => setIsOnline(false);
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    return () => {
      window.removeEventListener('online', online);
      window.removeEventListener('offline', offline);
    };
  }, []);

  useEffect(() => {
    async function loadOfflineState() {
      try {
        const snapshot = await serviceReportsOfflineStore.loadSnapshot({
          orders: demoOrders,
          reservedNumbers: demoReservedNumbers,
          reports: demoReports,
          syncQueue: demoSyncQueue,
        });
        setOrders(snapshot.orders);
        setReservedNumbers(snapshot.reservedNumbers);
        setReports(snapshot.reports);
        setSyncQueue(snapshot.syncQueue);
        setAttachments(snapshot.attachments);
        setSelectedOrderId(snapshot.orders[0]?.id ?? '');
        setIsLoaded(true);

        if (typeof navigator !== 'undefined' && navigator.onLine) {
          fetchServiceReports()
            .then((serverReports) => {
              if (serverReports.length > 0) setReports((current) => mergeReports(current, serverReports));
            })
            .catch(() => undefined);
        }
      } catch (error) {
        setStoreError(`Offline-Speicher konnte nicht geladen werden: ${String(error)}`);
        setIsLoaded(true);
      }
    }

    loadOfflineState();
  }, []);

  useEffect(() => {
    if (isLoaded) serviceReportsOfflineStore.saveOrders(orders).catch((error) => setStoreError(String(error)));
  }, [isLoaded, orders]);

  useEffect(() => {
    if (isLoaded) serviceReportsOfflineStore.saveReservedNumbers(reservedNumbers).catch((error) => setStoreError(String(error)));
  }, [isLoaded, reservedNumbers]);

  useEffect(() => {
    if (isLoaded) serviceReportsOfflineStore.saveReports(reports).catch((error) => setStoreError(String(error)));
  }, [isLoaded, reports]);

  useEffect(() => {
    if (isLoaded) serviceReportsOfflineStore.saveSyncQueue(syncQueue).catch((error) => setStoreError(String(error)));
  }, [isLoaded, syncQueue]);

  useEffect(() => {
    async function loadServiceCircles() {
      try {
        const circles = (await listNumberCircles()).filter(isReservableNumberCircle);
        if (circles.length > 0) {
          setNumberCircles(circles);
          setSelectedCircle((current) => circles.some((circle) => circle.key === current) ? current : circles[0].key);
        }
      } catch (error) {
        setNumberReservationError(`Nummernkreise konnten nicht geladen werden: ${String(error)}`);
      }
    }

    if (isOnline) loadServiceCircles();
  }, [isOnline]);

  const stats = useMemo(() => {
    const openOrders = orders.filter((order) => order.status !== 'abgeschlossen' && order.status !== 'synchronisiert').length;
    const reserved = reservedNumbers.filter((number) => number.status === 'reserviert').length;
    const consumed = reservedNumbers.filter((number) => number.status === 'verwendet').length;
    const editing = reports.filter((report) => report.status === 'Entwurf').length;
    const readySync = reports.filter((report) => report.syncStatus === 'pending' || report.syncStatus === 'failed').length;
    return { openOrders, reserved, consumed, editing, readySync };
  }, [orders, reservedNumbers, reports]);

  const handleReserve = async () => {
    const selectedOrder = orders.find((order) => order.id === selectedOrderId);
    if (!selectedOrder) return;

    const reusableNumbers = findReusableReturnedNumbers(reservedNumbers, numberCircles, selectedCircle, reserveQuantity);
    if (reusableNumbers.length === reserveQuantity) {
      const reusedValues = reusableNumbers.map((number) => number.value);
      setReservedNumbers((current) => current.map((number) => (
        reusableNumbers.some((reused) => reused.id === number.id)
          ? { ...number, orderId: selectedOrder.id, customerId: selectedOrder.customerId, status: 'reserviert', returnedAt: undefined }
          : number
      )));
      setOrders((current) => current.map((order) => order.id === selectedOrder.id
        ? { ...order, reservedNumbers: Array.from(new Set([...order.reservedNumbers, ...reusedValues])) }
        : order));
      setNumberReservationError('');
      return;
    }

    if (!isOnline) {
      setNumberReservationError('Reservierung ist offline nur möglich, wenn zurückgegebene Nummern in der gewünschten Menge zusammenhängend verfügbar sind.');
      return;
    }

    setIsReserving(true);
    setNumberReservationError('');
    try {
      const generated = (await reserveNumberCircle(selectedCircle, reserveQuantity)).numbers;
      const circleLabel = numberCircles.find((circle) => circle.key === selectedCircle)?.label ?? selectedCircle;
      const newNumbers: ReservedNumber[] = generated.map((value, index) => ({
        id: `n-${Date.now()}-${index}`,
        numberCircle: circleLabel,
        value,
        orderId: selectedOrder.id,
        customerId: selectedOrder.customerId,
        status: 'reserviert',
      }));
      setReservedNumbers((current) => [...newNumbers, ...current]);
      setOrders((current) => current.map((order) => order.id === selectedOrder.id ? { ...order, reservedNumbers: [...order.reservedNumbers, ...generated] } : order));
    } catch (error) {
      setNumberReservationError(String(error));
    } finally {
      setIsReserving(false);
    }
  };

  const markNumberAsUsed = (numberId: string) => {
    setReservedNumbers((current) => current.map((number) => (number.id === numberId ? { ...number, status: 'verwendet' } : number)));
  };

  const canReturnNumbersOnline = () => {
    const canReachApi = isOnline && (typeof navigator === 'undefined' || navigator.onLine);
    if (!canReachApi) {
      setNumberReservationError('Zurückgeben ist nur online möglich. Die Nummer bleibt reserviert.');
      if (typeof navigator !== 'undefined' && !navigator.onLine) setIsOnline(false);
      return false;
    }
    return true;
  };

  const markNumbersAsReturned = (returned: ReservedNumber[]) => {
    if (returned.length === 0) return;

    const returnedIds = new Set(returned.map((number) => number.id));
    const returnedByOrder = returned.reduce((acc, number) => {
      const values = acc.get(number.orderId) ?? new Set<string>();
      values.add(number.value);
      acc.set(number.orderId, values);
      return acc;
    }, new Map<string, Set<string>>());
    const returnedAt = new Date().toISOString();

    setReservedNumbers((current) => current.map((number) => (
      returnedIds.has(number.id) ? { ...number, status: 'zurückgegeben', returnedAt } : number
    )));
    setOrders((current) => current.map((order) => {
      const values = returnedByOrder.get(order.id);
      return values ? { ...order, reservedNumbers: order.reservedNumbers.filter((value) => !values.has(value)) } : order;
    }));
  };

  const returnReservedNumber = async (numberId: string) => {
    const returnedNumber = reservedNumbers.find((number) => number.id === numberId);
    if (!returnedNumber || returnedNumber.status !== 'reserviert') return;

    if (!canReturnNumbersOnline()) return;

    const circleKey = findCircleKeyForNumber(returnedNumber, numberCircles);
    if (!circleKey) {
      setNumberReservationError('Nummernkreis konnte für die Rückgabe nicht eindeutig ermittelt werden. Die Nummer bleibt reserviert.');
      return;
    }

    try {
      await returnNumberCircle(circleKey, returnedNumber.value);
    } catch (error) {
      setNumberReservationError(String(error));
      return;
    }

    markNumbersAsReturned([returnedNumber]);
    setNumberReservationError('');
  };

  const returnAllReservedNumbers = async () => {
    const numbersToReturn = reservedNumbers.filter((number) => number.status === 'reserviert');
    if (numbersToReturn.length === 0) return;
    if (!canReturnNumbersOnline()) return;

    setIsReturningNumbers(true);
    setNumberReservationError('');
    const returned: ReservedNumber[] = [];
    const failures: string[] = [];

    try {
      for (const number of numbersToReturn) {
        const circleKey = findCircleKeyForNumber(number, numberCircles);
        if (!circleKey) {
          failures.push(`${number.value}: Nummernkreis nicht ermittelt`);
          continue;
        }

        try {
          await returnNumberCircle(circleKey, number.value);
          returned.push(number);
        } catch (error) {
          failures.push(`${number.value}: ${String(error)}`);
        }
      }

      markNumbersAsReturned(returned);
      if (failures.length > 0) {
        setNumberReservationError(`${returned.length} Nummer(n) zurückgegeben. ${failures.length} Nummer(n) bleiben reserviert: ${failures.join(' · ')}`);
      } else {
        setNumberReservationError(`${returned.length} Nummer(n) zurückgegeben.`);
      }
    } finally {
      setIsReturningNumbers(false);
    }
  };

  const createReport = () => {
    const now = new Date().toISOString();
    const report: ServiceReport = {
      id: `r-${Date.now()}`,
      reportNumber: String(formValues.reportNumber || `ENTWURF-${Date.now()}`),
      type: selectedType,
      customerId: String(formValues.customerId || demoCustomers[0].id),
      locationId: String(formValues.locationId || demoCustomers[0].locations[0].id),
      assetId: String(formValues.assetId || ''),
      orderNumber: String(formValues.orderNumber || ''),
      values: formValues,
      status: 'Entwurf',
      syncStatus: 'pending',
      createdBy: String(formValues.technician || SERVICE_TECHNICIANS[0]),
      createdAt: now,
      updatedAt: now,
    };
    setReports((current) => [report, ...current]);
    setSelectedReportId(report.id);
    setEditorValues(report.values);
    setFormValues(initialValues());
  };

  const openReport = (report: ServiceReport) => {
    setSelectedReportId(report.id);
    setEditorValues(report.values);
    setEditorError('');
    setJsonPreview('');
  };

  const saveDraft = () => {
    if (!selectedReport) return;
    const now = new Date().toISOString();
    setReports((current) => current.map((report) => report.id === selectedReport.id
      ? {
          ...report,
          values: editorValues,
          customerId: String(editorValues.customerId || report.customerId),
          locationId: String(editorValues.locationId || report.locationId),
          assetId: String(editorValues.assetId || report.assetId || ''),
          orderNumber: String(editorValues.orderNumber || report.orderNumber || ''),
          createdBy: String(editorValues.technician || report.createdBy),
          updatedAt: now,
        }
      : report));
    setEditorError('');
  };

  const completeReport = () => {
    if (!selectedReport) return;
    const updatedReport = {
      ...selectedReport,
      values: editorValues,
      customerId: String(editorValues.customerId || selectedReport.customerId),
      locationId: String(editorValues.locationId || selectedReport.locationId),
      assetId: String(editorValues.assetId || selectedReport.assetId || ''),
      orderNumber: String(editorValues.orderNumber || selectedReport.orderNumber || ''),
      createdBy: String(editorValues.technician || selectedReport.createdBy),
    };
    const reservedNumber = findReservableNumber(updatedReport, orders, reservedNumbers);
    if (!reservedNumber) {
      setEditorError('Abschluss blockiert: Es ist keine vorab serverseitig reservierte Nummer für diesen Auftrag/Kunden verfügbar.');
      return;
    }

    const now = new Date().toISOString();
    const completed: ServiceReport = {
      ...updatedReport,
      reportNumber: reservedNumber.value,
      values: { ...updatedReport.values, reportNumber: reservedNumber.value },
      status: 'abgeschlossen',
      syncStatus: 'pending',
      syncError: undefined,
      completedAt: now,
      updatedAt: now,
    };
    setReservedNumbers((current) => current.map((number) => number.id === reservedNumber.id ? { ...number, status: 'verwendet' } : number));
    setOrders((current) => current.map((order) => {
      const matches = order.id === reservedNumber.orderId || order.orderNumber === completed.orderNumber;
      return matches && !order.reportIds.includes(completed.id) ? { ...order, reportIds: [...order.reportIds, completed.id] } : order;
    }));
    setReports((current) => current.map((report) => report.id === completed.id ? completed : report));
    upsertQueueItem({ reportId: completed.id, reportNumber: completed.reportNumber, status: 'pending', queuedAt: now, updatedAt: now, attemptCount: 0 });
    setEditorError('');
  };

  const duplicateReport = (report: ServiceReport) => {
    const now = new Date().toISOString();
    const copy: ServiceReport = {
      ...report,
      id: `copy-${Date.now()}`,
      reportNumber: `ENTWURF-${Date.now()}`,
      status: 'Entwurf',
      syncStatus: 'pending',
      syncError: undefined,
      completedAt: undefined,
      syncedAt: undefined,
      createdAt: now,
      updatedAt: now,
    };
    setReports((current) => [copy, ...current]);
    setSelectedReportId(copy.id);
    setEditorValues(copy.values);
  };

  const openJson = (report: ServiceReport) => {
    const localAttachmentCount = attachments.filter((attachment) => attachment.reportId === report.id).length;
    setJsonPreview(JSON.stringify({ ...reportToExport(report, demoCustomers), localAttachmentCount }, null, 2));
  };

  const upsertQueueItem = (item: SyncQueueItem) => {
    setSyncQueue((current) => {
      const exists = current.some((queueItem) => queueItem.reportId === item.reportId);
      return exists ? current.map((queueItem) => queueItem.reportId === item.reportId ? { ...queueItem, ...item } : queueItem) : [item, ...current];
    });
  };

  const syncNow = async (retryIds?: string[]) => {
    if (!isOnline) return;
    const targetIds = new Set(retryIds ?? syncQueue.filter((item) => item.status === 'pending' || item.status === 'failed').map((item) => item.reportId));
    const targets = reports.filter((report) => targetIds.has(report.id));
    if (targets.length === 0) return;

    const now = new Date().toISOString();
    setSyncMessage('');
    setReports((current) => current.map((report) => targetIds.has(report.id) ? { ...report, syncStatus: 'syncing', syncError: undefined } : report));
    setSyncQueue((current) => current.map((item) => targetIds.has(item.reportId) ? { ...item, status: 'syncing', updatedAt: now, error: undefined, attemptCount: (item.attemptCount ?? 0) + 1 } : item));

    try {
      const result = await syncServiceReports(targets.map((report) => ({ ...report, syncStatus: 'syncing' })));
      const syncedIds = new Set(result.syncedIds);
      const syncedById = new Map(result.reports.map((report) => [report.id, report]));
      setReports((current) => current.map((report) => {
        if (!syncedIds.has(report.id)) return report;
        return { ...report, ...(syncedById.get(report.id) ?? {}), syncStatus: 'synced', status: report.status === 'Entwurf' ? 'bereit zum Sync' : report.status, syncError: undefined, syncedAt: new Date().toISOString() };
      }));
      setSyncQueue((current) => current.filter((item) => !syncedIds.has(item.reportId)));
      setSyncMessage(`${syncedIds.size} Bericht(e) synchronisiert. Lokale Screenshots wurden nicht übertragen.`);
    } catch (error) {
      const message = String(error);
      setReports((current) => current.map((report) => targetIds.has(report.id) ? { ...report, syncStatus: 'failed', syncError: message } : report));
      setSyncQueue((current) => current.map((item) => targetIds.has(item.reportId) ? { ...item, status: 'failed', updatedAt: new Date().toISOString(), error: message } : item));
      setSyncMessage(`Synchronisation fehlgeschlagen: ${message}`);
    }
  };

  const addScreenshotFiles = async (files: FileList | File[]) => {
    if (!selectedReport) return;
    const imageFiles = Array.from(files).filter((file) => file.type.startsWith('image/'));
    if (imageFiles.length === 0) return;
    const startOrder = selectedAttachments.length;
    const created: ReportAttachment[] = [];

    for (const [index, file] of imageFiles.entries()) {
      created.push({
        id: `att-${Date.now()}-${index}`,
        reportId: selectedReport.id,
        fileName: file.name || `screenshot-${index + 1}.png`,
        mimeType: file.type || 'image/png',
        dataUrl: await fileToDataUrl(file),
        comment: '',
        sortOrder: startOrder + index,
        createdAt: new Date().toISOString(),
      });
    }

    for (const attachment of created) await serviceReportsOfflineStore.addAttachment(attachment);
    setAttachments((current) => [...current, ...created]);
  };

  const onScreenshotInput = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) void addScreenshotFiles(event.target.files);
    event.target.value = '';
  };

  const onPasteScreenshots = (event: ClipboardEvent<HTMLDivElement>) => {
    const files = Array.from(event.clipboardData.files).filter((file) => file.type.startsWith('image/'));
    if (files.length === 0) return;
    event.preventDefault();
    void addScreenshotFiles(files);
  };

  const updateAttachmentComment = (id: string, comment: string) => {
    const attachment = attachments.find((item) => item.id === id);
    if (!attachment) return;
    const updated = { ...attachment, comment };
    setAttachments((current) => current.map((item) => item.id === id ? updated : item));
    serviceReportsOfflineStore.updateAttachment(updated).catch((error) => setStoreError(String(error)));
  };

  const deleteAttachment = (id: string) => {
    setAttachments((current) => current.filter((attachment) => attachment.id !== id));
    serviceReportsOfflineStore.deleteAttachment(id).catch((error) => setStoreError(String(error)));
  };

  const statusChip = (value: string) => <span className={`px-2 py-1 rounded-full text-xs font-medium ${chipClass(value)}`}>{value}</span>;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-wrap gap-3 justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Serviceberichte & Prüfprotokolle</h1>
          <p className="text-sm text-gray-500">Offline erstellen, lokal speichern, später synchronisieren. Screenshots bleiben in v1 lokal.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setIsOnline(false)} className="px-3 py-2 rounded-lg border text-sm bg-gray-50 hover:bg-gray-100 inline-flex items-center gap-2"><WifiOff size={16} /> Offline schalten</button>
          <button onClick={() => setIsOnline(true)} className="px-3 py-2 rounded-lg border text-sm bg-green-50 hover:bg-green-100 inline-flex items-center gap-2"><Wifi size={16} /> Online schalten</button>
          <span className={`px-3 py-2 rounded-lg text-sm ${isOnline ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>{isOnline ? 'Online' : 'Offline'}</span>
        </div>
      </div>

      {storeError && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{storeError}</div>}

      <div className="bg-white border rounded-xl p-2 flex flex-wrap gap-2">
        {TAB_ITEMS.map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={`px-4 py-2 rounded-lg text-sm ${activeTab === tab.key ? 'bg-blue-600 text-white' : 'bg-gray-50 hover:bg-gray-100'}`}>{tab.label}</button>
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
              return <tr key={order.id} className="border-b align-top"><td className="py-2 font-mono">{order.orderNumber}</td><td>{customer?.name}</td><td>{location?.name}</td><td>{order.technician}</td><td>{order.plannedDate}</td><td>{order.description}</td><td>{order.assetIds.map((id) => assets.find((asset) => asset.id === id)?.name).filter(Boolean).join(', ')}</td><td>{order.reservedNumbers.join(', ') || '-'}</td><td>{order.reportIds.join(', ') || '-'}</td><td>{statusChip(order.status)}</td></tr>;
            })}
          </tbody></table>
        </div>
      )}

      {activeTab === 'numbers' && (
        <div className="grid lg:grid-cols-3 gap-4">
          <div className="bg-white border rounded-xl p-4 space-y-3">
            <h2 className="font-semibold">Nummernreservierung</h2>
            <p className="text-xs text-orange-700 bg-orange-50 border border-orange-100 p-2 rounded">Offline-Rückgabe ist nicht möglich. Zurückgegebene Nummern werden erst nach erfolgreicher Server-Rückgabe wiederverwendbar, wenn die gewünschte Menge zusammenhängend verfügbar ist.</p>
            {numberReservationError && <p className="text-xs text-red-700 bg-red-50 border border-red-100 p-2 rounded">{numberReservationError}</p>}
            <label className="text-sm block">Nummernkreis
              <select className="w-full border rounded mt-1 p-2" value={selectedCircle} onChange={(event) => setSelectedCircle(event.target.value)}>
                {numberCircles.map((circle) => <option key={circle.key} value={circle.key}>{circle.label}</option>)}
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
            <button onClick={handleReserve} disabled={isReserving} className="w-full px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">{isReserving ? 'Reserviert...' : 'Reservieren'}</button>
          </div>
          <div className="lg:col-span-2 bg-white border rounded-xl p-4 overflow-x-auto">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <h3 className="font-semibold">Reservierte Nummern</h3>
              <button
                onClick={() => void returnAllReservedNumbers()}
                disabled={isReturningNumbers || returnableNumbers.length === 0}
                className="text-xs px-3 py-2 rounded border border-orange-200 text-orange-700 hover:bg-orange-50 disabled:opacity-50"
              >
                {isReturningNumbers ? 'Gibt frei...' : `Alle reservierten freigeben (${returnableNumbers.length})`}
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-3">Zurückgegebene Nummern verschwinden aus dieser Übersicht und werden beim nächsten Reservieren wiederverwendet, wenn die Server-Rückgabe erfolgreich war und ein zusammenhängender Block passt.</p>
            <table className="w-full text-sm min-w-[650px]"><thead><tr className="border-b text-left"><th className="py-2">Nummer</th><th>Kreis</th><th>Auftrag</th><th>Status</th><th>Aktion</th></tr></thead>
              <tbody>
                {visibleReservedNumbers.length === 0 && (
                  <tr><td colSpan={5} className="py-4 text-sm text-gray-500">Keine reservierten oder verwendeten Nummern sichtbar.</td></tr>
                )}
                {visibleReservedNumbers.map((number) => (
                  <tr key={number.id} className={`border-b ${number.status === 'verwendet' ? 'bg-green-50' : ''}`}>
                    <td className="font-mono py-2">{number.value}</td>
                    <td>{number.numberCircle}</td>
                    <td>{orderLabel(orders, number.orderId)}</td>
                    <td>{statusChip(number.status)}</td>
                    <td>
                      {number.status === 'reserviert' ? (
                        <div className="flex flex-wrap gap-1">
                          <button onClick={() => markNumberAsUsed(number.id)} className="text-xs px-2 py-1 rounded border hover:bg-gray-50">Als verwendet markieren</button>
                          <button onClick={() => void returnReservedNumber(number.id)} disabled={isReturningNumbers} className="text-xs px-2 py-1 rounded border border-orange-200 text-orange-700 hover:bg-orange-50 disabled:opacity-50">Zurückgeben</button>
                        </div>
                      ) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              {NUMBER_STATUSES.filter((status) => status !== 'zurückgegeben').map((status) => <span key={status} className="px-2 py-1 border rounded">{status}</span>)}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'reports' && (
        <div className="space-y-4">
          <div className="bg-white border rounded-xl p-4">
            <h2 className="font-semibold mb-3">Neuen Bericht als Entwurf anlegen</h2>
            <div className="flex flex-wrap gap-2 mb-3">{REPORT_TYPES.map((type) => <button key={type} onClick={() => setSelectedType(type)} className={`px-3 py-2 rounded border text-sm ${selectedType === type ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white'}`}>{reportTypeLabel[type]}</button>)}</div>
            <ReportForm selectedType={selectedType} formValues={formValues} setFormValues={setFormValues} submitLabel="Entwurf anlegen" onSubmit={createReport} />
          </div>

          <div className="bg-white border rounded-xl p-4 overflow-x-auto">
            <h2 className="font-semibold mb-3">Berichtsliste</h2>
            <table className="w-full text-sm min-w-[1100px]"><thead><tr className="border-b text-left"><th className="py-2">Berichtnummer</th><th>Typ</th><th>Kunde</th><th>Standort</th><th>Asset</th><th>Status</th><th>Sync</th><th>Anhänge</th><th>Erstellt von</th><th>Erstellt am</th><th>Aktionen</th></tr></thead>
              <tbody>
                {reports.map((report) => {
                  const customer = findCustomer(demoCustomers, report.customerId);
                  const location = findLocation(demoCustomers, report.customerId, report.locationId);
                  const asset = assets.find((item) => item.id === report.assetId);
                  const attachmentCount = attachments.filter((attachment) => attachment.reportId === report.id).length;
                  return (
                    <tr key={report.id} className={`border-b align-top ${selectedReportId === report.id ? 'bg-blue-50' : ''}`}>
                      <td className="font-mono py-2">{report.reportNumber}</td><td>{reportTypeLabel[report.type]}</td><td>{customer?.name}</td><td>{location?.name}</td><td>{asset?.name || '-'}</td><td>{statusChip(report.status)}</td><td>{statusChip(report.syncStatus)}</td>
                      <td>{attachmentCount > 0 ? <span>{attachmentCount} lokal</span> : '-'}</td><td>{report.createdBy}</td><td>{new Date(report.createdAt).toLocaleString('de-DE')}</td>
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
            <div className="bg-white border rounded-xl p-4 space-y-4" onPaste={onPasteScreenshots}>
              <div className="flex flex-wrap justify-between gap-3">
                <div>
                  <h2 className="font-semibold">Bericht bearbeiten: {selectedReport.reportNumber}</h2>
                  <p className="text-xs text-gray-500">{reportTypeLabel[selectedReport.type]} · {selectedReport.status} · {selectedReport.syncStatus}</p>
                </div>
                {selectedReport.syncStatus === 'synced' && selectedAttachments.length > 0 && <span className="text-xs bg-orange-50 text-orange-700 border border-orange-200 rounded px-2 py-1 h-fit">Anhänge nur lokal gespeichert</span>}
              </div>
              {editorError && <div className="bg-red-50 border border-red-200 text-red-700 rounded px-3 py-2 text-sm">{editorError}</div>}
              <ReportForm selectedType={selectedReport.type} formValues={editorValues} setFormValues={setEditorValues} submitLabel="Entwurf speichern" onSubmit={saveDraft} />
              <div className="flex flex-wrap gap-2">
                <button onClick={completeReport} className="px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700">Abschließen</button>
                <button onClick={() => openJson(selectedReport)} className="px-4 py-2 rounded border inline-flex items-center gap-2"><FileJson size={14} /> JSON</button>
                <button onClick={() => window.print()} className="px-4 py-2 rounded border">Druckansicht</button>
              </div>
              <AttachmentPanel attachments={selectedAttachments} onInput={onScreenshotInput} onCommentChange={updateAttachmentComment} onDelete={deleteAttachment} />
            </div>
          )}

          {jsonPreview && (
            <div className="bg-gray-900 text-gray-100 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2"><p className="font-semibold">JSON-Export</p><button onClick={() => navigator.clipboard.writeText(jsonPreview)} className="text-xs px-2 py-1 border border-gray-700 rounded inline-flex items-center gap-1"><Copy size={12} /> Kopieren</button></div>
              <pre className="text-xs overflow-auto">{jsonPreview}</pre>
            </div>
          )}

          <PrintPreview report={selectedReport} attachments={selectedAttachments} />
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
          {syncMessage && <div className="bg-blue-50 text-blue-700 border border-blue-200 rounded-lg px-4 py-3 text-sm">{syncMessage}</div>}
          <div className="bg-white border rounded-xl p-4">
            <div className="flex flex-wrap justify-between gap-2 items-center mb-3">
              <h2 className="font-semibold">Sync-Warteschlange</h2>
              <button onClick={() => void syncNow()} className="px-3 py-2 rounded bg-blue-600 text-white text-sm inline-flex items-center gap-2 disabled:opacity-50" disabled={!isOnline}><RefreshCcw size={14} /> Jetzt synchronisieren</button>
            </div>
            <div className="space-y-2">
              {syncQueue.length === 0 ? <p className="text-sm text-gray-500">Keine offenen Sync-Einträge.</p> : syncQueue.map((item) => (
                <div key={item.reportId} className="border rounded p-3 text-sm flex flex-wrap justify-between gap-3">
                  <div>
                    <div className="font-mono">{item.reportNumber}</div>
                    <div className="text-gray-500">queued {new Date(item.queuedAt).toLocaleString('de-DE')}</div>
                    {item.error && <div className="text-red-700 mt-1">{item.error}</div>}
                  </div>
                  <div className="flex items-center gap-2">
                    {statusChip(item.status)}
                    {item.status === 'failed' && <button onClick={() => void syncNow([item.reportId])} disabled={!isOnline} className="text-xs border rounded px-2 py-1 disabled:opacity-50">Retry</button>}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="grid md:grid-cols-4 gap-3">
            <InfoTile icon={<CloudOff size={16} />} label="Pending" value={String(reports.filter((report) => report.syncStatus === 'pending').length)} />
            <InfoTile icon={<RefreshCcw size={16} />} label="Syncing" value={String(reports.filter((report) => report.syncStatus === 'syncing').length)} />
            <InfoTile icon={<CloudUpload size={16} />} label="Synced" value={String(reports.filter((report) => report.syncStatus === 'synced').length)} />
            <InfoTile icon={<CheckCircle2 size={16} />} label="Failed" value={String(reports.filter((report) => report.syncStatus === 'failed').length)} />
          </div>
          <InfoTile icon={<FileText size={16} />} label="Report-Statuswerte" value={REPORT_STATUSES.join(', ')} />
        </div>
      )}
    </div>
  );
}

function ReportForm({ selectedType, formValues, setFormValues, submitLabel, onSubmit }: {
  selectedType: ReportType;
  formValues: ReportFormValues;
  setFormValues: Dispatch<SetStateAction<ReportFormValues>>;
  submitLabel: string;
  onSubmit: () => void;
}) {
  const setValue = (key: string, value: ReportValue) => setFormValues((current) => ({ ...current, [key]: value }));
  return (
    <div className="space-y-3">
      <div className="grid md:grid-cols-3 gap-3">
        <Input label="Berichtnummer" value={String(formValues.reportNumber || '')} onChange={(value) => setValue('reportNumber', value)} />
        <Input label="Kunde-ID" value={String(formValues.customerId || '')} onChange={(value) => setValue('customerId', value)} />
        <Input label="Standort-ID" value={String(formValues.locationId || '')} onChange={(value) => setValue('locationId', value)} />
        <Input label="Asset-ID" value={String(formValues.assetId || '')} onChange={(value) => setValue('assetId', value)} />
        <Input label="Auftrag" value={String(formValues.orderNumber || '')} onChange={(value) => setValue('orderNumber', value)} />
        <Input label="Techniker" value={String(formValues.technician || '')} onChange={(value) => setValue('technician', value)} />
        <Input label="Datum" value={String(formValues.date || '')} onChange={(value) => setValue('date', value)} />
      </div>

      {selectedType === 'measurement_protocol' && (
        <div className="grid md:grid-cols-2 gap-3">
          <Input label="Sichtprüfung bestanden (ja/nein)" value={String(formValues.visualInspectionPassed || '')} onChange={(value) => setValue('visualInspectionPassed', value)} />
          <Input label="Kontaktwiderstand in mOhm" value={String(formValues.contactResistance || '')} onChange={(value) => setValue('contactResistance', value)} />
          <Input label="Auslösezeit in ms" value={String(formValues.tripTime || '')} onChange={(value) => setValue('tripTime', value)} />
          <Input label="Isolationswiderstand in MOhm" value={String(formValues.insulationResistance || '')} onChange={(value) => setValue('insulationResistance', value)} />
          <Input label="Bemerkung" value={String(formValues.remark || '')} onChange={(value) => setValue('remark', value)} />
          <Input label="Unterschrift Kunde" value={String(formValues.customerSignature || '')} onChange={(value) => setValue('customerSignature', value)} />
          <Input label="Unterschrift Techniker" value={String(formValues.technicianSignature || '')} onChange={(value) => setValue('technicianSignature', value)} />
        </div>
      )}

      {selectedType === 'maintenance_report' && (
        <div className="grid md:grid-cols-2 gap-3">
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

      <button onClick={onSubmit} className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700">{submitLabel}</button>
    </div>
  );
}

function AttachmentPanel({ attachments, onInput, onCommentChange, onDelete }: {
  attachments: ReportAttachment[];
  onInput: (event: ChangeEvent<HTMLInputElement>) => void;
  onCommentChange: (id: string, comment: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="border rounded-lg p-3 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-medium">Lokale Screenshots</h3>
          <p className="text-xs text-gray-500">Dateien auswählen oder Screenshot direkt in diesen Bereich einfügen.</p>
        </div>
        <label className="px-3 py-2 rounded border text-sm inline-flex items-center gap-2 cursor-pointer hover:bg-gray-50">
          <ImagePlus size={16} /> Screenshots hinzufügen
          <input type="file" accept="image/*" multiple className="hidden" onChange={onInput} />
        </label>
      </div>
      {attachments.length === 0 ? <p className="text-sm text-gray-500">Noch keine lokalen Screenshots.</p> : (
        <div className="grid md:grid-cols-2 gap-3">
          {attachments.map((attachment) => (
            <div key={attachment.id} className="border rounded-lg p-2 space-y-2">
              <img src={attachment.dataUrl} alt={attachment.fileName} className="w-full h-48 object-contain bg-gray-50 rounded border" />
              <input value={attachment.comment} onChange={(event) => onCommentChange(attachment.id, event.target.value)} placeholder="Kommentar" className="w-full border rounded p-2 text-sm" />
              <div className="flex justify-between items-center text-xs text-gray-500">
                <span>{attachment.fileName}</span>
                <button onClick={() => onDelete(attachment.id)} className="text-red-700 inline-flex items-center gap-1"><Trash2 size={12} /> Löschen</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PrintPreview({ report, attachments }: { report?: ServiceReport; attachments: ReportAttachment[] }) {
  return (
    <div className="bg-white border rounded-xl p-6 print:p-8">
      <div className="border-b pb-3 mb-4 flex justify-between"><div><p className="font-bold">HWERP Serviceberichte</p><p className="text-xs text-gray-500">Firmenkopf · Musterstrasse 1 · 12345 Beispielstadt</p></div><FileText /></div>
      <h3 className="font-semibold mb-2">A4-Druckvorschau</h3>
      {report ? (
        <div className="space-y-3 text-sm">
          <div className="grid md:grid-cols-2 gap-2">
            <div className="border rounded p-2">Berichtnummer: <span className="font-mono">{report.reportNumber}</span></div>
            <div className="border rounded p-2">Typ: {reportTypeLabel[report.type]}</div>
            <div className="border rounded p-2">Kunde: {findCustomer(demoCustomers, report.customerId)?.name ?? report.customerId}</div>
            <div className="border rounded p-2">Standort: {findLocation(demoCustomers, report.customerId, report.locationId)?.name ?? report.locationId}</div>
          </div>
          <pre className="text-xs bg-gray-50 border rounded p-3 overflow-auto">{JSON.stringify(report.values, null, 2)}</pre>
          {attachments.length > 0 && (
            <div className="grid md:grid-cols-2 gap-3">
              {attachments.map((attachment) => <div key={attachment.id} className="border rounded p-2"><img src={attachment.dataUrl} alt={attachment.fileName} className="w-full h-48 object-contain" /><p className="text-xs mt-1">{attachment.comment}</p></div>)}
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-gray-700">Bericht öffnen, um Protokolldaten und lokale Screenshots in der Druckansicht zu sehen.</p>
      )}
      <div className="grid grid-cols-2 gap-3 mt-3 text-sm"><div className="border rounded p-2">Unterschrift Kunde</div><div className="border rounded p-2">Unterschrift Techniker</div></div>
      <p className="text-xs text-gray-400 mt-4">Seite 1/1 · lokaler Ausdruck</p>
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

function findReservableNumber(report: ServiceReport, orders: ServiceOrder[], numbers: ReservedNumber[]) {
  const reportOrder = orders.find((order) => order.orderNumber === report.orderNumber || order.reportIds.includes(report.id));
  return numbers.find((number) => number.status === 'reserviert' && number.customerId === report.customerId && (!reportOrder || number.orderId === reportOrder.id));
}

function findReusableReturnedNumbers(numbers: ReservedNumber[], circles: NumberCircle[], selectedCircle: string, quantity: number) {
  if (!Number.isInteger(quantity) || quantity < 1) return [];

  const circle = circles.find((item) => item.key === selectedCircle);
  const expectedPrefix = circle ? prefixForCircle(circle) : '';
  const returned = numbers
    .filter((number) => number.status === 'zurückgegeben')
    .map((number) => ({ number, parts: parseNumberValue(number.value) }))
    .filter((item) => item.parts && (!expectedPrefix || item.parts.prefix === expectedPrefix))
    .sort((a, b) => {
      if (!a.parts || !b.parts) return 0;
      return a.parts.prefix.localeCompare(b.parts.prefix) || a.parts.value - b.parts.value;
    });

  for (let index = 0; index < returned.length; index += 1) {
    const first = returned[index].parts;
    if (!first) continue;
    const block = [returned[index]];

    for (let cursor = index + 1; cursor < returned.length && block.length < quantity; cursor += 1) {
      const previous = block[block.length - 1].parts;
      const current = returned[cursor].parts;
      if (!previous || !current) break;
      if (current.prefix !== first.prefix) break;
      if (current.value !== previous.value + 1) break;
      block.push(returned[cursor]);
    }

    if (block.length === quantity) return block.map((item) => item.number);
  }

  return [];
}

function prefixForCircle(circle: NumberCircle) {
  const year = String(new Date().getFullYear());
  return circle.prefix.replaceAll('{YYYY}', year);
}

function findCircleKeyForNumber(number: ReservedNumber, circles: NumberCircle[]) {
  const parts = parseNumberValue(number.value);
  const circle = circles.find((item) => (
    item.key === number.numberCircle
    || item.label === number.numberCircle
    || prefixForCircle(item) === number.numberCircle
    || (parts !== null && parts.prefix === prefixForCircle(item))
  ));
  return circle?.key ?? null;
}

function parseNumberValue(value: string): { prefix: string; value: number } | null {
  const match = value.match(/^(.*?)-?(\d+)$/);
  if (!match) return null;
  const parsed = Number(match[2]);
  if (!Number.isInteger(parsed)) return null;
  return { prefix: match[1], value: parsed };
}

function mergeReports(localReports: ServiceReport[], serverReports: ServiceReport[]) {
  const merged = new Map(localReports.map((report) => [report.id, report]));
  for (const report of serverReports) {
    const local = merged.get(report.id);
    if (!local || local.syncStatus === 'synced') merged.set(report.id, report);
  }
  return Array.from(merged.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('Datei konnte nicht gelesen werden.'));
    reader.readAsDataURL(file);
  });
}

function chipClass(value: string) {
  if (value === 'synced' || value === 'abgeschlossen' || value === 'verwendet') return 'bg-green-100 text-green-700';
  if (value === 'failed') return 'bg-red-100 text-red-700';
  if (value === 'syncing') return 'bg-blue-100 text-blue-700';
  if (value === 'pending' || value === 'reserviert' || value === 'Entwurf') return 'bg-orange-100 text-orange-700';
  return 'bg-gray-100 text-gray-700';
}
