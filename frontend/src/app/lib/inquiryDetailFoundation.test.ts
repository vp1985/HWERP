import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const typesSource = () => readFileSync(resolve(__dirname, 'types.ts'), 'utf8');
const repositorySource = () => readFileSync(resolve(__dirname, 'repository.ts'), 'utf8');
const appStoreSource = () => readFileSync(resolve(__dirname, '../context/AppStoreContext.tsx'), 'utf8');
const migrationSource = () => readFileSync(resolve(__dirname, '../../../migrations/006_inquiry_detail_foundation.sql'), 'utf8');

describe('inquiry detail data foundation', () => {
  it('defines inquiry attachment and external link types', () => {
    const source = typesSource();

    expect(source).toContain('export interface InquiryAttachment');
    expect(source).toContain('storageProvider');
    expect(source).toContain('thumbnailUrl');
    expect(source).toContain('export interface InquiryExternalLink');
    expect(source).toContain('targetId');
  });

  it('wires detail entities through repository and app store hydration', () => {
    const repository = repositorySource();
    const appStore = appStoreSource();

    for (const entity of ['inquiryAttachments', 'inquiryExternalLinks']) {
      expect(repository).toContain(`| '${entity}'`);
      expect(repository).toContain(`${entity}: []`);
      expect(appStore).toContain(`${entity}: BaseEntity[]`);
      expect(appStore).toContain(`'${entity}'`);
    }
  });

  it('adds PostgreSQL tables without monetary columns', () => {
    const source = migrationSource();

    expect(source).toContain('CREATE TABLE IF NOT EXISTS inquiry_attachments');
    expect(source).toContain('CREATE TABLE IF NOT EXISTS inquiry_external_links');
    expect(source).toContain('storage_provider');
    expect(source).toContain('storage_url');
    expect(source).not.toMatch(/\b(price|prices|total_price|hourly_rate|unit_price|amount_cents|total_cents)\b/i);
    expect(source).not.toContain('€');
  });
});
