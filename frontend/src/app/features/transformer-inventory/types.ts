import type { BaseEntity } from '../../lib/repository';

export type TransformerInventoryStatus = 'available' | 'reserved' | 'sold' | 'scrapped' | 'unchecked';

export interface TransformerInventoryItem {
  position: string;
  manufacturer: string;
  powerKva: number | null;
  primaryVoltageKv: number | null;
  secondaryVoltageV: number | null;
  vectorGroup: string;
  serialNumber: string;
  constructionYear: number | null;
  constructionType: string;
  weightKg: number | null;
  origin: string;
  connectionType: string;
  note: string;
  soldTo: string;
  invoiceNumber: string;
  exportListed: boolean;
  availableListed: boolean;
  resaleListed: boolean;
  maschinensucherListed: boolean;
  priceNote: string;
}

export interface TransformerInventorySummary {
  total: number;
  available: number;
  reserved: number;
  sold: number;
  scrapped: number;
  unchecked: number;
}

export interface TransformerInventoryCalculationLink extends BaseEntity {
  inventoryPosition: string;
  customerId: string;
  calculationId: string;
  calculatedAt: string;
  note: string | null;
}

export type TransformerInventoryReservationStatus = 'active' | 'released' | 'cancelled';

export interface TransformerInventoryReservation extends BaseEntity {
  inventoryPosition: string;
  customerId: string;
  calculationId: string | null;
  reservedFrom: string;
  reservedUntil: string;
  status: TransformerInventoryReservationStatus;
  note: string | null;
  createdByUserId: string | null;
}

export type TransformerInventoryDetailOverrideFields = Partial<{
  manufacturer: string;
  powerKva: number | null;
  primaryVoltageKv: number | null;
  secondaryVoltageV: number | null;
  vectorGroup: string;
  serialNumber: string;
  constructionYear: number | null;
  constructionType: string;
  weightKg: number | null;
  origin: string;
  connectionType: string;
  note: string;
  priceNote: string;
}>;

export interface TransformerInventoryDetailOverride extends BaseEntity {
  inventoryPosition: string;
  fields: TransformerInventoryDetailOverrideFields;
  updatedByUserId: string | null;
}

export type TransformerInventoryAttachmentType = 'photo' | 'document';

export interface TransformerInventoryAttachment extends BaseEntity {
  inventoryPosition: string;
  type: TransformerInventoryAttachmentType;
  fileName: string;
  mimeType: string | null;
  storageKey: string;
  caption: string | null;
  uploadedByUserId: string | null;
  uploadedAt: string;
}

export type TransformerInventoryCostItemType = 'purchase' | 'service' | 'material' | 'package' | 'manual';

export interface TransformerInventoryCostItem extends BaseEntity {
  inventoryPosition: string;
  assetId: string | null;
  type: TransformerInventoryCostItemType;
  sourceId: string | null;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
  performedAt: string;
  note: string | null;
  sortOrder: number;
}
