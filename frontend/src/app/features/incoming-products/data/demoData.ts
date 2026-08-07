import type { IncomingProductIngestion, TransformerAssetCandidate } from '../types';
import { rankTransformerCandidates } from '../utils';

export const demoTransformerAssets: TransformerAssetCandidate[] = [
  {
    id: 'asset-trafo-1',
    name: 'Trafo Lagerplatz A3',
    internalAssetId: 'HT-2026-000126',
    serialNumber: 'SN-OTHER',
    manufacturer: 'SGB',
    powerKva: 630,
    buildYear: 2012,
  },
  {
    id: 'asset-trafo-2',
    name: 'Trafo Reservelager Nord',
    internalAssetId: 'HT-2026-000099',
    serialNumber: 'SN-42',
    manufacturer: 'SGB',
    powerKva: 630,
    buildYear: 2012,
  },
];

const extractedIdentity = {
  htNumber: 'HT-2026-000126',
  serialNumber: 'SN-42',
  manufacturer: 'SGB',
  powerKva: 630,
  buildYear: 2012,
};

export const demoIncomingProducts: IncomingProductIngestion[] = [
  {
    id: 'ing-telegram-1',
    source: 'telegram',
    telegramGroupName: 'HWERP',
    submittedBy: 'Vale',
    receivedAt: '2026-05-18T16:00:00.000Z',
    status: 'needs_review',
    proposedHtNumber: 'HT-2026-000126',
    photos: [
      { id: 'photo-1', label: 'typeplate', filename: 'typenschild-front.jpg', suitableForClassifieds: false },
      { id: 'photo-2', label: 'overview', filename: 'trafo-gesamt.jpg', suitableForClassifieds: true },
      { id: 'photo-3', label: 'connection_side', filename: 'anschlussseite.jpg', suitableForClassifieds: true },
      { id: 'photo-4', label: 'damage', filename: 'lackschaden.jpg', suitableForClassifieds: false },
    ],
    extractedFields: [
      { key: 'manufacturer', label: 'Hersteller', value: 'SGB', confidence: 0.91, source: 'ocr' },
      { key: 'serialNumber', label: 'Seriennummer', value: 'SN-42', confidence: 0.83, source: 'ocr' },
      { key: 'powerKva', label: 'Leistung', value: '630 kVA', confidence: 0.78, source: 'ocr' },
      { key: 'primaryVoltage', label: 'OS-Spannung', value: '20 kV', confidence: 0.69, source: 'ocr' },
      { key: 'vectorGroup', label: 'Schaltgruppe', value: 'Dyn5', confidence: 0.62, source: 'ocr' },
    ],
    jobs: [
      {
        id: 'job-ocr-1',
        kind: 'ocr',
        status: 'done',
        startedAt: '2026-05-18T16:01:00.000Z',
        finishedAt: '2026-05-18T16:02:10.000Z',
      },
      {
        id: 'job-vision-1',
        kind: 'vision',
        status: 'queued',
      },
    ],
    matchCandidates: rankTransformerCandidates(extractedIdentity, demoTransformerAssets),
    rawOcrText: 'SGB Transformator · Serien-Nr. SN-42 · 630 kVA · 20/0,4 kV · Dyn5',
  },
];
