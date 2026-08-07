import { describe, expect, it } from 'vitest';
import {
  buildNextSupplierNumber,
  getCustomerRoleLabel,
  normalizeCustomerRoles,
  reserveNextSupplierNumber,
  shouldAssignCustomerNumber,
  shouldAssignSupplierNumber,
} from './customerBusinessPartner';
import { EditableNumberRangeConfig } from '../lib/numberRangeUtils';

const ranges: EditableNumberRangeConfig[] = [
  { id: 'supplier-numbers', label: 'Lieferantennummer', prefix: 'LF', digits: 5, nextNumber: 23, suffix: '' },
  { id: 'customer-numbers', label: 'Kundennummer', prefix: 'KD', digits: 5, nextNumber: 9, suffix: '' },
];

describe('business partner customer/supplier helpers', () => {
  it('treats existing rows without explicit roles as customers for backwards compatibility', () => {
    expect(normalizeCustomerRoles(undefined)).toEqual(['customer']);
    expect(getCustomerRoleLabel(undefined)).toBe('Kunde');
  });

  it('allows one organisation to be customer and supplier at the same time', () => {
    expect(normalizeCustomerRoles(['supplier', 'customer', 'supplier'])).toEqual(['customer', 'supplier']);
    expect(getCustomerRoleLabel(['customer', 'supplier'])).toBe('Kunde + Lieferant');
  });

  it('builds and reserves supplier numbers from a separate Lieferantennummer range', () => {
    expect(buildNextSupplierNumber(ranges)).toBe('LF00023');
    expect(reserveNextSupplierNumber(ranges)).toEqual({
      supplierNumber: 'LF00023',
      numberRanges: [
        { id: 'supplier-numbers', label: 'Lieferantennummer', prefix: 'LF', digits: 5, nextNumber: 24, suffix: '' },
        { id: 'customer-numbers', label: 'Kundennummer', prefix: 'KD', digits: 5, nextNumber: 9, suffix: '' },
      ],
    });
  });

  it('assigns numbers only when the corresponding role is active and no number exists yet', () => {
    expect(shouldAssignCustomerNumber(['supplier'], '')).toBe(false);
    expect(shouldAssignCustomerNumber(['customer'], '')).toBe(true);
    expect(shouldAssignCustomerNumber(['customer'], 'KD00001')).toBe(false);
    expect(shouldAssignSupplierNumber(['customer'], '')).toBe(false);
    expect(shouldAssignSupplierNumber(['supplier'], '')).toBe(true);
    expect(shouldAssignSupplierNumber(['customer', 'supplier'], 'LF00001')).toBe(false);
  });
});
