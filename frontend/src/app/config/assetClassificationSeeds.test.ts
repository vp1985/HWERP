import { describe, expect, it } from 'vitest';
import {
  ASSET_TAG_SEEDS,
  getMissingAssetTagSeeds,
} from './assetClassificationSeeds';
import { Tag } from '../types/tag';

function tag(overrides: Partial<Tag>): Tag {
  return {
    id: overrides.id || 'tag-1',
    name: overrides.name || 'Demo',
    code: overrides.code,
    color: overrides.color,
    suggestedContexts: overrides.suggestedContexts || [],
    blockedContexts: overrides.blockedContexts || [],
    createdAt: overrides.createdAt || '2026-01-01T00:00:00.000Z',
    updatedAt: overrides.updatedAt || '2026-01-01T00:00:00.000Z',
  };
}

describe('asset classification seeds', () => {
  it('defines the baseline ASSETS tags that drive asset classification and dynamic tabs', () => {
    expect(ASSET_TAG_SEEDS).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Trafo', code: 'Tx', suggestedContexts: ['ASSETS'] }),
        expect.objectContaining({ name: 'Öltransformator', suggestedContexts: ['ASSETS'] }),
        expect.objectContaining({ name: 'Gießharztransformator', suggestedContexts: ['ASSETS'] }),
        expect.objectContaining({ name: 'Schaltanlage', suggestedContexts: ['ASSETS'] }),
        expect.objectContaining({ name: 'Leistungsschalter', code: 'LS', suggestedContexts: ['ASSETS'] }),
        expect.objectContaining({ name: 'Trafostation', suggestedContexts: ['ASSETS'] }),
      ])
    );
  });

  it('does not create duplicate seed tags when name or code already exists', () => {
    const missing = getMissingAssetTagSeeds([
      tag({ name: 'Trafo' }),
      tag({ id: 'tag-2', name: 'Breaker', code: 'LS' }),
    ]);

    expect(missing).not.toEqual(expect.arrayContaining([expect.objectContaining({ name: 'Trafo' })]));
    expect(missing).not.toEqual(expect.arrayContaining([expect.objectContaining({ code: 'LS' })]));
    expect(missing).toEqual(expect.arrayContaining([expect.objectContaining({ name: 'Öltransformator' })]));
  });
});
