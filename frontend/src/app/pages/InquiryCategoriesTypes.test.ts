import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const typesSource = () => readFileSync(resolve(__dirname, '../lib/types.ts'), 'utf8');

describe('inquiry category checklist links type contract', () => {
  it('stores linked central checklist template ids on inquiry categories', () => {
    const source = typesSource();

    expect(source).toContain(`export interface InquiryMasterDataCategory extends BaseEntity {
  name: string;
  description: string | null;
  active: boolean;
  sortOrder: number;
  checklistTemplateIds: string[];
}`);
  });
});
