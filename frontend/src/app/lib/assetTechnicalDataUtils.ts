import type { AssetNode, Customer, TrafoKind, OilSystem, WindingCount } from './types';
import type { Tag } from '../types/tag';
import type { AssetType } from './assetTypeStorage';
import { getSelectOptionLabel, optionMetadataFlag, type SelectOption } from './selectOptions';

export const TRAFO_KIND_LABELS: Record<string, string> = {
  oil: 'Öltransformator',
  cast_resin: 'Gießharztransformator',
  other: 'sonstige Bauart',
};

export const OIL_SYSTEM_LABELS: Record<string, string> = {
  hermetic: 'Hermetisch',
  conservator: 'Ausdehner',
  other: 'sonstiges Ölsystem',
};

export const WINDING_COUNT_LABELS: Record<string, string> = {
  '2w': '2W',
  '3w': '3W',
  other: 'sonstige Wicklungen',
};

export function isTransformerAssetType(assetType: AssetType | null | undefined): boolean {
  if (!assetType) return false;
  const code = assetType.code.toLowerCase();
  const label = assetType.label.toLowerCase();
  return code === 'trafo' || code.startsWith('trafo_') || label.includes('transformator');
}

export function shouldShowOilSystemFields(asset: Pick<AssetNode, 'trafoKind'>, selectOptions: SelectOption[] = []): boolean {
  return asset.trafoKind === 'oil' || optionMetadataFlag(selectOptions, 'asset.trafoKind', asset.trafoKind, 'showOilSystem');
}

export function shouldShowThreeWindingFields(asset: Pick<AssetNode, 'windingCount'>, selectOptions: SelectOption[] = []): boolean {
  return asset.windingCount === '3w' || optionMetadataFlag(selectOptions, 'asset.windingCount', asset.windingCount, 'showSecondaryVoltages');
}

function maybeTrim(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function formatTransformerProperties(asset: Partial<AssetNode>, selectOptions: SelectOption[] = []): string[] {
  const labels: string[] = [];

  if (asset.trafoKind) {
    labels.push(getSelectOptionLabel(selectOptions, 'asset.trafoKind', asset.trafoKind) || TRAFO_KIND_LABELS[asset.trafoKind] || asset.trafoKind);
  }

  if (shouldShowOilSystemFields(asset, selectOptions) && asset.oilSystem) {
    labels.push(getSelectOptionLabel(selectOptions, 'asset.oilSystem', asset.oilSystem) || OIL_SYSTEM_LABELS[asset.oilSystem] || asset.oilSystem);
  }

  if (asset.windingCount) {
    labels.push(WINDING_COUNT_LABELS[asset.windingCount] || getSelectOptionLabel(selectOptions, 'asset.windingCount', asset.windingCount) || asset.windingCount);
  }

  const secondaryVoltages = [asset.secondaryVoltage1, asset.secondaryVoltage2, asset.secondaryVoltage3];
  secondaryVoltages.forEach((value, index) => {
    const trimmed = maybeTrim(value);
    if (trimmed) labels.push(`NS${index + 1} ${trimmed}`);
  });

  return labels;
}

export function buildAssetSearchText(
  asset: AssetNode,
  allTags: Tag[],
  customer?: Customer | null,
  assetType?: AssetType | null,
  selectOptions: SelectOption[] = [],
): string {
  const tagTerms = allTags
    .filter((tag) => asset.tagIds?.includes(tag.id))
    .flatMap((tag) => [tag.name, tag.code || '']);

  const terms = [
    asset.name,
    customer?.name || '',
    customer?.customerNumber || '',
    customer?.supplierNumber || '',
    assetType?.label || '',
    assetType?.code || '',
    asset.customerAssetId || '',
    asset.internalAssetId || '',
    asset.manufacturer || '',
    asset.serialNumber || '',
    asset.typeModel || '',
    asset.powerKva ? `${asset.powerKva} kva` : '',
    ...tagTerms,
    ...formatTransformerProperties(asset, selectOptions),
  ];

  return terms.filter(Boolean).join(' ').toLowerCase();
}
