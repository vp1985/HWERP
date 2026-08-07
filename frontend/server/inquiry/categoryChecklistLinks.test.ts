import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migrationSource = () => readFileSync(resolve(process.cwd(), 'migrations/018_inquiry_category_checklist_links.sql'), 'utf8');

describe('inquiry category checklist link migration', () => {
  it('adds a durable checklist template id array to inquiry categories', () => {
    const source = migrationSource();

    expect(source).toContain('ALTER TABLE inquiry_master_data_categories');
    expect(source).toContain('checklist_template_ids UUID[]');
    expect(source).toContain('DEFAULT ARRAY[]::UUID[]');
  });
});
