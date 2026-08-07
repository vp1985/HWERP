import { BaseEntity } from './repository';

/**
 * Customer entity
 */
export type CustomerRole = 'customer' | 'supplier';

export interface Customer extends BaseEntity {
  name: string;
  customerNumber?: string;
  supplierNumber?: string;
  roles?: CustomerRole[];
  lexofficeContactId?: string;
  lexofficeCustomerNumber?: string;
  lexofficeVendorNumber?: string;
  /** @deprecated legacy read-only compatibility; new data uses structured fields. */
  address?: string;
  streetLine?: string;
  postalCode?: string;
  city?: string;
  country?: string;
  contactName?: string;
  phone?: string;
  email?: string;
  notes?: string;
}

export interface SupplierProductCategory extends BaseEntity {
  name: string;
  parentId: string | null;
  aliases: string[];
  description: string | null;
  active: boolean;
  sortOrder: number;
  archivedAt?: string | null;
}

export type SupplierCapabilityFitLevel = 'sehr_hoch' | 'hoch' | 'passend' | 'moeglich';

export interface SupplierCapabilityTag extends BaseEntity {
  name: string;
  aliases: string[];
  parentCategoryId: string | null;
  active: boolean;
  sortOrder: number;
}

export interface SupplierCapability extends BaseEntity {
  customerId: string;
  categoryId: string;
  capabilityLabel: string;
  productTerms?: string[];
  materials: string[];
  serviceTags: string[];
  fitLevel: SupplierCapabilityFitLevel;
  priorityRank: number;
  notes: string | null;
  active: boolean;
}

/**
 * Location entity
 * Repräsentiert physische Standorte, die Kunden zugeordnet werden können.
 *
 * GPS-Koordinaten: Wir speichern Decimal als Source of Truth (Standard für APIs/Maps).
 * DMS (Grad/Min/Sek) wird als alternative Eingabeform angeboten, aber intern zu Decimal konvertiert.
 */
export interface Location extends BaseEntity {
  name: string;
  addressLine: string | null;
  gpsDecimalLat: number | null; // Decimal Latitude (z.B. 52.5200)
  gpsDecimalLng: number | null; // Decimal Longitude (z.B. 13.4050)
  gpsDmsLat: string | null; // DMS Latitude (z.B. "52° 31' 12\" N")
  gpsDmsLng: string | null; // DMS Longitude (z.B. "13° 24' 18\" E")
  tagIds: string[];
  notes: string | null;
}

/**
 * LocationCustomer Relation
 * Many-to-Many Zuordnung zwischen Standorten und Kunden.
 * Grund: Ein Standort kann mehrere Kunden haben (z.B. Bürogebäude mit mehreren Mietern),
 * und ein Kunde kann mehrere Standorte haben.
 */
export interface LocationCustomer extends BaseEntity {
  locationId: string;
  customerId: string;
}

/**
 * ContactPerson entity (minimal für MVP)
 * Wird in späteren Häppchen vollständig ausgebaut.
 */
export interface ContactPerson extends BaseEntity {
  firstName: string;
  lastName: string;
  role: string | null;
  email: string | null;
  phone1: string | null;
  phone2: string | null;
  phone3: string | null;
  birthday: string | null; // ISO date "YYYY-MM-DD"
  personalNotes: string | null;
  tagIds: string[]; // default []
}

/**
 * CustomerContactPerson Relation
 * Many-to-Many Zuordnung zwischen Kunden und Ansprechpartnern.
 */
export interface CustomerContactPerson extends BaseEntity {
  customerId: string;
  contactPersonId: string;
  isPrimary?: boolean;
}

/**
 * LocationContactOverride Relation
 * Manuelle Überschreibung der geerbten Ansprechpartner für einen Standort.
 *
 * Vererbungslogik:
 * - OHNE Overrides: Standort erbt alle Ansprechpartner der zugeordneten Kunden (customerContactPersons)
 * - MIT Overrides: Nur die hier definierten Ansprechpartner gelten für den Standort
 */
export interface LocationContactOverride extends BaseEntity {
  locationId: string;
  contactPersonId: string;
}

/**
 * AssetNode entity (hierarchical tree structure)
 *
 * Design-Entscheidung: Hierarchie über parentId statt verschachtelter children-Arrays.
 * Grund: Einfacher für CRUD-Operationen, weniger Daten-Denormalisierung.
 *
 * Klassifizierung erfolgt über tagIds statt starrem type-Feld.
 * Vorteil: Flexible Kategorisierung ohne vorgegebene Typen, managed Tags erlauben
 * zentrale Verwaltung und Umbenennung ohne Dateninkonsistenzen.
 */
export type TrafoKind = string;
export type OilSystem = string;
export type WindingCount = string;
export type AssetStockStatus = 'available' | 'reserved' | 'sold' | 'scrapped' | 'unchecked';

export interface AssetNode extends BaseEntity {
  name: string;
  parentId: string | null; // null = Root-Level Asset
  customerId: string | null; // Direktzuordnung zu einem Kunden
  locationId: string | null; // Optional: Direktverweis auf Standort (Vererbungsquelle für Ansprechpartner)
  tagIds: string[]; // Flexible Labels/Filter; fachliche Tabs kommen künftig über Assettyp/Datenmodule.
  assetTypeId?: string | null; // Referenz auf AssetType (Hauptkategorie/Stammdaten)
  notes?: string;

  // Zusätzliche Asset-Eigenschaften
  customerAssetId?: string; // Asset-Nummer/Bezeichnung beim Kunden
  internalAssetId?: string; // Unsere interne Nummer als Dienstleister
  buildYear?: number; // Baujahr des Assets
  totalWeight?: number; // Gesamtgewicht in kg
  manufacturer?: string; // Hersteller
  serialNumber?: string; // Seriennummer vom Hersteller
  typeModel?: string; // Typ/Model-Bezeichnung des Herstellers
  powerKva?: number; // Leistung in kVA (spezifisch für Trafos)

  // Strukturierte Trafo-Fachdaten: such-/filter-/sortierbar, keine normalen Tags.
  trafoKind?: TrafoKind; // Bauart: Öltransformator, Gießharztransformator, sonstige
  oilSystem?: OilSystem; // nur bei Öltrafo: Hermetisch, Ausdehner, sonstige
  windingCount?: WindingCount; // Standard: 2W; 3W explizit für mehrere Niederspannungen
  secondaryVoltage1?: string;
  secondaryVoltage2?: string;
  secondaryVoltage3?: string;

  // Trafo-Lager-/Fremdlager-spezifische Asset-Fachdaten, damit manuell angelegte Trafos
  // direkt als Asset gespeichert und später Kunden/Standorten zugeordnet werden können.
  inventoryOwnerType?: 'own' | 'external';
  inventoryOrigin?: string;
  forSale?: boolean;
  stockStatus?: AssetStockStatus;
  primaryVoltageKv?: number;
  secondaryVoltageV?: number;
  vectorGroup?: string;
  constructionType?: string;
  connectionType?: string;
  priceNote?: string;
}

/**
 * AssetContactOverride Relation
 * Manuelle Überschreibung der geerbten Ansprechpartner für ein Asset.
 *
 * Vererbungslogik:
 * - OHNE Overrides: Asset erbt Ansprechpartner über locationId, sonst parentId
 * - MIT Overrides: Nur die hier definierten Ansprechpartner gelten für das Asset
 */
export interface AssetContactOverride extends BaseEntity {
  assetId: string;
  contactPersonId: string;
}

export type TransferReceiptType = 'used_devices' | 'sf6_switchgear' | 'oil_containing_parts';
export type TransferReceiptStatus = 'draft' | 'final';

export interface TransferReceiptAddressSnapshot {
  name: string;
  address: string;
  locationName?: string;
}

export interface TransferReceipt extends BaseEntity {
  number: string;
  type: TransferReceiptType;
  status: TransferReceiptStatus;
  customerId: string | null;
  locationId: string | null;
  serviceDate: string;
  ownReference: string;
  customerReference: string;
  wasteCategory: string;
  wasteCode: string;
  signedBy: string;
  signedPlace: string;
  signedDate: string;
  producerSnapshot: TransferReceiptAddressSnapshot | null;
  disposerSnapshot: TransferReceiptAddressSnapshot | null;
  finalizedAt: string | null;
  notes: string | null;
}

export interface TransferReceiptItem extends BaseEntity {
  receiptId: string;
  assetId: string | null;
  sortOrder: number;
  quantity: number;
  description: string;
  manufacturer: string;
  typeModel: string;
  nominalPowerKva: number | null;
  insulatingMedium: string;
  serialNumber: string;
  constructionYear: number | null;
  totalWeightKg: number | null;
  fieldsCount: number | null;
  freeText: string;
}

export type AssetDocumentKind = string;
export type AssetDocumentStatus = 'draft' | 'final' | 'uploaded';

export interface AssetDocument extends BaseEntity {
  assetId: string;
  kind: AssetDocumentKind;
  sourceEntityType: string | null;
  sourceEntityId: string | null;
  title: string;
  documentNumber: string | null;
  status: AssetDocumentStatus;
  fileUrl: string | null;
  metadata: Record<string, unknown>;
}

export type AssetHistoryEventType = 'assignment' | 'document' | 'maintenance';

export interface AssetHistoryEntry extends BaseEntity {
  assetId: string;
  eventType: AssetHistoryEventType;
  occurredAt: string;
  userName: string | null;
  title: string;
  description: string | null;
  metadata: Record<string, unknown>;
}

/**
 * AppSettings entity
 * Zentrale Anwendungs-Einstellungen mit fester ID "app".
 * Single-Row-Tabelle Semantik: Es existiert nur genau 1 Settings-Objekt.
 */
export interface AppSettings extends BaseEntity {
  id: 'app'; // fixed ID
  inheritanceAskOnCustomerContactChange: boolean; // default true
}

export type InquiryStatus =
  | 'new'
  | 'triage'
  | 'waiting_for_customer'
  | 'ready_for_calculation'
  | 'calculation_draft'
  | 'offer_draft'
  | 'sent'
  | 'done'
  | 'won'
  | 'lost'
  | 'archived';

export type InquiryPriority = 'low' | 'normal' | 'high' | 'urgent';

export type InquirySource = 'email' | 'telegram' | 'whatsapp' | 'web' | 'manual';
export type InquiryDecision = 'yes' | 'no' | 'unknown';

/**
 * Inquiry entity
 * Zentrale Anfragekarte für Mail-/Quellen-Inbox und spätere Angebotsvorbereitung.
 */
export interface Inquiry extends BaseEntity {
  title: string;
  inquiryNumber?: string | null;
  status: InquiryStatus;
  priority: InquiryPriority;
  source: InquirySource;
  sourceMessageId: string | null;
  categoryId?: string | null;
  senderName: string | null;
  senderEmail: string | null;
  senderPhone: string | null;
  customerId: string | null;
  customerContactPersonId?: string | null;
  siteCustomerId?: string | null;
  locationId: string | null;
  assetId: string | null;
  responsibleCustomerId?: string | null;
  responsibleContactPersonId?: string | null;
  commissionRelevant?: boolean;
  switchingActionRequired?: InquiryDecision | null;
  switchingActionByCustomer?: InquiryDecision | null;
  switchingActionContactPersonId?: string | null;
  executionPossibleWeekdays?: boolean;
  executionPossibleFridayAfternoon?: boolean;
  executionPossibleSaturday?: boolean;
  executionPossibleSunday?: boolean;
  executionPossibleAfterHours?: boolean;
  executionPossiblePlannedShutdownOnly?: boolean;
  executionInfo?: string | null;
  relatedCalculationId: string | null;
  assigneeUserId: string | null;
  assignedByUserId: string | null;
  assignedAt: string | null;
  createdByUserId: string | null;
  summary: string | null;
  rawText: string | null;
  receivedAt: string;
  lastActionAt: string | null;
  nextAction: string | null;
  needsAttention: boolean;
}

export type InquiryUserRole = 'employee' | 'dispatcher' | 'admin';

export interface InquiryUser extends BaseEntity {
  name: string;
  email: string | null;
  active: boolean;
  role: InquiryUserRole;
  canViewAllInquiries: boolean;
  canAssignInquiries: boolean;
}

export type InquiryMessageDirection = 'inbound' | 'outbound' | 'draft';

export interface InquiryMessage extends BaseEntity {
  inquiryId: string;
  source: InquirySource;
  direction: InquiryMessageDirection;
  subject: string | null;
  body: string;
  senderName: string | null;
  senderEmail: string | null;
  sourceMessageId: string | null;
  threadId: string | null;
  attachmentIds: string[];
  receivedAt: string | null;
}

export type InquiryResponseDraftKind =
  | 'clarification'
  | 'acknowledgement'
  | 'offer_intro'
  | 'rejection'
  | 'follow_up';

export type InquiryResponseDraftStatus = 'draft' | 'approved' | 'sent' | 'discarded';

export interface InquiryResponseDraft extends BaseEntity {
  inquiryId: string;
  kind: InquiryResponseDraftKind;
  subject: string;
  body: string;
  status: InquiryResponseDraftStatus;
}

export type InquiryScopeItemKind = 'asset_section' | 'material' | 'service' | 'note';

/**
 * Preisfreie fachliche Anfrage-Position für die Vorkonfiguration.
 * Referenziert HWERP-Stammdaten, speichert aber nur Umfang, Mengen, Einheiten und Hinweise.
 */
export interface InquiryScopeItem extends BaseEntity {
  inquiryId: string | null;
  positionNumber: string | null;
  parentId: string | null;
  kind: InquiryScopeItemKind;
  assetId: string | null;
  materialId: string | null;
  serviceId: string | null;
  title: string;
  quantity: number;
  unit: string;
  note: string | null;
}

export type InquiryStorageProvider = 'local' | 'sharepoint' | 'onedrive' | 'external';

export interface InquiryAttachment extends BaseEntity {
  inquiryId: string;
  messageId: string | null;
  source: InquirySource;
  fileName: string;
  mimeType: string | null;
  fileSize: number | null;
  storageProvider: InquiryStorageProvider;
  storageUrl: string;
  thumbnailUrl: string | null;
  uploadedByUserId: string | null;
}

export type InquiryExternalLinkKind =
  | 'hwerp_customer'
  | 'hwerp_asset'
  | 'hwerp_calculation'
  | 'hwerp_offer'
  | 'lexoffice_customer'
  | 'lexoffice_offer'
  | 'sharepoint_folder'
  | 'other';

export interface InquiryExternalLink extends BaseEntity {
  inquiryId: string;
  kind: InquiryExternalLinkKind;
  label: string;
  url: string | null;
  targetId: string | null;
  createdByUserId: string | null;
}

export type WorkshopCardStatus = 'draft' | 'prepared' | 'in_progress' | 'done' | 'checked' | 'archived';
export type WorkshopCardTaskStatus = 'open' | 'blocked' | 'done';

export interface WorkshopTaskTemplate extends BaseEntity {
  name: string;
  category: string;
  sortOrder: number;
  required: boolean;
  photoRequired: boolean;
  protocolRequired: boolean;
  measurementsRequired: boolean;
  materialEntryEnabled: boolean;
  active: boolean;
}

export interface WorkshopCard extends BaseEntity {
  cardNumber: string;
  title: string;
  orderNumber: string;
  assetId: string | null;
  customerId: string | null;
  status: WorkshopCardStatus;
  assigneeCodes: string[];
  qrCodeToken: string;
  notes: string | null;
}

export interface WorkshopCardTask extends BaseEntity {
  cardId: string;
  templateId: string | null;
  serviceId: string | null;
  title: string;
  sortOrder: number;
  status: WorkshopCardTaskStatus;
  required: boolean;
  photoRequired: boolean;
  protocolRequired: boolean;
  blockedByTaskId: string | null;
  blockedReason: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  employeeCode: string | null;
  signatureName: string | null;
  notes: string | null;
  measurementSummary: string | null;
  materialSummary: string | null;
  completedAt: string | null;
}

export type ChecklistTemplateStatus = 'active' | 'archived';
export type ChecklistTemplateType = 'trafo_workshop_card' | 'order_preparation' | 'packing_list' | 'calculation' | 'general';
export type ChecklistNoteMode = 'none' | 'optional' | 'required';
export type ChecklistMeasurementMode = 'none' | 'optional' | 'required';
export type ChecklistRunStatus = 'open' | 'in_progress' | 'done' | 'checked' | 'archived';
export type ChecklistRunItemStatus = 'open' | 'done' | 'not_applicable' | 'needs_clarification' | 'blocked';
export type ChecklistResponseType = 'check' | 'yes_no' | 'multiple_choice';
export type ChecklistTargetType = 'order' | 'workshop_card' | 'asset' | 'customer' | 'inquiry' | 'calculation' | 'service' | 'service_package' | 'free';
export type ChecklistLinkSourceType = 'service' | 'material' | 'service_package' | 'asset_type' | 'asset' | 'customer' | 'order_type' | 'workshop_card_type' | 'free';
export type ChecklistUsageContext = 'calculation' | 'offer' | 'order' | 'order_preparation' | 'packing_list' | 'workshop_card' | 'billing' | 'service_masterdata';
export type ChecklistTriggerMode = 'suggest' | 'auto_create' | 'required' | 'manual';
export type ChecklistItemActionType =
  | 'suggest_service'
  | 'suggest_material'
  | 'suggest_checklist'
  | 'create_task'
  | 'create_packing_item'
  | 'add_billing_note';
export type ChecklistItemActionConditionOperator = 'equals' | 'not_equals' | 'contains' | 'exists';

export interface ChecklistTemplate extends BaseEntity {
  name: string;
  description: string | null;
  templateType: ChecklistTemplateType;
  status: ChecklistTemplateStatus;
  visibilityGroupKeys: string[];
  verificationRequired: boolean;
  autoApplyRules: Record<string, unknown>;
  createdBy: string | null;
  updatedBy: string | null;
}

export interface ChecklistTemplateGroup extends BaseEntity {
  templateId: string;
  title: string;
  sortOrder: number;
  visibilityGroupKeys: string[];
}

export interface ChecklistTemplateItem extends BaseEntity {
  templateId: string;
  groupId: string | null;
  title: string;
  description: string | null;
  sortOrder: number;
  required: boolean;
  quantity: number | null;
  unit: string | null;
  photoRequired: boolean;
  documentRequired: boolean;
  noteMode: ChecklistNoteMode;
  measurementMode: ChecklistMeasurementMode;
  employeeCodeRequired: boolean;
  signatureRequired: boolean;
  timeRequired: boolean;
  materialEntryEnabled: boolean;
  responseType: ChecklistResponseType;
  choiceOptions: string[];
  visibilityGroupKeys: string[];
  dependsOnItemIds: string[];
}

export interface ChecklistTemplateLink extends BaseEntity {
  templateId: string;
  sourceType: ChecklistLinkSourceType;
  sourceId: string | null;
  contexts: ChecklistUsageContext[];
  triggerMode: ChecklistTriggerMode;
  active: boolean;
  sortOrder: number;
}

export interface ChecklistItemAction extends BaseEntity {
  templateItemId: string;
  conditionOperator: ChecklistItemActionConditionOperator;
  conditionValue: string | null;
  actionType: ChecklistItemActionType;
  targetType: ChecklistLinkSourceType | ChecklistTargetType;
  targetId: string | null;
  targetContext: ChecklistUsageContext;
  triggerMode: ChecklistTriggerMode;
  payload: Record<string, unknown>;
  active: boolean;
  sortOrder: number;
}

export interface ResolvedChecklistItemAction {
  action: ChecklistItemAction;
  reason: string;
}

export interface ChecklistRun extends BaseEntity {
  templateId: string | null;
  templateSnapshot: Record<string, unknown>;
  title: string;
  runType: ChecklistTemplateType;
  status: ChecklistRunStatus;
  verificationRequired: boolean;
  verifiedBy: string | null;
  verifiedAt: string | null;
  qrCodeToken: string;
  createdBy: string | null;
}

export interface ChecklistRunLink extends BaseEntity {
  runId: string;
  targetType: ChecklistTargetType;
  targetId: string | null;
}

export interface ChecklistRunItem extends BaseEntity {
  runId: string;
  templateItemId: string | null;
  groupTitleSnapshot: string | null;
  title: string;
  description: string | null;
  sortOrder: number;
  required: boolean;
  status: ChecklistRunItemStatus;
  quantity: number | null;
  unit: string | null;
  note: string | null;
  measurementValue: string | null;
  employeeCode: string | null;
  signatureName: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  completedAt: string | null;
  completedBy: string | null;
  blockedReason: string | null;
  responseType: ChecklistResponseType;
  choiceOptions: string[];
  selectedChoice: string | null;
  dependsOnTemplateItemIds: string[];
}

export interface InquiryMasterDataCategory extends BaseEntity {
  name: string;
  description: string | null;
  active: boolean;
  sortOrder: number;
  checklistTemplateIds: string[];
}

export type InquiryChecklistRequiredRole = 'employee' | 'dispatcher' | 'office';

export interface InquiryChecklistTemplate extends BaseEntity {
  categoryId: string;
  name: string;
  triggerKeywords: string[];
  appliesToSources: InquirySource[];
  requiredRole: InquiryChecklistRequiredRole;
  active: boolean;
  version: number;
}

export type InquiryChecklistItemKind =
  | 'required_info'
  | 'document'
  | 'photo'
  | 'technical_data'
  | 'customer_question'
  | 'internal_check'
  | 'office_handover';

export interface InquiryChecklistItem extends BaseEntity {
  templateId: string;
  label: string;
  description: string | null;
  kind: InquiryChecklistItemKind;
  required: boolean;
  aiCanComplete: boolean;
  evidenceHint: string | null;
  sortOrder: number;
}

export type InquiryChecklistRunStatus = 'open' | 'in_progress' | 'blocked' | 'completed' | 'discarded';
export type InquiryChecklistSelectedBy = 'ai' | 'user';

export interface InquiryChecklistRun extends BaseEntity {
  inquiryId: string;
  templateId: string;
  status: InquiryChecklistRunStatus;
  selectedBy: InquiryChecklistSelectedBy;
  completedAt: string | null;
}

export type InquiryChecklistRunItemStatus = 'open' | 'suggested_done' | 'done' | 'not_applicable' | 'needs_clarification';
export type InquiryChecklistEvidenceSource = 'mail' | 'attachment' | 'master_data' | 'manual' | 'ai_suggestion';

export interface InquiryChecklistRunItem extends BaseEntity {
  checklistRunId: string;
  templateItemId: string;
  status: InquiryChecklistRunItemStatus;
  evidenceText: string | null;
  evidenceSource: InquiryChecklistEvidenceSource | null;
  completedByUserId: string | null;
  completedByAiReviewId: string | null;
}

/**
 * Calculation entity
 * Repräsentiert eine Kalkulation im MVP – nur Entwurf-Status.
 * Positionen (LineItems) kommen in Häppchen E.
 *
 * customer/location/asset optional, weil Kalkulation auch ohne Zuordnung möglich sein muss.
 * Nummer wird erst beim ersten Speichern vergeben (nicht beim Öffnen),
 * damit keine Lücken durch abgebrochene Drafts entstehen.
 */
export interface Calculation extends BaseEntity {
  number: string;              // Format K-000001 – automatisch, unveränderlich nach Erstellung
  title: string | null;
  description: string | null;
  customerId: string | null;   // optional, Zuordnung zu Kunde
  locationId: string | null;   // optional, Zuordnung zu Standort
  assetId: string | null;      // optional, Zuordnung zu Asset
  status: 'DRAFT';             // MVP nur Draft
}

/**
 * Sequence entity for generating sequential numbers
 * Entity-Key: "sequences"
 */
export interface Sequence extends BaseEntity {
  nextValue: number;
}

/**
 * Material entity
 * Repräsentiert Artikel/Materialien für Kalkulationen.
 * MVP: Einfache Materialliste mit Preisen.
 */
export interface Material extends BaseEntity {
  articleNumber: string;        // Artikelnummer (z.B. "MAT-001")
  name: string;                 // Bezeichnung
  description: string | null;   // Beschreibung
  unit: string;                 // Einheit (Stk, m, kg, L, etc.)
  price: number;                // Preis pro Einheit (netto)
  supplier: string | null;      // Lieferant
  category: string | null;      // Kategorie (z.B. "Elektro", "Schrauben")
}

/**
 * Service entity
 * Repräsentiert Dienstleistungen für Kalkulationen.
 * MVP: Einfache Serviceliste mit Stundensätzen oder Pauschalen.
 */
export interface Service extends BaseEntity {
  serviceNumber: string;       // Servicenummer (z.B. "SL0001") – eindeutig, unveränderlich nach Anlage
  name: string;                // Bezeichnung (z.B. "Montage Schaltschrank")
  description: string | null;  // Optionale Beschreibung
  unit: string;                // Einheit (Std, Pauschal, Tag, Woche, Monat)
  price: number;               // Preis pro Einheit (netto, in €)
  category: string | null;     // Kategorie (z.B. "Montage", "Wartung", "Trafo-Standsätze")
  active: boolean;             // Stammdaten-Aktivierung: nur aktive Leistungen sind auswählbar
  availableInWorkshopCards: boolean; // steuert Verfügbarkeit in Trafo-Werkstattkarten
  workshopCategory: string | null;   // optionale Werkstattkarten-Kategorie, z.B. "Trafo-Standsätze"
  workshopRequired: boolean;
  workshopPhotoRequired: boolean;
  workshopProtocolRequired: boolean;
  workshopMeasurementsRequired: boolean;
  workshopMaterialEntryEnabled: boolean;
  sortOrder: number;
  checklistTemplateIds: string[];
}

export type ServicePackagePriceMode = 'sum' | 'fixed';
export type ServicePackageItemType = 'service' | 'material' | 'info';

/**
 * ServicePackage entity
 * Gruppiert Leistungen, Material und Hinweiszeilen zu wiederverwendbaren Paketen.
 */
export interface ServicePackage extends BaseEntity {
  packageNumber: string;       // Paketnummer (z.B. "LP00001")
  name: string;
  description: string | null;
  category: string | null;
  active: boolean;
  priceMode: ServicePackagePriceMode;
  fixedPrice: number | null;
  hintText: string | null;     // interner / Werkstatt-Hinweis
  customerNote: string | null; // Angebots-/Auftragstext für Kunden
  checklistTemplateIds: string[];
}

/**
 * ServicePackageItem entity
 * Eine Paketposition ist entweder Service, Material oder freier Hinweistext.
 */
export interface ServicePackageItem extends BaseEntity {
  packageId: string;
  type: ServicePackageItemType;
  serviceId: string | null;
  materialId: string | null;
  descriptionSnapshot: string;
  quantity: number;
  unitSnapshot: string;
  unitPriceSnapshot: number;
  sortOrder: number;
}

/**
 * CalculationLineItem entity (Häppchen E)
 * Repräsentiert eine Position in einer Kalkulation.
 * Kann Material oder Service referenzieren (MVP: nur Material).
 */
export interface CalculationLineItem extends BaseEntity {
  calculationId: string;        // Referenz auf Calculation
  positionNumber: string | null; // Positions-Nummer ("1", "1.1", "2"...) – null für info-Zeilen
  assetHeaderId: string | null; // Explizite Parent-Referenz (null = Root-Level)
  type: 'material' | 'service' | 'asset_header' | 'info'; // Typ der Position
  materialId: string | null;    // Referenz auf Material (wenn type='material')
  serviceId: string | null;     // Referenz auf Service (wenn type='service')
  assetNodeId?: string | null;  // Referenz auf Asset (wenn type='asset_header')
  inventoryPosition?: string | null; // Stabile Lagerreferenz für Lagertrafos (z.B. own:HT0001)
  description: string;          // Beschreibungstext (aus Material/Service/Asset kopiert, editierbar)
  quantity: number;             // Menge (0 bei asset_header/info ohne Preis)
  unit: string;                 // Einheit
  unitPrice: number;            // Einzelpreis (0 bei asset_header ohne Kauf/Verkauf)
  totalPrice: number;           // Gesamtpreis (quantity * unitPrice, berechnet)
  travelRole?: 'inbound' | 'outbound' | null; // Rolle in einem Fahrtblock
  isAutoGenerated?: boolean;    // Automatisch erzeugte Zeile (z.B. Fahrtblock)
  relatedAssetId?: string | null; // Referenz auf AssetNode (für Fahrtblock-Zuordnung)
}
