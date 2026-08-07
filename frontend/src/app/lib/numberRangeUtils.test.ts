import { describe, expect, it } from 'vitest';
import {
  CUSTOMER_NUMBER_RANGE_ID,
  DEFAULT_NUMBER_RANGES,
  SERVICE_NUMBER_RANGE_ID,
  TRANSFER_RECEIPT_NUMBER_RANGE_ID,
  buildNextNumber,
  buildNumberRangePreview,
  normalizeNumberRangeConfig,
} from './numberRangeUtils';

describe('number range utils', () => {
  it('ships Kundennummer as a KD00001 default number range', () => {
    expect(DEFAULT_NUMBER_RANGES).toContainEqual({
      id: CUSTOMER_NUMBER_RANGE_ID,
      label: 'Kundennummer',
      prefix: 'KD',
      digits: 5,
      nextNumber: 1,
      suffix: '',
    });
  });

  it('ships serviceleistungen as an SL0001 default number range from the screenshot', () => {
    expect(DEFAULT_NUMBER_RANGES).toContainEqual({
      id: SERVICE_NUMBER_RANGE_ID,
      label: 'Serviceleistungen',
      prefix: 'SL',
      digits: 4,
      nextNumber: 1,
      suffix: '',
    });
    expect(buildNextNumber({ label: 'Serviceleistungen', prefix: 'SL', digits: 4, nextNumber: 1, suffix: '' })).toBe('SL0001');
  });

  it('ships Übernahmebelege as a ÜB-000001 default number range', () => {
    expect(DEFAULT_NUMBER_RANGES).toContainEqual({
      id: TRANSFER_RECEIPT_NUMBER_RANGE_ID,
      label: 'Übernahmebelege',
      prefix: 'ÜB-',
      digits: 6,
      nextNumber: 1,
      suffix: '',
    });
    expect(buildNextNumber({ label: 'Übernahmebelege', prefix: 'ÜB-', digits: 6, nextNumber: 1, suffix: '' })).toBe('ÜB-000001');
  });

  it('builds the next workshop-card number from prefix, running digit count and suffix', () => {
    expect(buildNextNumber({ label: 'Werkstattkarten', prefix: 'WK-', digits: 5, nextNumber: 42, suffix: '-26' })).toBe('WK-00042-26');
  });

  it('builds a compact preview sequence starting with the next number', () => {
    expect(
      buildNumberRangePreview({ label: 'Werkstattkarten', prefix: 'WK-', digits: 4, nextNumber: 8, suffix: '' }, 3),
    ).toEqual(['WK-0008', 'WK-0009', 'WK-0010']);
  });

  it('normalizes invalid input to safe editable defaults', () => {
    expect(
      normalizeNumberRangeConfig({ label: '', prefix: undefined, digits: 0, nextNumber: -12, suffix: undefined }),
    ).toEqual({ label: 'Nummernkreis', prefix: '', digits: 1, nextNumber: 1, suffix: '' });
  });
});
