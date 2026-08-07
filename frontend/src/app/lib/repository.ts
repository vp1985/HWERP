/**
 * Entity types supported by the repository
 */
export type EntityType =
  | 'customers'
  | 'supplierProductCategories'
  | 'supplierCapabilities'
  | 'supplierCapabilityTags'
  | 'assets'
  | 'materials'
  | 'services'
  | 'servicePackages'
  | 'servicePackageItems'
  | 'calculations'
  | 'calculationDevices'
  | 'calculationItems'
  | 'calculationLineItems' // Häppchen E: Material-Positionen in Kalkulationen
  | 'transformerInventoryCalculationLinks'
  | 'transformerInventoryReservations'
  | 'transformerInventoryDetailOverrides'
  | 'transformerInventoryAttachments'
  | 'transformerInventoryCostItems'
  | 'inquiries'
  | 'inquiryMasterDataCategories'
  | 'inquiryMessages'
  | 'inquiryResponseDrafts'
  | 'inquiryAttachments'
  | 'inquiryExternalLinks'
  | 'inquiryScopeItems'
  | 'workshopTaskTemplates'
  | 'workshopCards'
  | 'workshopCardTasks'
  | 'checklistTemplates'
  | 'checklistTemplateGroups'
  | 'checklistTemplateItems'
  | 'checklistTemplateLinks'
  | 'checklistItemActions'
  | 'checklistRuns'
  | 'checklistRunLinks'
  | 'checklistRunItems'
  | 'tags'
  | 'locations'
  | 'locationCustomers'
  | 'contactPersons'
  | 'customerContactPersons'
  | 'locationContactOverrides'
  | 'assetContactOverrides'
  | 'transferReceipts'
  | 'transferReceiptItems'
  | 'assetDocuments'
  | 'assetHistoryEntries'
  | 'selectOptions'
  | 'sequences'
  | 'settings';

/**
 * Base interface for all entities
 */
export interface BaseEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Repository interface for CRUD operations
 */
export interface Repository {
  /**
   * List all entities of a given type
   */
  list<T extends BaseEntity>(entity: EntityType): Promise<T[]>;

  /**
   * Get a single entity by ID
   */
  get<T extends BaseEntity>(entity: EntityType, id: string): Promise<T | null>;

  /**
   * Upsert (create or update) an entity
   */
  upsert<T extends BaseEntity>(entity: EntityType, obj: T): Promise<T>;

  /**
   * Convenience: Neues Objekt anlegen (intern: upsert)
   */
  create<T extends BaseEntity>(entity: EntityType, obj: T): Promise<T>;

  /**
   * Convenience: Bestehendes Objekt aktualisieren (intern: upsert)
   */
  update<T extends BaseEntity>(entity: EntityType, id: string, obj: T): Promise<T>;

  /**
   * Delete an entity by ID
   */
  delete(entity: EntityType, id: string): Promise<void>;

  /**
   * Get next calculation number
   */
  getNextCalcNumber(): Promise<string>;

  /**
   * Clear all entities of a given type (Admin/Dev only)
   */
  clear(entity: EntityType): Promise<void>;

  /**
   * Reset all entities and metadata (Admin/Dev only)
   */
  resetAll(): Promise<void>;
}

/**
 * Storage structure in localStorage
 */
interface StorageSchema {
  schemaVersion: number;
  meta: {
    nextCalcNumber: number;
  };
  data: {
    customers: BaseEntity[];
    supplierProductCategories: BaseEntity[];
    supplierCapabilities: BaseEntity[];
    supplierCapabilityTags: BaseEntity[];
    assets: BaseEntity[];
    materials: BaseEntity[];
    services: BaseEntity[];
    servicePackages: BaseEntity[];
    servicePackageItems: BaseEntity[];
    calculations: BaseEntity[];
    calculationDevices: BaseEntity[];
    calculationItems: BaseEntity[];
    calculationLineItems: BaseEntity[]; // Häppchen E: Material-Positionen in Kalkulationen
    transformerInventoryCalculationLinks: BaseEntity[];
    transformerInventoryReservations: BaseEntity[];
    transformerInventoryDetailOverrides: BaseEntity[];
    transformerInventoryAttachments: BaseEntity[];
    transformerInventoryCostItems: BaseEntity[];
    inquiries: BaseEntity[];
    inquiryMasterDataCategories: BaseEntity[];
    inquiryMessages: BaseEntity[];
    inquiryResponseDrafts: BaseEntity[];
    inquiryAttachments: BaseEntity[];
    inquiryExternalLinks: BaseEntity[];
    inquiryScopeItems: BaseEntity[];
    workshopTaskTemplates: BaseEntity[];
    workshopCards: BaseEntity[];
    workshopCardTasks: BaseEntity[];
    checklistTemplates: BaseEntity[];
    checklistTemplateGroups: BaseEntity[];
    checklistTemplateItems: BaseEntity[];
    checklistTemplateLinks: BaseEntity[];
    checklistItemActions: BaseEntity[];
    checklistRuns: BaseEntity[];
    checklistRunLinks: BaseEntity[];
    checklistRunItems: BaseEntity[];
    tags: BaseEntity[];
    locations: BaseEntity[];
    locationCustomers: BaseEntity[];
    contactPersons: BaseEntity[];
    customerContactPersons: BaseEntity[];
    locationContactOverrides: BaseEntity[];
    assetContactOverrides: BaseEntity[];
    transferReceipts: BaseEntity[];
    transferReceiptItems: BaseEntity[];
    assetDocuments: BaseEntity[];
    assetHistoryEntries: BaseEntity[];
    selectOptions: BaseEntity[];
    sequences: BaseEntity[];
    settings: BaseEntity[];
  };
}

const ROOT_KEY = 'hwerp';
const INITIAL_SCHEMA_VERSION = 1;

/**
 * LocalStorage implementation of Repository
 */
export class LocalStorageRepo implements Repository {
  constructor() {
    // Ensure storage is initialized on first access
    this.loadRoot();
  }

  /**
   * Load root storage structure from localStorage
   * If not present, create and save initial structure
   */
  private loadRoot(): StorageSchema {
    const raw = localStorage.getItem(ROOT_KEY);

    console.log('🔍 HWERP_LOAD_ROOT - raw exists:', !!raw, 'length:', raw?.length || 0);

    if (!raw) {
      // Initialize with empty structure
      const initialRoot: StorageSchema = {
        schemaVersion: INITIAL_SCHEMA_VERSION,
        meta: {
          nextCalcNumber: 1,
        },
        data: {
          customers: [],
          supplierProductCategories: [],
          supplierCapabilities: [],
          supplierCapabilityTags: [],
          assets: [],
          materials: [],
          services: [],
          servicePackages: [],
          servicePackageItems: [],
          calculations: [],
          calculationDevices: [],
          calculationItems: [],
          calculationLineItems: [], // Häppchen E: Material-Positionen in Kalkulationen
          transformerInventoryCalculationLinks: [],
          transformerInventoryReservations: [],
          transformerInventoryDetailOverrides: [],
          transformerInventoryAttachments: [],
          transformerInventoryCostItems: [],
          inquiries: [],
          inquiryMasterDataCategories: [],
          inquiryMessages: [],
          inquiryResponseDrafts: [],
          inquiryAttachments: [],
          inquiryExternalLinks: [],
          inquiryScopeItems: [],
          workshopTaskTemplates: [],
          workshopCards: [],
          workshopCardTasks: [],
          checklistTemplates: [],
          checklistTemplateGroups: [],
          checklistTemplateItems: [],
          checklistTemplateLinks: [],
          checklistItemActions: [],
          checklistRuns: [],
          checklistRunLinks: [],
          checklistRunItems: [],
          tags: [],
          locations: [],
          locationCustomers: [],
          contactPersons: [],
          customerContactPersons: [],
          locationContactOverrides: [],
          assetContactOverrides: [],
          transferReceipts: [],
          transferReceiptItems: [],
          assetDocuments: [],
          assetHistoryEntries: [],
          selectOptions: [],
          sequences: [],
          settings: [],
        },
      };

      this.saveRoot(initialRoot);
      console.log('✨ HWERP_LOAD_ROOT - created initial root');
      return initialRoot;
    }

    try {
      const parsed = JSON.parse(raw) as StorageSchema;

      // Migration: Add missing fields for backward compatibility
      if (!parsed.data.tags) {
        console.log('🔄 HWERP_MIGRATION - Adding tags field');
        parsed.data.tags = [];
      }
      if (!parsed.data.supplierProductCategories) {
        console.log('🔄 HWERP_MIGRATION - Adding supplier inquiry fields');
        parsed.data.supplierProductCategories = [];
        parsed.data.supplierCapabilities = [];
        parsed.data.supplierCapabilityTags = [];
        this.saveRoot(parsed);
      }
      if (!parsed.data.locations) {
        console.log('🔄 HWERP_MIGRATION - Adding locations fields');
        parsed.data.locations = [];
        parsed.data.locationCustomers = [];
        parsed.data.contactPersons = [];
        parsed.data.customerContactPersons = [];
        parsed.data.locationContactOverrides = [];
        this.saveRoot(parsed);
      }
      if (!parsed.data.assetContactOverrides) {
        console.log('🔄 HWERP_MIGRATION - Adding assetContactOverrides + settings');
        parsed.data.assetContactOverrides = [];
        parsed.data.settings = [];
        this.saveRoot(parsed);
      }
      if (!parsed.data.sequences) {
        console.log('🔄 HWERP_MIGRATION - Adding sequences field');
        parsed.data.sequences = [];
        this.saveRoot(parsed);
      }
      if (!parsed.data.calculationLineItems) {
        console.log('🔄 HWERP_MIGRATION - Adding calculationLineItems field');
        parsed.data.calculationLineItems = [];
        parsed.data.transformerInventoryCalculationLinks = parsed.data.transformerInventoryCalculationLinks ?? [];
        parsed.data.transformerInventoryReservations = parsed.data.transformerInventoryReservations ?? [];
        parsed.data.transformerInventoryDetailOverrides = parsed.data.transformerInventoryDetailOverrides ?? [];
        parsed.data.transformerInventoryAttachments = parsed.data.transformerInventoryAttachments ?? [];
        parsed.data.transformerInventoryCostItems = parsed.data.transformerInventoryCostItems ?? [];
        this.saveRoot(parsed);
      }
      if (!parsed.data.transformerInventoryCalculationLinks) {
        console.log('🔄 HWERP_MIGRATION - Adding transformer inventory overlay fields');
        parsed.data.transformerInventoryCalculationLinks = [];
        parsed.data.transformerInventoryReservations = [];
        parsed.data.transformerInventoryDetailOverrides = [];
        parsed.data.transformerInventoryAttachments = [];
        parsed.data.transformerInventoryCostItems = [];
        this.saveRoot(parsed);
      }
      if (!parsed.data.servicePackages) {
        console.log('🔄 HWERP_MIGRATION - Adding service package fields');
        parsed.data.servicePackages = [];
        parsed.data.servicePackageItems = [];
        this.saveRoot(parsed);
      }
      if (!parsed.data.inquiries) {
        console.log('🔄 HWERP_MIGRATION - Adding inquiry dashboard fields');
        parsed.data.inquiries = [];
        parsed.data.inquiryMasterDataCategories = [];
        parsed.data.inquiryMessages = [];
        parsed.data.inquiryResponseDrafts = [];
        this.saveRoot(parsed);
      }
      if (!parsed.data.inquiryMasterDataCategories) {
        console.log('🔄 HWERP_MIGRATION - Adding inquiry category fields');
        parsed.data.inquiryMasterDataCategories = [];
        this.saveRoot(parsed);
      }
      if (!parsed.data.inquiryAttachments) {
        console.log('🔄 HWERP_MIGRATION - Adding inquiry detail fields');
        parsed.data.inquiryAttachments = [];
        parsed.data.inquiryExternalLinks = [];
        this.saveRoot(parsed);
      }
      if (!parsed.data.inquiryScopeItems) {
        console.log('🔄 HWERP_MIGRATION - Adding inquiry scope items');
        parsed.data.inquiryScopeItems = [];
        this.saveRoot(parsed);
      }
      if (!parsed.data.workshopCards) {
        console.log('🔄 HWERP_MIGRATION - Adding workshop card fields');
        parsed.data.workshopTaskTemplates = [];
        parsed.data.workshopCards = [];
        parsed.data.workshopCardTasks = [];
        this.saveRoot(parsed);
      }
      if (!parsed.data.checklistTemplates) {
        console.log('🔄 HWERP_MIGRATION - Adding checklist fields');
        parsed.data.checklistTemplates = [];
        parsed.data.checklistTemplateGroups = [];
        parsed.data.checklistTemplateItems = [];
        parsed.data.checklistTemplateLinks = [];
        parsed.data.checklistItemActions = [];
        parsed.data.checklistRuns = [];
        parsed.data.checklistRunLinks = [];
        parsed.data.checklistRunItems = [];
        this.saveRoot(parsed);
      }
      if (!parsed.data.transferReceipts) {
        console.log('🔄 HWERP_MIGRATION - Adding transfer receipt fields');
        parsed.data.transferReceipts = [];
        parsed.data.transferReceiptItems = [];
        parsed.data.assetDocuments = [];
        this.saveRoot(parsed);
      }
      if (!parsed.data.assetHistoryEntries) {
        console.log('🔄 HWERP_MIGRATION - Adding asset history entries');
        parsed.data.assetHistoryEntries = [];
        this.saveRoot(parsed);
      }
      if (!parsed.data.selectOptions) {
        console.log('🔄 HWERP_MIGRATION - Adding select options');
        parsed.data.selectOptions = [];
        this.saveRoot(parsed);
      }

      console.log('✅ HWERP_LOAD_ROOT - parsed customers:', parsed.data.customers.length);
      return parsed;
    } catch (error) {
      console.error('❌ HWERP_LOAD_ROOT - JSON parse failed:', error);
      console.error('❌ HWERP_LOAD_ROOT - raw value was:', raw);
      throw new Error('Failed to parse localStorage data. Please check console for details.');
    }
  }

  /**
   * Save root storage structure to localStorage
   */
  private saveRoot(root: StorageSchema): void {
    const json = JSON.stringify(root);
    localStorage.setItem(ROOT_KEY, json);

    // Debug hook
    console.log('HWERP_SAVE_OK', ROOT_KEY, json.length);

    // Verify save
    const verification = localStorage.getItem(ROOT_KEY);
    if (!verification) {
      console.error('[Repository] saveRoot - VERIFICATION FAILED! localStorage.getItem returned null after setItem');
    }
  }

  async list<T extends BaseEntity>(entity: EntityType): Promise<T[]> {
    const root = this.loadRoot();
    return root.data[entity] as T[];
  }

  async get<T extends BaseEntity>(
    entity: EntityType,
    id: string
  ): Promise<T | null> {
    const root = this.loadRoot();
    const item = root.data[entity].find((item) => item.id === id);
    return (item as T) || null;
  }

  async upsert<T extends BaseEntity>(entity: EntityType, obj: T): Promise<T> {
    const root = this.loadRoot();
    const now = new Date().toISOString();

    // Check if entity exists
    const existingIndex = root.data[entity].findIndex(
      (item) => item.id === obj.id
    );

    const updatedObj: T = {
      ...obj,
      updatedAt: now,
      createdAt: existingIndex >= 0 ? root.data[entity][existingIndex].createdAt : now,
    };

    if (existingIndex >= 0) {
      // Update existing
      root.data[entity][existingIndex] = updatedObj;
    } else {
      // Insert new
      root.data[entity].push(updatedObj);
    }

    this.saveRoot(root);

    // Debug hook for customers
    if (entity === 'customers') {
      console.log('HWERP_CUSTOMER_UPSERT_OK', updatedObj.id);
    }

    return updatedObj;
  }

  async create<T extends BaseEntity>(entity: EntityType, obj: T): Promise<T> {
    return this.upsert(entity, obj);
  }

  async update<T extends BaseEntity>(entity: EntityType, _id: string, obj: T): Promise<T> {
    return this.upsert(entity, obj);
  }

  async delete(entity: EntityType, id: string): Promise<void> {
    const root = this.loadRoot();
    root.data[entity] = root.data[entity].filter((item) => item.id !== id);
    this.saveRoot(root);
  }

  async getNextCalcNumber(): Promise<string> {
    const root = this.loadRoot();
    const currentNumber = root.meta.nextCalcNumber;
    root.meta.nextCalcNumber = currentNumber + 1;
    this.saveRoot(root);

    // Format: K-000001
    return `K-${currentNumber.toString().padStart(6, '0')}`;
  }

  async clear(entity: EntityType): Promise<void> {
    // Leert eine spezifische Entity-Collection
    // Wird für selektives Reset verwendet (z.B. nur Stammdaten)
    const root = this.loadRoot();
    root.data[entity] = [];
    this.saveRoot(root);
  }

  async resetAll(): Promise<void> {
    // Kompletter Reset auf Initialzustand
    // Löscht alle Entities UND setzt Metadata zurück (nextCalcNumber)
    // SchemaVersion bleibt erhalten für Kompatibilität
    const root = this.loadRoot();

    root.data = {
      customers: [],
      supplierProductCategories: [],
      supplierCapabilities: [],
      supplierCapabilityTags: [],
      assets: [],
      materials: [],
      services: [],
      servicePackages: [],
      servicePackageItems: [],
      calculations: [],
      calculationDevices: [],
      calculationItems: [],
      calculationLineItems: [], // Häppchen E: Material-Positionen in Kalkulationen
      transformerInventoryCalculationLinks: [],
      transformerInventoryReservations: [],
      transformerInventoryDetailOverrides: [],
      transformerInventoryAttachments: [],
      transformerInventoryCostItems: [],
      inquiries: [],
      inquiryMasterDataCategories: [],
      inquiryMessages: [],
      inquiryResponseDrafts: [],
      inquiryAttachments: [],
      inquiryExternalLinks: [],
      inquiryScopeItems: [],
      workshopTaskTemplates: [],
      workshopCards: [],
      workshopCardTasks: [],
      checklistTemplates: [],
      checklistTemplateGroups: [],
      checklistTemplateItems: [],
      checklistTemplateLinks: [],
      checklistItemActions: [],
      checklistRuns: [],
      checklistRunLinks: [],
      checklistRunItems: [],
      tags: [],
      locations: [],
      locationCustomers: [],
      contactPersons: [],
      customerContactPersons: [],
      locationContactOverrides: [],
      assetContactOverrides: [],
      transferReceipts: [],
      transferReceiptItems: [],
      assetDocuments: [],
      assetHistoryEntries: [],
      selectOptions: [],
      sequences: [],
      settings: [],
    };

    root.meta.nextCalcNumber = 1;

    this.saveRoot(root);
  }
}

/**
 * PostgreSQL implementation of Repository via the Express API
 */
export class PostgresRepo implements Repository {
  private base = '/api/entities';

  async list<T extends BaseEntity>(entity: EntityType): Promise<T[]> {
    const res = await fetch(`${this.base}/${entity}`);
    return res.json();
  }

  async get<T extends BaseEntity>(entity: EntityType, id: string): Promise<T | null> {
    const res = await fetch(`${this.base}/${entity}/${id}`);
    return res.json();
  }

  async upsert<T extends BaseEntity>(entity: EntityType, obj: T): Promise<T> {
    const res = await fetch(`${this.base}/${entity}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(obj),
    });
    return res.json();
  }

  async create<T extends BaseEntity>(entity: EntityType, obj: T): Promise<T> {
    return this.upsert(entity, obj);
  }

  async update<T extends BaseEntity>(entity: EntityType, _id: string, obj: T): Promise<T> {
    return this.upsert(entity, obj);
  }

  async delete(entity: EntityType, id: string): Promise<void> {
    await fetch(`${this.base}/${entity}/${id}`, { method: 'DELETE' });
  }

  async getNextCalcNumber(): Promise<string> {
    const res = await fetch('/api/sequences/next-calc-number', { method: 'POST' });
    const data = await res.json() as { number: string };
    return data.number;
  }

  async clear(entity: EntityType): Promise<void> {
    await fetch(`${this.base}/${entity}`, { method: 'DELETE' });
  }

  async resetAll(): Promise<void> {
    await fetch('/api/reset', { method: 'POST' });
  }
}

/**
 * Repository factory
 */
export function createRepository(driver: 'local' | 'postgres' = 'postgres'): Repository {
  if (driver === 'local') {
    return new LocalStorageRepo();
  }
  if (driver === 'postgres') {
    return new PostgresRepo();
  }
  throw new Error(`Unknown repository driver: ${driver}`);
}
