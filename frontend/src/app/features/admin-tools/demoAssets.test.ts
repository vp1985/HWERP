import { describe, expect, it } from 'vitest';

import { createSyntheticCustomerFixtures, createSyntheticTransformerFixtures } from './demoAssets';

describe('createSyntheticTransformerFixtures', () => {
  it('creates only clearly synthetic, unique transformer identifiers', () => {
    const fixtures = createSyntheticTransformerFixtures(['station-a', 'station-b', null]);

    expect(fixtures).toHaveLength(24);
    expect(new Set(fixtures.map((fixture) => fixture.serialNumber))).toHaveLength(24);
    expect(fixtures.every((fixture) => /^DEMO-SN-\d{4}$/.test(fixture.serialNumber))).toBe(true);
    expect(fixtures.every((fixture) => /^DEMO-HT-\d{4}$/.test(fixture.internalNumber))).toBe(true);
    expect(fixtures.every((fixture) => fixture.name.startsWith('Demo-Transformator'))).toBe(true);
  });
});

describe('createSyntheticCustomerFixtures', () => {
  it('uses obvious sample identities and RFC-reserved email domains', () => {
    let sequence = 0;
    const customers = createSyntheticCustomerFixtures('2026-08-07T00:00:00.000Z', () => `customer-${++sequence}`);

    expect(customers).toHaveLength(10);
    expect(new Set(customers.map((customer) => customer.id))).toHaveLength(10);
    expect(customers.every((customer) => customer.name.startsWith('Musterkunde'))).toBe(true);
    expect(customers.every((customer) => customer.email?.endsWith('@example.com'))).toBe(true);
  });
});
