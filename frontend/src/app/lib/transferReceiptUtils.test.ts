import { describe, expect, it, vi } from 'vitest';
import type { AssetDocument, AssetNode, TransferReceipt, TransferReceiptItem } from './types';
import {
  buildAssetDocumentsForFinalizedReceipt,
  buildNextTransferReceiptNumber,
  buildTransferReceiptItemFromAsset,
} from './transferReceiptUtils';

vi.stubGlobal('crypto', { randomUUID: () => 'generated-id' });

describe('transferReceiptUtils', () => {
  it('builds the next ÜB number from existing receipts', () => {
    expect(buildNextTransferReceiptNumber([])).toBe('ÜB-000001');
    expect(buildNextTransferReceiptNumber([
      { number: 'ÜB-000001' },
      { number: 'not-a-receipt' },
      { number: 'ÜB-000014' },
    ] as TransferReceipt[])).toBe('ÜB-000015');
  });

  it('copies asset data into an editable receipt item snapshot', () => {
    const item = buildTransferReceiptItemFromAsset({
      id: 'asset-1',
      name: 'Trafo HT0001',
      parentId: null,
      customerId: null,
      locationId: null,
      tagIds: [],
      manufacturer: 'Schorch',
      typeModel: '250 kVA Öltrafo',
      powerKva: 250,
      trafoKind: 'oil',
      serialNumber: 'DEMO-SN-RECEIPT-01',
      buildYear: 1962,
      totalWeight: 1130,
      createdAt: 'now',
      updatedAt: 'now',
    } as AssetNode, 'receipt-1', 100, 'now');

    expect(item).toMatchObject({
      receiptId: 'receipt-1',
      assetId: 'asset-1',
      description: 'Trafo HT0001',
      manufacturer: 'Schorch',
      nominalPowerKva: 250,
      insulatingMedium: 'Mineralöl',
      serialNumber: 'DEMO-SN-RECEIPT-01',
      constructionYear: 1962,
      totalWeightKg: 1130,
    });
  });

  it('creates one asset document per linked asset when a receipt is finalized', () => {
    const receipt = {
      id: 'receipt-1',
      number: 'ÜB-000123',
      type: 'used_devices',
      status: 'final',
    } as TransferReceipt;
    const items = [
      { assetId: 'asset-1' },
      { assetId: 'asset-1' },
      { assetId: 'asset-2' },
      { assetId: null },
    ] as TransferReceiptItem[];
    const existing = [{ assetId: 'asset-2', kind: 'transfer_receipt', sourceEntityType: 'transferReceipt', sourceEntityId: 'receipt-1' }] as AssetDocument[];

    const documents = buildAssetDocumentsForFinalizedReceipt(receipt, items, existing, 'now');

    expect(documents).toHaveLength(1);
    expect(documents[0]).toMatchObject({
      assetId: 'asset-1',
      kind: 'transfer_receipt',
      sourceEntityId: 'receipt-1',
      title: 'Übernahmebeleg ÜB-000123',
      status: 'final',
    });
  });
});
