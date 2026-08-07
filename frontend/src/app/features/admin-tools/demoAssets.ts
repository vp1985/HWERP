import type { Customer } from '../../lib/types';

export interface SyntheticTransformerFixture {
  name: string;
  manufacturer: string;
  powerKva: number;
  serialNumber: string;
  buildYear: number;
  internalNumber: string;
  parentId: string | null;
}

const DEMO_POWERS_KVA = [160, 250, 400, 500, 630, 800, 1000, 1600];

export function createSyntheticTransformerFixtures(
  parentIds: Array<string | null>,
): SyntheticTransformerFixture[] {
  const normalizedParentIds = parentIds.length > 0 ? parentIds : [null];

  return Array.from({ length: 24 }, (_, index) => {
    const sequence = String(index + 1).padStart(4, '0');
    const powerKva = DEMO_POWERS_KVA[index % DEMO_POWERS_KVA.length];

    return {
      name: `Demo-Transformator ${sequence} · ${powerKva} kVA`,
      manufacturer: 'Demo Trafo GmbH',
      powerKva,
      serialNumber: `DEMO-SN-${sequence}`,
      buildYear: 2000 + (index % 24),
      internalNumber: `DEMO-HT-${sequence}`,
      parentId: normalizedParentIds[index % normalizedParentIds.length],
    };
  });
}

export function createSyntheticCustomerFixtures(
  now: string,
  createId: () => string,
): Customer[] {
  return Array.from({ length: 10 }, (_, index) => {
    const sequence = String(index + 1).padStart(2, '0');

    return {
      id: createId(),
      name: `Musterkunde ${sequence} GmbH`,
      streetLine: `Beispielweg ${index + 1}`,
      postalCode: `000${sequence}`,
      city: 'Beispielstadt',
      country: 'Deutschland',
      contactName: `Demo Kontakt ${sequence}`,
      phone: `+49 30 0000 ${sequence}`,
      email: `kontakt-${sequence}@example.com`,
      notes: 'Ausschließlich synthetische Beispieldaten',
      createdAt: now,
      updatedAt: now,
    };
  });
}
