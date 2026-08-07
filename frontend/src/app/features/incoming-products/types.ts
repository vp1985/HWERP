export type IngestionStatus = 'new' | 'ocr_done' | 'needs_review' | 'matched' | 'archived';
export type PhotoLabel = 'typeplate' | 'overview' | 'connection_side' | 'conservator' | 'bushings' | 'damage' | 'other';
export type RecognitionJobKind = 'ocr' | 'vision';
export type RecognitionJobStatus = 'queued' | 'running' | 'done' | 'failed' | 'stale';
export type ExtractedFieldSource = 'ocr' | 'vision' | 'manual';

export interface IncomingProductPhoto {
  id: string;
  label: PhotoLabel;
  filename: string;
  suitableForClassifieds: boolean;
  storagePath?: string;
}

export interface ExtractedField {
  key: string;
  label: string;
  value: string;
  confidence: number;
  source: ExtractedFieldSource;
}

export interface RecognitionJob {
  id: string;
  kind: RecognitionJobKind;
  status: RecognitionJobStatus;
  startedAt?: string;
  finishedAt?: string;
  lastHeartbeatAt?: string;
  errorMessage?: string;
}

export interface TransformerAssetCandidate {
  id: string;
  name: string;
  internalAssetId?: string;
  serialNumber?: string;
  manufacturer?: string;
  powerKva?: number;
  buildYear?: number;
}

export interface RankedTransformerCandidate extends TransformerAssetCandidate {
  score: number;
  matchReasons: string[];
  conflict: boolean;
}

export interface ExtractedTransformerIdentity {
  htNumber?: string;
  serialNumber?: string;
  manufacturer?: string;
  powerKva?: number;
  buildYear?: number;
}

export interface IncomingProductIngestion {
  id: string;
  source: 'telegram' | 'manual_upload';
  telegramGroupName?: string;
  submittedBy: string;
  receivedAt: string;
  status: IngestionStatus;
  proposedHtNumber: string;
  photos: IncomingProductPhoto[];
  extractedFields: ExtractedField[];
  jobs: RecognitionJob[];
  matchCandidates: RankedTransformerCandidate[];
  rawOcrText?: string;
}
