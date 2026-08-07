import { describe, expect, it } from 'vitest';
import {
  getSelectOptionLabel,
  getSelectOptionsForList,
  optionMetadataFlag,
  slugifySelectOptionValue,
  type SelectOption,
} from './selectOptions';

function option(partial: Partial<SelectOption> & Pick<SelectOption, 'listKey' | 'value' | 'label'>): SelectOption {
  return {
    id: `${partial.listKey}-${partial.value}`,
    sortOrder: 99,
    isActive: true,
    isSystem: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...partial,
  };
}

describe('select option helpers', () => {
  it('returns default dropdown options when no master data exists', () => {
    const options = getSelectOptionsForList([], 'asset.trafoKind');

    expect(options.map((item) => item.value)).toEqual(['oil', 'cast_resin', 'other']);
    expect(options.map((item) => item.label)).toContain('Öltransformator');
    expect(getSelectOptionsForList([], 'inquiry.status').map((item) => item.label)).toEqual([
      'Neu',
      'In Sichtung',
      'Warten auf Rückmeldung',
      'Bereit fürs Büro',
      'Erledigt',
      'Abgelehnt',
      'Archiviert',
    ]);
    expect(getSelectOptionsForList([], 'inquiry.category').map((item) => item.label)).toContain('Reparatur / Instandsetzung');
  });

  it('lets persisted master data override labels, order and active state', () => {
    const options = getSelectOptionsForList([
      option({ listKey: 'asset.trafoKind', value: 'oil', label: 'Öltrafo', sortOrder: 30, isActive: false, isSystem: true }),
      option({ listKey: 'asset.trafoKind', value: 'dry', label: 'Trockentrafo', sortOrder: 5 }),
    ], 'asset.trafoKind');

    expect(options.map((item) => item.value)).toEqual(['dry', 'cast_resin', 'other']);
    expect(getSelectOptionLabel([], 'asset.trafoKind', 'oil')).toBe('Öltransformator');
  });

  it('reads option metadata flags used by dependent form fields', () => {
    expect(optionMetadataFlag([], 'asset.trafoKind', 'oil', 'showOilSystem')).toBe(true);
    expect(optionMetadataFlag([], 'asset.windingCount', '3w', 'showSecondaryVoltages')).toBe(true);
    expect(optionMetadataFlag([], 'asset.windingCount', '2w', 'showSecondaryVoltages')).toBe(false);
  });

  it('creates stable unique values from labels', () => {
    expect(slugifySelectOptionValue('Gießharz + Spezial', [])).toBe('giessharz_spezial');
    expect(slugifySelectOptionValue('Option', ['option', 'option_2'])).toBe('option_3');
  });
});
