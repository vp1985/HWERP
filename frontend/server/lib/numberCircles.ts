export interface NumberCircle {
  key: string;
  label: string;
  prefix: string;
  formatTemplate: string;
  padding: number;
  nextValue: number;
  resetYearly: boolean;
  lastYear: number | null;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
  maxUsedNumber?: number | null;
}

export type DefaultNumberCircleSeed = Pick<
  NumberCircle,
  'key' | 'label' | 'prefix' | 'formatTemplate' | 'padding' | 'nextValue' | 'resetYearly' | 'isActive'
>;

export const WORKSHOP_CARD_NUMBER_CIRCLE_KEY = 'workshop_cards';
export const TRANSFER_RECEIPT_NUMBER_CIRCLE_KEY = 'transfer_receipts';
export const INQUIRY_NUMBER_CIRCLE_KEY = 'inquiries';

export const DEFAULT_NUMBER_CIRCLE_SEEDS: DefaultNumberCircleSeed[] = [
  {
    key: 'calculations',
    label: 'Kalkulationen',
    prefix: 'K',
    formatTemplate: '{PREFIX}-{NUMBER}',
    padding: 6,
    nextValue: 1,
    resetYearly: false,
    isActive: true,
  },
  {
    key: 'service_ls',
    label: 'Servicebericht LS',
    prefix: 'LS-{YYYY}',
    formatTemplate: '{PREFIX}-{NUMBER}',
    padding: 6,
    nextValue: 1,
    resetYearly: true,
    isActive: true,
  },
  {
    key: 'service_wb',
    label: 'Wartungsbericht WB',
    prefix: 'WB-{YYYY}',
    formatTemplate: '{PREFIX}-{NUMBER}',
    padding: 6,
    nextValue: 1,
    resetYearly: true,
    isActive: true,
  },
  {
    key: 'service_dguv',
    label: 'DGUV-Prüfung',
    prefix: 'DGUV-{YYYY}',
    formatTemplate: '{PREFIX}-{NUMBER}',
    padding: 6,
    nextValue: 1,
    resetYearly: true,
    isActive: true,
  },
  {
    key: 'customers',
    label: 'Kundennummer',
    prefix: 'KD',
    formatTemplate: '{PREFIX}{NUMBER}',
    padding: 5,
    nextValue: 1,
    resetYearly: false,
    isActive: true,
  },
  {
    key: INQUIRY_NUMBER_CIRCLE_KEY,
    label: 'Anfragen',
    prefix: 'ANF-{YYYY}',
    formatTemplate: '{PREFIX}-{NUMBER}',
    padding: 4,
    nextValue: 1,
    resetYearly: true,
    isActive: true,
  },
  {
    key: WORKSHOP_CARD_NUMBER_CIRCLE_KEY,
    label: 'Werkstattkarten',
    prefix: 'WK',
    formatTemplate: '{PREFIX}-{NUMBER}',
    padding: 5,
    nextValue: 1,
    resetYearly: false,
    isActive: true,
  },
  {
    key: TRANSFER_RECEIPT_NUMBER_CIRCLE_KEY,
    label: 'Übernahmebelege',
    prefix: 'ÜB',
    formatTemplate: '{PREFIX}-{NUMBER}',
    padding: 6,
    nextValue: 1,
    resetYearly: false,
    isActive: true,
  },
];

export interface FormatNumberCircleInput {
  prefix: string;
  formatTemplate: string;
  padding: number;
  value: number;
  date?: Date;
}

export interface YearlyResetInput {
  nextValue: number;
  resetYearly: boolean;
  lastYear: number | null;
  date?: Date;
}

export interface YearlyResetResult {
  nextValue: number;
  lastYear: number;
  didReset: boolean;
}

export interface ParsedNumberCircleValue {
  number: string;
  value: number;
  prefix?: string;
}

const ALLOWED_TOKENS = new Set(['PREFIX', 'NUMBER', 'YYYY']);

function yearFromDate(date: Date): number {
  return date.getFullYear();
}

export function validateNumberCircleConfig(config: {
  key?: string;
  label?: string;
  prefix?: string;
  formatTemplate?: string;
  padding?: number;
  nextValue?: number;
}): string[] {
  const errors: string[] = [];
  const key = config.key?.trim();
  const label = config.label?.trim();
  const prefix = config.prefix ?? '';
  const formatTemplate = config.formatTemplate ?? '';
  const padding = Number(config.padding);
  const nextValue = Number(config.nextValue);

  if (!key) {
    errors.push('Key ist erforderlich.');
  } else if (!/^[a-z][a-z0-9_]*$/.test(key)) {
    errors.push('Key darf nur Kleinbuchstaben, Ziffern und Unterstriche enthalten und muss mit einem Buchstaben beginnen.');
  }

  if (!label) {
    errors.push('Bezeichnung ist erforderlich.');
  }

  if (!formatTemplate.trim()) {
    errors.push('Format-Template ist erforderlich.');
  }

  if (!formatTemplate.includes('{NUMBER}')) {
    errors.push('Format-Template muss {NUMBER} enthalten.');
  }

  const tokenSource = `${prefix} ${formatTemplate}`;
  const tokens = tokenSource.match(/\{[^}]+\}/g) ?? [];
  for (const token of tokens) {
    const tokenName = token.slice(1, -1);
    if (!ALLOWED_TOKENS.has(tokenName)) {
      errors.push(`Unbekannter Platzhalter ${token}. Erlaubt sind {PREFIX}, {NUMBER}, {YYYY}.`);
    }
  }

  if (!Number.isInteger(padding) || padding < 1 || padding > 20) {
    errors.push('Padding muss eine ganze Zahl zwischen 1 und 20 sein.');
  }

  if (!Number.isInteger(nextValue) || nextValue < 1) {
    errors.push('Nächster Wert muss eine ganze Zahl ab 1 sein.');
  }

  return errors;
}

export function applyYearlyReset(input: YearlyResetInput): YearlyResetResult {
  const currentYear = yearFromDate(input.date ?? new Date());
  const didReset = input.resetYearly && input.lastYear !== null && input.lastYear !== currentYear;

  return {
    nextValue: didReset ? 1 : input.nextValue,
    lastYear: currentYear,
    didReset,
  };
}

export function formatNumberCircle(input: FormatNumberCircleInput): string {
  const date = input.date ?? new Date();
  const year = String(yearFromDate(date));
  const validationErrors = validateNumberCircleConfig({
    key: 'preview',
    label: 'Preview',
    prefix: input.prefix,
    formatTemplate: input.formatTemplate,
    padding: input.padding,
    nextValue: input.value,
  });

  if (validationErrors.length > 0) {
    throw new Error(validationErrors.join(' '));
  }

  const number = String(input.value).padStart(input.padding, '0');
  const prefix = input.prefix.replaceAll('{YYYY}', year);

  return input.formatTemplate
    .replaceAll('{YYYY}', year)
    .replaceAll('{PREFIX}', prefix)
    .replaceAll('{NUMBER}', number);
}

export function getPreviewForCircle(
  circle: Pick<NumberCircle, 'prefix' | 'formatTemplate' | 'padding' | 'nextValue'>,
  date = new Date(),
  returnedNumbers: string[] = [],
): string {
  const reusablePreview = findReusableReturnedBlock(returnedNumbers, 1)[0];
  if (reusablePreview) return reusablePreview;

  return formatNumberCircle({
    prefix: circle.prefix,
    formatTemplate: circle.formatTemplate,
    padding: circle.padding,
    value: circle.nextValue,
    date,
  });
}

export function parseTrailingNumber(value: string): number | null {
  const match = value.match(/(\d+)\s*$/);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseNumberCircleValue(
  circle: Pick<NumberCircle, 'prefix' | 'formatTemplate' | 'padding'>,
  number: string,
  date = new Date()
): ParsedNumberCircleValue | null {
  const normalized = number.trim();
  const value = parseTrailingNumber(normalized);
  if (value === null || !Number.isInteger(value) || value < 1) return null;

  try {
    const expected = formatNumberCircle({
      prefix: circle.prefix,
      formatTemplate: circle.formatTemplate,
      padding: circle.padding,
      value,
      date,
    });
    return expected === normalized ? { number: normalized, value } : null;
  } catch {
    return null;
  }
}

export function parseReusableNumberValue(number: string): ParsedNumberCircleValue | null {
  const normalized = number.trim();
  const match = normalized.match(/^(.*?)(\d+)$/);
  if (!match) return null;
  const value = Number(match[2]);
  if (value === null || !Number.isInteger(value) || value < 1) return null;
  return { number: normalized, value, prefix: match[1] };
}

export function findReusableReturnedBlock(
  numbers: string[],
  quantity: number,
): string[] {
  if (!Number.isInteger(quantity) || quantity < 1) return [];

  const parsed = numbers
    .map((number) => parseReusableNumberValue(number))
    .filter((number): number is ParsedNumberCircleValue => number !== null)
    .sort((a, b) => (a.prefix ?? '').localeCompare(b.prefix ?? '') || a.value - b.value);

  for (let index = 0; index < parsed.length; index += 1) {
    const block = [parsed[index]];
    const prefix = parsed[index].prefix ?? '';
    for (let cursor = index + 1; cursor < parsed.length && block.length < quantity; cursor += 1) {
      const previous = block[block.length - 1];
      const current = parsed[cursor];
      if ((current.prefix ?? '') !== prefix) break;
      if (current.value !== previous.value + 1) break;
      block.push(current);
    }
    if (block.length === quantity) return block.map((item) => item.number);
  }

  return [];
}
