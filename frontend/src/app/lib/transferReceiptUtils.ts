import type { AssetDocument, AssetNode, Customer, Location, TransferReceipt, TransferReceiptItem, TransferReceiptType } from './types';

export const TRANSFER_RECEIPT_WASTE_CATEGORY = '16 02 Elektrische und elektronische Geräte und deren Bauteile';
export const TRANSFER_RECEIPT_WASTE_CODE = '16 02 14 Gebrauchte Geräte mit Ausnahme derjenigen, die unter 16 02 09 bis 16 02 13 fallen';

export const TRANSFER_RECEIPT_TYPE_LABELS: Record<TransferReceiptType, string> = {
  used_devices: 'gebrauchte Geräte',
  sf6_switchgear: 'SF6-Schaltanlagen',
  oil_containing_parts: 'ölhaltige Geräte und Teile',
};

export function buildNextTransferReceiptNumber(receipts: Pick<TransferReceipt, 'number'>[]): string {
  const max = receipts.reduce((highest, receipt) => {
    const match = receipt.number?.match(/^ÜB-(\d+)$/);
    if (!match) return highest;
    return Math.max(highest, Number(match[1]));
  }, 0);
  return `ÜB-${String(max + 1).padStart(6, '0')}`;
}

export function formatDateDe(value: string | null | undefined): string {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('de-DE');
}

export function buildAddressSnapshot(customer: Customer | null, location?: Location | null) {
  const cityLine = [customer?.postalCode, customer?.city].filter(Boolean).join(' ');
  const customerAddress = [customer?.streetLine, cityLine, customer?.country].filter(Boolean).join('\n');
  const address = location?.addressLine || customerAddress;
  return {
    name: customer?.name ?? '',
    address,
    locationName: location?.name ?? '',
  };
}

export function buildDefaultDisposerSnapshot() {
  return {
    name: 'HT-VOLTEQ GmbH',
    address: 'Westallee 143, 49661 Cloppenburg',
    locationName: '',
  };
}

export function buildSignedLine(dateIso: string | null | undefined): string {
  return `Valentin Polinski, Cloppenburg den ${formatDateDe(dateIso) || formatDateDe(new Date().toISOString())}`;
}

export function buildTransferReceiptItemFromAsset(
  asset: AssetNode,
  receiptId: string,
  sortOrder: number,
  now: string,
): TransferReceiptItem {
  return {
    id: crypto.randomUUID(),
    receiptId,
    assetId: asset.id,
    sortOrder,
    quantity: 1,
    description: asset.name || 'Verteiltransformator',
    manufacturer: asset.manufacturer ?? '',
    typeModel: asset.typeModel ?? '',
    nominalPowerKva: asset.powerKva ?? null,
    insulatingMedium: asset.trafoKind === 'oil' ? 'Mineralöl' : '',
    serialNumber: asset.serialNumber ?? '',
    constructionYear: asset.buildYear ?? null,
    totalWeightKg: asset.totalWeight ?? null,
    fieldsCount: null,
    freeText: '',
    createdAt: now,
    updatedAt: now,
  };
}

export function buildManualTransferReceiptItem(receiptId: string, sortOrder: number, now: string): TransferReceiptItem {
  return {
    id: crypto.randomUUID(),
    receiptId,
    assetId: null,
    sortOrder,
    quantity: 1,
    description: 'Verteiltransformator',
    manufacturer: '',
    typeModel: '',
    nominalPowerKva: null,
    insulatingMedium: 'Mineralöl',
    serialNumber: '',
    constructionYear: null,
    totalWeightKg: null,
    fieldsCount: null,
    freeText: '',
    createdAt: now,
    updatedAt: now,
  };
}

export function buildAssetDocumentsForFinalizedReceipt(
  receipt: TransferReceipt,
  items: TransferReceiptItem[],
  existingDocuments: AssetDocument[],
  now: string,
): AssetDocument[] {
  if (receipt.status !== 'final') return [];

  const existingKeys = new Set(
    existingDocuments
      .filter((document) => document.kind === 'transfer_receipt' && document.sourceEntityType === 'transferReceipt')
      .map((document) => `${document.assetId}:${document.sourceEntityId}`),
  );

  const assetIds = Array.from(new Set(items.map((item) => item.assetId).filter((assetId): assetId is string => Boolean(assetId))));

  return assetIds
    .filter((assetId) => !existingKeys.has(`${assetId}:${receipt.id}`))
    .map((assetId) => ({
      id: crypto.randomUUID(),
      assetId,
      kind: 'transfer_receipt',
      sourceEntityType: 'transferReceipt',
      sourceEntityId: receipt.id,
      title: `Übernahmebeleg ${receipt.number}`,
      documentNumber: receipt.number,
      status: 'final',
      fileUrl: null,
      metadata: { receiptType: receipt.type },
      createdAt: now,
      updatedAt: now,
    }));
}
