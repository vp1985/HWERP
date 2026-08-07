import { describe, expect, it } from 'vitest';
import {
  CUSTOMER_NUMBER_CIRCLE_KEY,
  buildNextCustomerNumber,
  findCustomerNumberCircle,
} from './customerNumbers';
import type { NumberCircle } from '../lib/numberCircles';

function circle(overrides: Partial<NumberCircle> = {}): NumberCircle {
  return {
    key: CUSTOMER_NUMBER_CIRCLE_KEY,
    label: 'Kundennummer',
    prefix: '',
    formatTemplate: '{NUMBER}',
    padding: 5,
    nextValue: 2,
    resetYearly: false,
    lastYear: null,
    isActive: true,
    ...overrides,
  };
}

describe('customer number helpers', () => {
  it('builds the customer number preview from the central server number circle', () => {
    expect(buildNextCustomerNumber([circle()])).toBe('00002');
  });

  it('uses the customers number circle key before label fallback', () => {
    const circles = [
      circle({ key: 'legacy_customers', prefix: 'KD', formatTemplate: '{PREFIX}{NUMBER}', nextValue: 1 }),
      circle({ key: CUSTOMER_NUMBER_CIRCLE_KEY, prefix: '', formatTemplate: '{NUMBER}', nextValue: 2 }),
    ];

    expect(findCustomerNumberCircle(circles)?.key).toBe(CUSTOMER_NUMBER_CIRCLE_KEY);
    expect(buildNextCustomerNumber(circles)).toBe('00002');
  });

  it('falls back to the Kundennummer label for migrated/custom keys', () => {
    expect(buildNextCustomerNumber([
      circle({ key: 'number-range-123', prefix: 'KD', formatTemplate: '{PREFIX}{NUMBER}', nextValue: 7 }),
    ])).toBe('KD00007');
  });
});
