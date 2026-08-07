import { describe, expect, it } from 'vitest';
import { Customer, SupplierCapability, SupplierCapabilityTag, SupplierProductCategory } from '../lib/types';
import { findSupplierMatches, normalizeSupplierCapabilityInput } from './supplierMatching';

const now = '2026-01-01T00:00:00.000Z';

const categories: SupplierProductCategory[] = [
  { id: 'stahl', name: 'Stahlwannen', aliases: ['Ölwanne Stahl', 'Auffangwanne Stahl'], description: null, parentId: null, active: true, sortOrder: 1, createdAt: now, updatedAt: now },
  { id: 'alu', name: 'Aluminiumwannen', aliases: ['Ölwanne Aluminium', 'Alu-Ölwanne'], description: null, parentId: null, active: true, sortOrder: 2, createdAt: now, updatedAt: now },
  { id: 'transport', name: 'Transporte', aliases: [], description: null, parentId: null, active: true, sortOrder: 3, createdAt: now, updatedAt: now },
];

const suppliers: Customer[] = [
  { id: 'trowa', name: 'TROWAtech', roles: ['supplier'], supplierNumber: 'LF00001', createdAt: now, updatedAt: now },
  { id: 'steelco', name: 'SteelCo', roles: ['supplier'], supplierNumber: 'LF00002', createdAt: now, updatedAt: now },
  { id: 'kundex', name: 'Nur Kunde', roles: ['customer'], customerNumber: 'KD00001', createdAt: now, updatedAt: now },
];

const capabilities: SupplierCapability[] = [
  { id: 'cap-alu', customerId: 'trowa', categoryId: 'alu', capabilityLabel: 'Ölwannen aus Aluminium', materials: ['Aluminium'], serviceTags: [], fitLevel: 'hoch', priorityRank: 1, notes: null, active: true, createdAt: now, updatedAt: now },
  { id: 'cap-stahl', customerId: 'steelco', categoryId: 'stahl', capabilityLabel: 'Ölwannen aus Stahl', materials: ['Stahl'], serviceTags: [], fitLevel: 'hoch', priorityRank: 1, notes: null, active: true, createdAt: now, updatedAt: now },
];

describe('supplier matching', () => {
  it('matches steel oil pan requests by maintained category and excludes aluminium-only suppliers', () => {
    const matches = findSupplierMatches({ query: 'Ölwanne aus Stahl' }, suppliers, categories, capabilities, []);

    expect(matches.map((match) => match.supplier.name)).toEqual(['SteelCo']);
    expect(matches[0].reasons.join(' ')).toContain('Stahlwannen');
  });

  it('matches supplier by maintained concrete product term', () => {
    const productCapabilities: SupplierCapability[] = [
      {
        id: 'cap-ow-1200',
        customerId: 'steelco',
        categoryId: 'stahl',
        capabilityLabel: 'Serienfertigung Stahlwannen',
        productTerms: ['OW-1200', 'Ölwanne Typ 1200'],
        materials: ['Stahl'],
        serviceTags: [],
        fitLevel: 'hoch',
        priorityRank: 1,
        notes: null,
        active: true,
        createdAt: now,
        updatedAt: now,
      },
    ];

    const matches = findSupplierMatches({ query: 'OW-1200' }, suppliers, categories, productCapabilities, []);

    expect(matches.map((match) => match.supplier.name)).toEqual(['SteelCo']);
    expect(matches[0].reasons.join(' ')).toContain('Produkt: OW-1200');
  });

  it('requires every selected service chip for transport matching', () => {
    const transportSuppliers: Customer[] = [
      { id: 'flex', name: 'FlexLog', roles: ['supplier'], createdAt: now, updatedAt: now },
      { id: 'fix', name: 'FixLog', roles: ['supplier'], createdAt: now, updatedAt: now },
    ];
    const transportCapabilities: SupplierCapability[] = [
      { id: 'cap-flex', customerId: 'flex', categoryId: 'transport', capabilityLabel: 'Transport flexibel mit Kran', materials: [], serviceTags: ['Spediteur', 'Kran bis 5 t', 'Flexibel'], fitLevel: 'hoch', priorityRank: 1, notes: null, active: true, createdAt: now, updatedAt: now },
      { id: 'cap-fix', customerId: 'fix', categoryId: 'transport', capabilityLabel: 'Transport Fixtermin mit Kran', materials: [], serviceTags: ['Spediteur', 'Kran bis 5 t', 'Fixtermine'], fitLevel: 'hoch', priorityRank: 1, notes: null, active: true, createdAt: now, updatedAt: now },
    ];

    const matches = findSupplierMatches(
      { selectedCategoryId: 'transport', selectedServiceTags: ['Spediteur', 'Kran bis 5 t', 'Flexibel'] },
      transportSuppliers,
      categories,
      transportCapabilities,
      [],
    );

    expect(matches.map((match) => match.supplier.name)).toEqual(['FlexLog']);
  });

  it('normalizes comma-separated materials, concrete product terms and chips for capability maintenance', () => {
    expect(normalizeSupplierCapabilityInput(' Stahl, Aluminium ', ' OW-1200, Trafo 630 kVA ', 'Spediteur, Kran bis 5 t, Flexibel')).toEqual({
      materials: ['Stahl', 'Aluminium'],
      productTerms: ['OW-1200', 'Trafo 630 kVA'],
      serviceTags: ['Spediteur', 'Kran bis 5 t', 'Flexibel'],
    });
  });
});
