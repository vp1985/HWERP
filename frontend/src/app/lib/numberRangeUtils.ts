export type NumberRangeConfig = {
  label: string;
  prefix?: string;
  digits: number;
  nextNumber: number;
  suffix?: string;
};

export type NormalizedNumberRangeConfig = Required<NumberRangeConfig>;
export type EditableNumberRangeConfig = NormalizedNumberRangeConfig & { id: string };

export const NUMBER_RANGES_STORAGE_KEY = 'hwerp.admin.numberRanges';
export const CUSTOMER_NUMBER_RANGE_ID = 'customer-numbers';
export const SUPPLIER_NUMBER_RANGE_ID = 'supplier-numbers';
export const SERVICE_NUMBER_RANGE_ID = 'serviceleistungen';
export const SERVICE_PACKAGE_NUMBER_RANGE_ID = 'leistungspakete';
export const WORKSHOP_CARD_NUMBER_RANGE_ID = 'workshop-cards';
export const TRANSFER_RECEIPT_NUMBER_RANGE_ID = 'transfer-receipts';

export const DEFAULT_NUMBER_RANGES: EditableNumberRangeConfig[] = [
  {
    id: CUSTOMER_NUMBER_RANGE_ID,
    label: 'Kundennummer',
    prefix: 'KD',
    digits: 5,
    nextNumber: 1,
    suffix: '',
  },
  {
    id: SUPPLIER_NUMBER_RANGE_ID,
    label: 'Lieferantennummer',
    prefix: 'LF',
    digits: 5,
    nextNumber: 1,
    suffix: '',
  },
  {
    id: SERVICE_NUMBER_RANGE_ID,
    label: 'Serviceleistungen',
    prefix: 'SL',
    digits: 4,
    nextNumber: 1,
    suffix: '',
  },
  {
    id: SERVICE_PACKAGE_NUMBER_RANGE_ID,
    label: 'Leistungspakete',
    prefix: 'LP',
    digits: 5,
    nextNumber: 1,
    suffix: '',
  },
  {
    id: WORKSHOP_CARD_NUMBER_RANGE_ID,
    label: 'Werkstattkarten',
    prefix: 'WK-',
    digits: 5,
    nextNumber: 1,
    suffix: '',
  },
  {
    id: TRANSFER_RECEIPT_NUMBER_RANGE_ID,
    label: 'Übernahmebelege',
    prefix: 'ÜB-',
    digits: 6,
    nextNumber: 1,
    suffix: '',
  },
];

export function normalizeNumberRangeConfig(config: Partial<NumberRangeConfig>): NormalizedNumberRangeConfig {
  const digits = Number.isFinite(config.digits) ? Math.max(1, Math.floor(config.digits ?? 1)) : 1;
  const nextNumber = Number.isFinite(config.nextNumber)
    ? Math.max(1, Math.floor(config.nextNumber ?? 1))
    : 1;

  return {
    label: config.label?.trim() || 'Nummernkreis',
    prefix: config.prefix ?? '',
    digits,
    nextNumber,
    suffix: config.suffix ?? '',
  };
}

export function normalizeEditableNumberRangeConfig(
  config: Partial<EditableNumberRangeConfig>,
  fallbackId: string,
): EditableNumberRangeConfig {
  return {
    id: config.id?.trim() || fallbackId,
    ...normalizeNumberRangeConfig(config),
  };
}

export function buildNextNumber(config: NumberRangeConfig): string {
  const normalized = normalizeNumberRangeConfig(config);
  return `${normalized.prefix}${String(normalized.nextNumber).padStart(normalized.digits, '0')}${normalized.suffix}`;
}

export function buildNumberRangePreview(config: NumberRangeConfig, count = 5): string[] {
  const normalized = normalizeNumberRangeConfig(config);
  const previewCount = Math.max(1, Math.floor(count));

  return Array.from({ length: previewCount }, (_, index) =>
    buildNextNumber({
      ...normalized,
      nextNumber: normalized.nextNumber + index,
    }),
  );
}

export function mergeDefaultNumberRanges(ranges: EditableNumberRangeConfig[]): EditableNumberRangeConfig[] {
  const merged = [...ranges];

  DEFAULT_NUMBER_RANGES.forEach((defaultRange) => {
    const alreadyConfigured = merged.some(
      (range) =>
        range.id === defaultRange.id ||
        range.label.trim().toLowerCase() === defaultRange.label.trim().toLowerCase(),
    );

    if (!alreadyConfigured) {
      merged.push(defaultRange);
    }
  });

  return merged;
}

export function findNumberRangeByIdOrLabel(
  ranges: EditableNumberRangeConfig[],
  id: string,
  label: string,
): EditableNumberRangeConfig {
  return (
    ranges.find((range) => range.id === id) ??
    ranges.find((range) => range.label.trim().toLowerCase() === label.trim().toLowerCase()) ??
    DEFAULT_NUMBER_RANGES.find((range) => range.id === id) ??
    DEFAULT_NUMBER_RANGES[0]
  );
}

export function reserveNextNumberFromRange(
  ranges: EditableNumberRangeConfig[],
  rangeId: string,
  fallbackLabel = 'Werkstattkarten',
): { number: string; numberRanges: EditableNumberRangeConfig[] } {
  const normalizedRanges = ranges.length > 0 ? ranges : DEFAULT_NUMBER_RANGES;
  const selectedRange = findNumberRangeByIdOrLabel(normalizedRanges, rangeId, fallbackLabel);
  const number = buildNextNumber(selectedRange);
  let updatedSelected = false;

  const numberRanges = normalizedRanges.map((range) => {
    if (range.id !== selectedRange.id) return range;
    updatedSelected = true;
    return { ...range, nextNumber: range.nextNumber + 1 };
  });

  if (!updatedSelected) {
    numberRanges.push({ ...selectedRange, nextNumber: selectedRange.nextNumber + 1 });
  }

  return { number, numberRanges };
}

export function loadNumberRangesFromStorage(storage: Pick<Storage, 'getItem'> = window.localStorage): EditableNumberRangeConfig[] {
  try {
    const rawValue = storage.getItem(NUMBER_RANGES_STORAGE_KEY);
    if (!rawValue) return DEFAULT_NUMBER_RANGES;

    const parsed = JSON.parse(rawValue) as Partial<EditableNumberRangeConfig>[];
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_NUMBER_RANGES;

    return mergeDefaultNumberRanges(
      parsed.map((range, index) => normalizeEditableNumberRangeConfig(range, `number-range-${index + 1}`)),
    );
  } catch {
    return DEFAULT_NUMBER_RANGES;
  }
}

export function saveNumberRangesToStorage(
  ranges: EditableNumberRangeConfig[],
  storage: Pick<Storage, 'setItem'> = window.localStorage,
): void {
  storage.setItem(NUMBER_RANGES_STORAGE_KEY, JSON.stringify(ranges.length > 0 ? ranges : DEFAULT_NUMBER_RANGES));
}
