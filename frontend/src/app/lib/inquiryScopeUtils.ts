import type { AssetNode, InquiryScopeItem, Material, Service } from './types';

interface BuildOptions {
  id: string;
  now: string;
  parentId?: string | null;
  inquiryId?: string | null;
}

function baseScopeItem(options: BuildOptions): Pick<InquiryScopeItem, 'id' | 'inquiryId' | 'positionNumber' | 'parentId' | 'quantity' | 'note' | 'createdAt' | 'updatedAt'> {
  return {
    id: options.id,
    inquiryId: options.inquiryId ?? null,
    positionNumber: null,
    parentId: options.parentId ?? null,
    quantity: 1,
    note: null,
    createdAt: options.now,
    updatedAt: options.now,
  };
}

export function buildInquiryScopeAssetSection(asset: AssetNode, options: BuildOptions): InquiryScopeItem {
  return {
    ...baseScopeItem(options),
    kind: 'asset_section',
    assetId: asset.id,
    materialId: null,
    serviceId: null,
    title: asset.name,
    unit: 'Stk',
  };
}

export function buildInquiryScopeMaterialItem(material: Material, options: BuildOptions): InquiryScopeItem {
  return {
    ...baseScopeItem(options),
    kind: 'material',
    assetId: null,
    materialId: material.id,
    serviceId: null,
    title: material.name,
    unit: material.unit,
  };
}

export function buildInquiryScopeServiceItem(service: Service, options: BuildOptions): InquiryScopeItem {
  return {
    ...baseScopeItem(options),
    kind: 'service',
    assetId: null,
    materialId: null,
    serviceId: service.id,
    title: service.name,
    unit: service.unit,
  };
}

export function buildInquiryScopeNoteItem(text: string, options: BuildOptions): InquiryScopeItem {
  return {
    ...baseScopeItem(options),
    kind: 'note',
    assetId: null,
    materialId: null,
    serviceId: null,
    title: text.trim(),
    quantity: 0,
    unit: '',
  };
}

export function assignInquiryScopeNumbers(items: InquiryScopeItem[]): InquiryScopeItem[] {
  const result = items.map((item) => ({ ...item }));

  function assignForParent(parentId: string | null, prefix: string): void {
    const siblings = result.filter((item) => item.parentId === parentId);
    let counter = 0;
    for (const item of siblings) {
      if (item.kind === 'note') {
        item.positionNumber = null;
        continue;
      }
      counter += 1;
      const number = prefix ? `${prefix}.${counter}` : String(counter);
      item.positionNumber = number;
      if (item.kind === 'asset_section') {
        assignForParent(item.id, number);
      }
    }
  }

  assignForParent(null, '');
  return result;
}

export function formatInquiryScopeForOffice(items: InquiryScopeItem[]): string {
  return items
    .map((item) => {
      const prefix = item.positionNumber ? `${item.positionNumber} ` : '';
      const quantity = item.quantity > 0 && item.unit.trim() ? ` — ${item.quantity} ${item.unit}` : '';
      const note = item.note?.trim() ? ` (${item.note.trim()})` : '';
      return `${prefix}${item.title}${quantity}${note}`;
    })
    .join('\n');
}
