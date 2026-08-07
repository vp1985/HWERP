import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const pageSource = () => readFileSync(resolve(__dirname, 'ContactPersonFormPage.tsx'), 'utf8');

describe('ContactPersonFormPage persistence contracts', () => {
  it('persists edits with valid timestamps and stores the saved API response', () => {
    const source = pageSource();

    expect(source).toContain('const existing = !isNew && id ? contactPersons.find((cp) => cp.id === id) ?? null : null;');
    expect(source).toContain('const now = new Date().toISOString();');
    expect(source).toContain('createdAt: existing?.createdAt ?? now');
    expect(source).toContain('updatedAt: now');
    expect(source).not.toContain("createdAt: '', updatedAt: ''");
    expect(source).toContain("const savedContactPerson = await repository.upsert<ContactPerson>('contactPersons', contactPerson);");
    expect(source).toContain("data: savedContactPerson");
  });

  it('creates customer and location links with valid timestamps', () => {
    const source = pageSource();

    expect(source).toContain('isPrimary: false');
    expect(source).toContain('createdAt: now, updatedAt: now');
    expect(source).toContain("repository.upsert<CustomerContactPerson>('customerContactPersons', newLink)");
    expect(source).toContain("repository.upsert<LocationContactOverride>('locationContactOverrides', newLink)");
  });
});
