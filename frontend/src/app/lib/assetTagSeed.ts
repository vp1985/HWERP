import { ASSET_TAG_SEEDS, getMissingAssetTagSeeds } from '../config/assetClassificationSeeds';
import { Repository } from './repository';
import { uuid } from './utils';
import { Tag } from '../types/tag';

export async function seedAssetTagsIfMissing(repository: Repository): Promise<Tag[]> {
  const existing = await repository.list<Tag>('tags');
  const missing = getMissingAssetTagSeeds(existing);

  if (missing.length === 0) return existing;

  const now = new Date().toISOString();
  const created: Tag[] = [];

  for (const seed of missing) {
    const tag: Tag = {
      id: uuid(),
      name: seed.name,
      ...(seed.code ? { code: seed.code } : {}),
      color: seed.color,
      suggestedContexts: seed.suggestedContexts,
      blockedContexts: seed.blockedContexts,
      createdAt: now,
      updatedAt: now,
    };
    created.push(await repository.upsert<Tag>('tags', tag));
  }

  return [...existing, ...created];
}

export { ASSET_TAG_SEEDS };
