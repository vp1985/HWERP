import { describe, expect, it } from 'vitest';
import type { IncomingProductIngestion, TransformerAssetCandidate } from './types';
import {
  deriveIngestionSummary,
  formatElapsedRuntime,
  nextHtNumber,
  rankTransformerCandidates,
  visibleJobStatus,
} from './utils';

const started = '2026-05-18T16:00:00.000Z';
const now = '2026-05-18T16:07:30.000Z';

const baseIngestion: IncomingProductIngestion = {
  id: 'ing-1',
  source: 'telegram',
  telegramGroupName: 'HWERP',
  submittedBy: 'Vale',
  receivedAt: '2026-05-18T15:59:00.000Z',
  status: 'needs_review',
  proposedHtNumber: 'HT-2026-000126',
  photos: [
    { id: 'p1', label: 'typeplate', filename: 'typenschild.jpg', suitableForClassifieds: false },
    { id: 'p2', label: 'overview', filename: 'gesamt.jpg', suitableForClassifieds: true },
    { id: 'p3', label: 'damage', filename: 'schaden.jpg', suitableForClassifieds: false },
  ],
  extractedFields: [
    { key: 'manufacturer', label: 'Hersteller', value: 'SGB', confidence: 0.91, source: 'ocr' },
    { key: 'serialNumber', label: 'Seriennummer', value: 'SN-42', confidence: 0.83, source: 'ocr' },
    { key: 'powerKva', label: 'Leistung', value: '630 kVA', confidence: 0.78, source: 'ocr' },
  ],
  jobs: [
    { id: 'job-ocr', kind: 'ocr', status: 'done', startedAt: started, finishedAt: '2026-05-18T16:01:30.000Z' },
    { id: 'job-vision', kind: 'vision', status: 'running', startedAt: started, lastHeartbeatAt: now },
  ],
  matchCandidates: [],
};

describe('incoming product helpers', () => {
  it('summarizes typeplate photos, classifieds photos and OCR fields for the inbox', () => {
    expect(deriveIngestionSummary(baseIngestion)).toEqual({
      photoCount: 3,
      typeplateCount: 1,
      classifiedsPhotoCount: 1,
      extractedFieldCount: 3,
      hasMatchConflict: false,
    });
  });

  it('formats job runtime and exposes visible OCR/Vision status labels', () => {
    expect(formatElapsedRuntime(started, now)).toBe('7m 30s');
    expect(visibleJobStatus(baseIngestion.jobs[0], now)).toContain('OCR fertig');
    expect(visibleJobStatus(baseIngestion.jobs[1], now)).toContain('Vision läuft seit 7m 30s');
  });

  it('suggests the next editable HT number without using it as stable ID', () => {
    expect(nextHtNumber(['HT-2026-000124', 'HT-2026-000125'])).toBe('HT-2026-000126');
    expect(nextHtNumber([])).toBe('HT-2026-000001');
  });

  it('ranks transformer matches by HT number first, then serial number, and flags conflicts', () => {
    const candidates: TransformerAssetCandidate[] = [
      { id: 'asset-a', name: 'Trafo A', internalAssetId: 'HT-2026-000126', serialNumber: 'SN-OTHER', manufacturer: 'SGB', powerKva: 630 },
      { id: 'asset-b', name: 'Trafo B', internalAssetId: 'HT-2026-000099', serialNumber: 'SN-42', manufacturer: 'SGB', powerKva: 630 },
      { id: 'asset-c', name: 'Trafo C', internalAssetId: 'HT-2026-000050', serialNumber: 'SN-50', manufacturer: 'SGB', powerKva: 630 },
    ];

    const ranked = rankTransformerCandidates(
      { htNumber: 'HT-2026-000126', serialNumber: 'SN-42', manufacturer: 'SGB', powerKva: 630 },
      candidates,
    );

    expect(ranked[0]).toMatchObject({ id: 'asset-a', conflict: true });
    expect(ranked[0].matchReasons).toContain('HT-Nummer');
    expect(ranked[1]).toMatchObject({ id: 'asset-b', conflict: true });
    expect(ranked[1].matchReasons).toEqual(['Seriennummer', 'Hersteller', 'Leistung']);
  });
});
