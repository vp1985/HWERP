import { describe, expect, it } from 'vitest';
import {
  DEFAULT_NUMBER_CIRCLE_SEEDS,
  INQUIRY_NUMBER_CIRCLE_KEY,
  TRANSFER_RECEIPT_NUMBER_CIRCLE_KEY,
  applyYearlyReset,
  findReusableReturnedBlock,
  formatNumberCircle,
  getPreviewForCircle,
  parseNumberCircleValue,
  parseReusableNumberValue,
  validateNumberCircleConfig,
} from './numberCircles';

describe('default number circle seeds', () => {
  it('ships Werkstattkarten as a server-backed configurable WK number range', () => {
    expect(DEFAULT_NUMBER_CIRCLE_SEEDS).toContainEqual({
      key: 'workshop_cards',
      label: 'Werkstattkarten',
      prefix: 'WK',
      formatTemplate: '{PREFIX}-{NUMBER}',
      padding: 5,
      nextValue: 1,
      resetYearly: false,
      isActive: true,
    });
  });

  it('ships Übernahmebelege as a server-backed ÜB number range', () => {
    expect(DEFAULT_NUMBER_CIRCLE_SEEDS).toContainEqual({
      key: TRANSFER_RECEIPT_NUMBER_CIRCLE_KEY,
      label: 'Übernahmebelege',
      prefix: 'ÜB',
      formatTemplate: '{PREFIX}-{NUMBER}',
      padding: 6,
      nextValue: 1,
      resetYearly: false,
      isActive: true,
    });
  });

  it('ships Anfrage-Nr as a yearly server-backed ANF number range', () => {
    expect(DEFAULT_NUMBER_CIRCLE_SEEDS).toContainEqual({
      key: INQUIRY_NUMBER_CIRCLE_KEY,
      label: 'Anfragen',
      prefix: 'ANF-{YYYY}',
      formatTemplate: '{PREFIX}-{NUMBER}',
      padding: 4,
      nextValue: 1,
      resetYearly: true,
      isActive: true,
    });
  });
});

describe('formatNumberCircle', () => {
  it('formatiert Prefix, Padding und Nummer', () => {
    expect(formatNumberCircle({
      prefix: 'K',
      formatTemplate: '{PREFIX}-{NUMBER}',
      padding: 6,
      value: 42,
      date: new Date('2026-04-26T00:00:00Z'),
    })).toBe('K-000042');
  });

  it('ersetzt {YYYY} in Prefix und Template', () => {
    expect(formatNumberCircle({
      prefix: 'LS-{YYYY}',
      formatTemplate: '{PREFIX}-{NUMBER}',
      padding: 6,
      value: 1,
      date: new Date('2026-01-01T00:00:00Z'),
    })).toBe('LS-2026-000001');
  });

  it('weist unbekannte Platzhalter zurück', () => {
    const errors = validateNumberCircleConfig({
      key: 'service_ls',
      label: 'Service LS',
      prefix: 'LS-{YY}',
      formatTemplate: '{PREFIX}-{NUMBER}',
      padding: 6,
      nextValue: 1,
    });

    expect(errors.some((error) => error.includes('{YY}'))).toBe(true);
  });

  it('verlangt {NUMBER} im Template', () => {
    const errors = validateNumberCircleConfig({
      key: 'calculations',
      label: 'Kalkulationen',
      prefix: 'K',
      formatTemplate: '{PREFIX}',
      padding: 6,
      nextValue: 1,
    });

    expect(errors.some((error) => error.includes('{NUMBER}'))).toBe(true);
  });
});

describe('previewNumberCircle', () => {
  it('zeigt die nächste zurückgegebene Nummer vor dem fortlaufenden nextValue', () => {
    expect(getPreviewForCircle({
      prefix: 'KD',
      formatTemplate: '{PREFIX}{NUMBER}',
      padding: 5,
      nextValue: 2,
    }, new Date('2026-04-26T00:00:00Z'), ['KD00001'])).toBe('KD00001');
  });
});

describe('applyYearlyReset', () => {
  it('läuft im gleichen Jahr weiter', () => {
    expect(applyYearlyReset({
      nextValue: 12,
      resetYearly: true,
      lastYear: 2026,
      date: new Date('2026-08-12T00:00:00Z'),
    })).toEqual({ nextValue: 12, lastYear: 2026, didReset: false });
  });

  it('setzt im neuen Jahr auf 1 zurück, wenn resetYearly aktiv ist', () => {
    expect(applyYearlyReset({
      nextValue: 12,
      resetYearly: true,
      lastYear: 2025,
      date: new Date('2026-01-01T00:00:00Z'),
    })).toEqual({ nextValue: 1, lastYear: 2026, didReset: true });
  });

  it('läuft im neuen Jahr weiter, wenn resetYearly inaktiv ist', () => {
    expect(applyYearlyReset({
      nextValue: 12,
      resetYearly: false,
      lastYear: 2025,
      date: new Date('2026-01-01T00:00:00Z'),
    })).toEqual({ nextValue: 12, lastYear: 2026, didReset: false });
  });
});

describe('parseNumberCircleValue', () => {
  const circle = {
    prefix: 'LS-{YYYY}',
    formatTemplate: '{PREFIX}-{NUMBER}',
    padding: 6,
  };

  it('akzeptiert Nummern, die exakt zum Nummernkreisformat passen', () => {
    expect(parseNumberCircleValue(circle, 'LS-2026-000042', new Date('2026-04-26T00:00:00Z'))).toEqual({
      number: 'LS-2026-000042',
      value: 42,
    });
  });

  it('weist Nummern mit falschem Prefix oder Padding zurück', () => {
    expect(parseNumberCircleValue(circle, 'WB-2026-000042', new Date('2026-04-26T00:00:00Z'))).toBeNull();
    expect(parseNumberCircleValue(circle, 'LS-2026-42', new Date('2026-04-26T00:00:00Z'))).toBeNull();
  });
});

describe('findReusableReturnedBlock', () => {
  it('findet einen zusammenhängenden Block zurückgegebener Nummern', () => {
    expect(findReusableReturnedBlock([
      'WB-2026-000010',
      'WB-2026-000012',
      'WB-2026-000013',
      'WB-2026-000014',
    ], 3)).toEqual([
      'WB-2026-000012',
      'WB-2026-000013',
      'WB-2026-000014',
    ]);
  });

  it('fällt auf leeren Block zurück, wenn die Menge nicht zusammenhängend verfügbar ist', () => {
    expect(findReusableReturnedBlock([
      'WB-2026-000010',
      'WB-2026-000012',
      'WB-2026-000014',
    ], 2)).toEqual([]);
  });

  it('unterstützt zurückgegebene Nummern aus älteren Formatkonfigurationen', () => {
    expect(parseReusableNumberValue('LS-2026-000120')).toEqual({
      number: 'LS-2026-000120',
      value: 120,
      prefix: 'LS-2026-',
    });
    expect(findReusableReturnedBlock([
      'LS-2026-000120',
      'LS-2026-000121',
    ], 2)).toEqual([
      'LS-2026-000120',
      'LS-2026-000121',
    ]);
  });
});
