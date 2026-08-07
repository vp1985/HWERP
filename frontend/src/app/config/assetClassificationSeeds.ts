import { Tag, TagContext } from '../types/tag';

export interface AssetTagSeed {
  name: string;
  code?: string;
  color: string;
  suggestedContexts: TagContext[];
  blockedContexts: TagContext[];
}

export const ASSET_TAG_SEEDS: AssetTagSeed[] = [
  {
    name: 'Trafo',
    code: 'Tx',
    color: '#2563eb',
    suggestedContexts: ['ASSETS'],
    blockedContexts: [],
  },
  {
    name: 'Öltransformator',
    color: '#1d4ed8',
    suggestedContexts: ['ASSETS'],
    blockedContexts: [],
  },
  {
    name: 'Gießharztransformator',
    color: '#7c3aed',
    suggestedContexts: ['ASSETS'],
    blockedContexts: [],
  },
  {
    name: 'Schaltanlage',
    color: '#f97316',
    suggestedContexts: ['ASSETS'],
    blockedContexts: [],
  },
  {
    name: 'Leistungsschalter',
    code: 'LS',
    color: '#dc2626',
    suggestedContexts: ['ASSETS'],
    blockedContexts: [],
  },
  {
    name: 'Trafostation',
    color: '#059669',
    suggestedContexts: ['ASSETS'],
    blockedContexts: [],
  },
];

function normalize(value: string | undefined): string {
  return (value || '').trim().toLocaleLowerCase('de-DE');
}

export function getMissingAssetTagSeeds(existingTags: Pick<Tag, 'name' | 'code'>[]): AssetTagSeed[] {
  const existingNames = new Set(existingTags.map((tag) => normalize(tag.name)));
  const existingCodes = new Set(
    existingTags
      .map((tag) => normalize(tag.code))
      .filter((code) => code.length > 0)
  );

  return ASSET_TAG_SEEDS.filter((seed) => {
    if (existingNames.has(normalize(seed.name))) return false;
    if (seed.code && existingCodes.has(normalize(seed.code))) return false;
    return true;
  });
}
