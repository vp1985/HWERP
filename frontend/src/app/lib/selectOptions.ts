import type { BaseEntity } from './repository';

export type SelectOptionListKey =
  | 'asset.trafoKind'
  | 'asset.oilSystem'
  | 'asset.windingCount'
  | 'assetDocument.kind'
  | 'inquiry.status'
  | 'inquiry.category';

export interface SelectOptionMetadata {
  showOilSystem?: boolean;
  showSecondaryVoltages?: boolean;
  reservedForSystem?: boolean;
  [key: string]: unknown;
}

export interface SelectOption extends BaseEntity {
  listKey: SelectOptionListKey | string;
  value: string;
  label: string;
  sortOrder: number;
  isActive: boolean;
  isSystem: boolean;
  metadata?: SelectOptionMetadata;
}

export interface SelectOptionListDefinition {
  key: SelectOptionListKey;
  category: string;
  label: string;
  description: string;
  metadataFields?: Array<{
    key: keyof SelectOptionMetadata;
    label: string;
    helpText: string;
  }>;
}

type SelectOptionSeed = Omit<SelectOption, 'id' | 'createdAt' | 'updatedAt'>;

export const SELECT_OPTION_LIST_DEFINITIONS: SelectOptionListDefinition[] = [
  {
    key: 'asset.trafoKind',
    category: 'Trafo-Daten',
    label: 'Bauart',
    description: 'Dropdown im Asset-Tab „Trafo-Daten“ für Öltrafo, Gießharztrafo usw.',
    metadataFields: [
      {
        key: 'showOilSystem',
        label: 'Ölsystem anzeigen',
        helpText: 'Blendet bei dieser Bauart zusätzlich das Dropdown „Ölsystem“ ein.',
      },
    ],
  },
  {
    key: 'asset.oilSystem',
    category: 'Trafo-Daten',
    label: 'Ölsystem',
    description: 'Dropdown für Öltrafos, z. B. hermetisch oder Ausdehner.',
  },
  {
    key: 'asset.windingCount',
    category: 'Trafo-Daten',
    label: 'Wicklungen',
    description: 'Dropdown für Zweiwickler, Dreiwickler und Sonderfälle.',
    metadataFields: [
      {
        key: 'showSecondaryVoltages',
        label: 'NS-Felder anzeigen',
        helpText: 'Blendet NS1/NS2/NS3 ein, z. B. bei Dreiwicklern.',
      },
    ],
  },
  {
    key: 'assetDocument.kind',
    category: 'Dokumente',
    label: 'Dokumentart',
    description: 'Dropdown beim Hochladen von Asset-Dokumenten.',
  },
  {
    key: 'inquiry.status',
    category: 'Anfragen',
    label: 'Anfragestatus',
    description: 'Status-Dropdown im Anfrage-Bearbeiten-Modal.',
  },
  {
    key: 'inquiry.category',
    category: 'Anfragen',
    label: 'Anfragekategorie',
    description: 'Kategorie-Dropdown im Anfrage-Bearbeiten-Modal.',
  },
];

export const DEFAULT_SELECT_OPTIONS: SelectOptionSeed[] = [
  { listKey: 'asset.trafoKind', value: 'oil', label: 'Öltransformator', sortOrder: 10, isActive: true, isSystem: true, metadata: { showOilSystem: true } },
  { listKey: 'asset.trafoKind', value: 'cast_resin', label: 'Gießharztransformator', sortOrder: 20, isActive: true, isSystem: true, metadata: { showOilSystem: false } },
  { listKey: 'asset.trafoKind', value: 'other', label: 'Sonstige Bauart', sortOrder: 30, isActive: true, isSystem: true, metadata: { showOilSystem: false } },

  { listKey: 'asset.oilSystem', value: 'hermetic', label: 'Hermetisch verriegelt', sortOrder: 10, isActive: true, isSystem: true },
  { listKey: 'asset.oilSystem', value: 'conservator', label: 'Ausdehner', sortOrder: 20, isActive: true, isSystem: true },
  { listKey: 'asset.oilSystem', value: 'other', label: 'Sonstiges Ölsystem', sortOrder: 30, isActive: true, isSystem: true },

  { listKey: 'asset.windingCount', value: '2w', label: '2W / Zweiwickler Standard', sortOrder: 10, isActive: true, isSystem: true, metadata: { showSecondaryVoltages: false } },
  { listKey: 'asset.windingCount', value: '3w', label: '3W / Dreiwickler', sortOrder: 20, isActive: true, isSystem: true, metadata: { showSecondaryVoltages: true } },
  { listKey: 'asset.windingCount', value: 'other', label: 'Sonstige Wicklungszahl', sortOrder: 30, isActive: true, isSystem: true, metadata: { showSecondaryVoltages: false } },

  { listKey: 'assetDocument.kind', value: 'datasheet', label: 'Datenblatt', sortOrder: 10, isActive: true, isSystem: true },
  { listKey: 'assetDocument.kind', value: 'oil_analysis', label: 'Ölanalyse', sortOrder: 20, isActive: true, isSystem: true },
  { listKey: 'assetDocument.kind', value: 'test_report', label: 'Prüfbericht', sortOrder: 30, isActive: true, isSystem: true },
  { listKey: 'assetDocument.kind', value: 'protocol', label: 'Protokoll', sortOrder: 40, isActive: true, isSystem: true },
  { listKey: 'assetDocument.kind', value: 'invoice', label: 'Rechnung', sortOrder: 50, isActive: true, isSystem: true },
  { listKey: 'assetDocument.kind', value: 'delivery_note', label: 'Lieferschein', sortOrder: 60, isActive: true, isSystem: true },
  { listKey: 'assetDocument.kind', value: 'other', label: 'Sonstiges Dokument', sortOrder: 70, isActive: true, isSystem: true },

  { listKey: 'inquiry.status', value: 'new', label: 'Neu', sortOrder: 10, isActive: true, isSystem: true },
  { listKey: 'inquiry.status', value: 'triage', label: 'In Sichtung', sortOrder: 20, isActive: true, isSystem: true },
  { listKey: 'inquiry.status', value: 'waiting_for_customer', label: 'Warten auf Rückmeldung', sortOrder: 30, isActive: true, isSystem: true },
  { listKey: 'inquiry.status', value: 'ready_for_calculation', label: 'Bereit fürs Büro', sortOrder: 40, isActive: true, isSystem: true },
  { listKey: 'inquiry.status', value: 'done', label: 'Erledigt', sortOrder: 50, isActive: true, isSystem: true },
  { listKey: 'inquiry.status', value: 'lost', label: 'Abgelehnt', sortOrder: 60, isActive: true, isSystem: true },
  { listKey: 'inquiry.status', value: 'archived', label: 'Archiviert', sortOrder: 70, isActive: true, isSystem: true },

  { listKey: 'inquiry.category', value: '00000000-0000-0000-0000-000000170001', label: 'Stationswartung', sortOrder: 10, isActive: true, isSystem: true },
  { listKey: 'inquiry.category', value: '00000000-0000-0000-0000-000000170002', label: 'Störung / Eilfall', sortOrder: 20, isActive: true, isSystem: true },
  { listKey: 'inquiry.category', value: '00000000-0000-0000-0000-000000170003', label: 'Reparatur / Instandsetzung', sortOrder: 30, isActive: true, isSystem: true },
  { listKey: 'inquiry.category', value: '00000000-0000-0000-0000-000000170004', label: 'Lieferung / Ersatztrafo', sortOrder: 40, isActive: true, isSystem: true },
  { listKey: 'inquiry.category', value: '00000000-0000-0000-0000-000000170005', label: 'Prüfung / Messung', sortOrder: 50, isActive: true, isSystem: true },
  { listKey: 'inquiry.category', value: '00000000-0000-0000-0000-000000170099', label: 'Sonstiges', sortOrder: 990, isActive: true, isSystem: true },
];

function fallbackId(listKey: string, value: string): string {
  return `default-${listKey}-${value}`;
}

function nowTimestamp(): string {
  return '1970-01-01T00:00:00.000Z';
}

export function materializeDefaultSelectOption(seed: SelectOptionSeed): SelectOption {
  return {
    ...seed,
    id: fallbackId(seed.listKey, seed.value),
    createdAt: nowTimestamp(),
    updatedAt: nowTimestamp(),
  };
}

export function getSelectOptionListDefinition(listKey: string): SelectOptionListDefinition | undefined {
  return SELECT_OPTION_LIST_DEFINITIONS.find((definition) => definition.key === listKey);
}

export function getSelectOptionsForList(
  persistedOptions: SelectOption[],
  listKey: SelectOptionListKey | string,
  options: { includeInactive?: boolean } = {},
): SelectOption[] {
  const merged = new Map<string, SelectOption>();

  DEFAULT_SELECT_OPTIONS
    .filter((option) => option.listKey === listKey)
    .map(materializeDefaultSelectOption)
    .forEach((option) => merged.set(option.value, option));

  persistedOptions
    .filter((option) => option.listKey === listKey)
    .forEach((option) => merged.set(option.value, option));

  return [...merged.values()]
    .filter((option) => options.includeInactive || option.isActive)
    .sort((left, right) => left.sortOrder - right.sortOrder || left.label.localeCompare(right.label, 'de'));
}

export function getSelectOptionLabel(
  persistedOptions: SelectOption[],
  listKey: SelectOptionListKey | string,
  value: string | null | undefined,
): string {
  if (!value) return '';
  return getSelectOptionsForList(persistedOptions, listKey, { includeInactive: true }).find((option) => option.value === value)?.label || value;
}

export function optionMetadataFlag(
  persistedOptions: SelectOption[],
  listKey: SelectOptionListKey | string,
  value: string | null | undefined,
  metadataKey: keyof SelectOptionMetadata,
): boolean {
  if (!value) return false;
  const option = getSelectOptionsForList(persistedOptions, listKey, { includeInactive: true }).find((item) => item.value === value);
  return option?.metadata?.[metadataKey] === true;
}

export function slugifySelectOptionValue(label: string, existingValues: string[] = []): string {
  const normalized = label
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'option';

  const used = new Set(existingValues);
  if (!used.has(normalized)) return normalized;

  let index = 2;
  while (used.has(`${normalized}_${index}`)) index += 1;
  return `${normalized}_${index}`;
}
