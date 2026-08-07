import type {
  ExtractedTransformerIdentity,
  IncomingProductIngestion,
  PhotoLabel,
  RankedTransformerCandidate,
  RecognitionJob,
  TransformerAssetCandidate,
} from './types';

export const photoLabelText: Record<PhotoLabel, string> = {
  typeplate: 'Typenschild',
  overview: 'Gesamtansicht',
  connection_side: 'Anschlussseite',
  conservator: 'Ausdehner',
  bushings: 'Durchführungen',
  damage: 'Schaden',
  other: 'Sonstiges',
};

export function deriveIngestionSummary(ingestion: IncomingProductIngestion) {
  return {
    photoCount: ingestion.photos.length,
    typeplateCount: ingestion.photos.filter((photo) => photo.label === 'typeplate').length,
    classifiedsPhotoCount: ingestion.photos.filter((photo) => photo.suitableForClassifieds).length,
    extractedFieldCount: ingestion.extractedFields.length,
    hasMatchConflict: ingestion.matchCandidates.some((candidate) => candidate.conflict),
  };
}

export function formatElapsedRuntime(startedAt: string, nowIso: string) {
  const elapsedSeconds = Math.max(0, Math.floor((Date.parse(nowIso) - Date.parse(startedAt)) / 1000));
  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

export function visibleJobStatus(job: RecognitionJob, nowIso = new Date().toISOString()) {
  const label = job.kind === 'ocr' ? 'OCR' : 'Vision';

  if (job.status === 'queued') return `${label} wartet`;
  if (job.status === 'running') {
    return job.startedAt ? `${label} läuft seit ${formatElapsedRuntime(job.startedAt, nowIso)}` : `${label} läuft`;
  }
  if (job.status === 'done') return `${label} fertig${job.finishedAt ? ` · ${new Date(job.finishedAt).toLocaleString('de-DE')}` : ''}`;
  if (job.status === 'failed') return `${label} fehlgeschlagen${job.errorMessage ? ` · ${job.errorMessage}` : ''}`;
  return `${label} veraltet`;
}

export function nextHtNumber(existingHtNumbers: string[]) {
  const currentYear = new Date().getFullYear();
  const max = existingHtNumbers.reduce((highest, value) => {
    const match = value.match(/HT-\d{4}-(\d{6})$/);
    if (!match) return highest;
    return Math.max(highest, Number(match[1]));
  }, 0);
  return `HT-${currentYear}-${String(max + 1).padStart(6, '0')}`;
}

export function rankTransformerCandidates(
  identity: ExtractedTransformerIdentity,
  candidates: TransformerAssetCandidate[],
): RankedTransformerCandidate[] {
  const normalizedHt = normalize(identity.htNumber);
  const normalizedSerial = normalize(identity.serialNumber);

  return candidates
    .map((candidate) => {
      const matchReasons: string[] = [];
      let score = 0;

      const htMatches = Boolean(normalizedHt && normalize(candidate.internalAssetId) === normalizedHt);
      const serialMatches = Boolean(normalizedSerial && normalize(candidate.serialNumber) === normalizedSerial);

      if (htMatches) {
        score += 100;
        matchReasons.push('HT-Nummer');
      }
      if (serialMatches) {
        score += 80;
        matchReasons.push('Seriennummer');
      }
      if (identity.manufacturer && normalize(candidate.manufacturer) === normalize(identity.manufacturer)) {
        score += 15;
        matchReasons.push('Hersteller');
      }
      if (identity.powerKva && candidate.powerKva === identity.powerKva) {
        score += 10;
        matchReasons.push('Leistung');
      }
      if (identity.buildYear && candidate.buildYear === identity.buildYear) {
        score += 5;
        matchReasons.push('Baujahr');
      }

      const conflict = Boolean(
        (htMatches && normalizedSerial && candidate.serialNumber && normalize(candidate.serialNumber) !== normalizedSerial)
        || (serialMatches && normalizedHt && candidate.internalAssetId && normalize(candidate.internalAssetId) !== normalizedHt),
      );

      return { ...candidate, score, matchReasons, conflict };
    })
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score);
}

function normalize(value?: string) {
  return String(value ?? '').trim().toLowerCase().replace(/\s+/g, '');
}
