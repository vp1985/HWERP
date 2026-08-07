import type { ReportAttachment, ReservedNumber, ServiceOrder, ServiceReport, SyncQueueItem } from './types';

const DB_NAME = 'hwerp-service-reports';
const DB_VERSION = 1;

const STORE_ORDERS = 'offlineOrders';
const STORE_RESERVED_NUMBERS = 'reservedNumbers';
const STORE_REPORTS = 'serviceReports';
const STORE_SYNC_QUEUE = 'syncQueue';
const STORE_ATTACHMENTS = 'reportAttachments';
const STORE_META = 'meta';

interface SeedData {
  orders: ServiceOrder[];
  reservedNumbers: ReservedNumber[];
  reports: ServiceReport[];
  syncQueue: SyncQueueItem[];
}

export interface ServiceReportsSnapshot extends SeedData {
  attachments: ReportAttachment[];
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_ORDERS)) db.createObjectStore(STORE_ORDERS, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(STORE_RESERVED_NUMBERS)) db.createObjectStore(STORE_RESERVED_NUMBERS, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(STORE_REPORTS)) db.createObjectStore(STORE_REPORTS, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(STORE_SYNC_QUEUE)) db.createObjectStore(STORE_SYNC_QUEUE, { keyPath: 'reportId' });
      if (!db.objectStoreNames.contains(STORE_META)) db.createObjectStore(STORE_META, { keyPath: 'key' });

      if (!db.objectStoreNames.contains(STORE_ATTACHMENTS)) {
        const attachments = db.createObjectStore(STORE_ATTACHMENTS, { keyPath: 'id' });
        attachments.createIndex('reportId', 'reportId', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB konnte nicht geöffnet werden.'));
  });

  return dbPromise;
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB-Anfrage fehlgeschlagen.'));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB-Transaktion fehlgeschlagen.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB-Transaktion abgebrochen.'));
  });
}

async function getAll<T>(storeName: string): Promise<T[]> {
  const db = await openDb();
  return requestToPromise(db.transaction(storeName, 'readonly').objectStore(storeName).getAll()) as Promise<T[]>;
}

async function replaceAll<T>(storeName: string, items: T[]): Promise<void> {
  const db = await openDb();
  const transaction = db.transaction(storeName, 'readwrite');
  const store = transaction.objectStore(storeName);
  store.clear();
  for (const item of items) store.put(item);
  await transactionDone(transaction);
}

async function putAll<T>(storeName: string, items: T[]): Promise<void> {
  const db = await openDb();
  const transaction = db.transaction(storeName, 'readwrite');
  const store = transaction.objectStore(storeName);
  for (const item of items) store.put(item);
  await transactionDone(transaction);
}

async function getMeta(key: string): Promise<unknown> {
  const db = await openDb();
  const result = await requestToPromise<{ key: string; value: unknown } | undefined>(
    db.transaction(STORE_META, 'readonly').objectStore(STORE_META).get(key)
  );
  return result?.value;
}

async function setMeta(key: string, value: unknown): Promise<void> {
  await putAll(STORE_META, [{ key, value }]);
}

async function seedIfNeeded(seed: SeedData): Promise<void> {
  const seeded = await getMeta('seeded');
  if (seeded) return;

  await Promise.all([
    replaceAll(STORE_ORDERS, seed.orders),
    replaceAll(STORE_RESERVED_NUMBERS, seed.reservedNumbers),
    replaceAll(STORE_REPORTS, seed.reports),
    replaceAll(STORE_SYNC_QUEUE, seed.syncQueue),
  ]);
  await setMeta('seeded', true);
}

export const serviceReportsOfflineStore = {
  async loadSnapshot(seed: SeedData): Promise<ServiceReportsSnapshot> {
    await seedIfNeeded(seed);
    const [orders, reservedNumbers, reports, syncQueue, attachments] = await Promise.all([
      getAll<ServiceOrder>(STORE_ORDERS),
      getAll<ReservedNumber>(STORE_RESERVED_NUMBERS),
      getAll<ServiceReport>(STORE_REPORTS),
      getAll<SyncQueueItem>(STORE_SYNC_QUEUE),
      getAll<ReportAttachment>(STORE_ATTACHMENTS),
    ]);

    return { orders, reservedNumbers, reports, syncQueue, attachments };
  },

  saveOrders(orders: ServiceOrder[]) {
    return replaceAll(STORE_ORDERS, orders);
  },

  saveReservedNumbers(numbers: ReservedNumber[]) {
    return replaceAll(STORE_RESERVED_NUMBERS, numbers);
  },

  saveReports(reports: ServiceReport[]) {
    return replaceAll(STORE_REPORTS, reports);
  },

  saveSyncQueue(queue: SyncQueueItem[]) {
    return replaceAll(STORE_SYNC_QUEUE, queue);
  },

  async addAttachment(attachment: ReportAttachment): Promise<void> {
    await putAll(STORE_ATTACHMENTS, [attachment]);
  },

  async updateAttachment(attachment: ReportAttachment): Promise<void> {
    await putAll(STORE_ATTACHMENTS, [attachment]);
  },

  async deleteAttachment(id: string): Promise<void> {
    const db = await openDb();
    const transaction = db.transaction(STORE_ATTACHMENTS, 'readwrite');
    transaction.objectStore(STORE_ATTACHMENTS).delete(id);
    await transactionDone(transaction);
  },
};
