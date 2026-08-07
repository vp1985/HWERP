import { describe, expect, it } from 'vitest';
import type { CustomerContactPerson } from './types';
import {
  buildMissingCustomerContactLinkWarning,
  isContactLinkedToCustomer,
  resolvePrimaryCustomerForContact,
} from './contactAssignmentUtils';

const link = (id: string, customerId: string, contactPersonId: string, isPrimary = false): CustomerContactPerson => ({
  id,
  customerId,
  contactPersonId,
  isPrimary,
  createdAt: '2026-06-11T00:00:00.000Z',
  updatedAt: '2026-06-11T00:00:00.000Z',
});

describe('contact assignment helper logic', () => {
  it('uses the only linked company as automatic primary company for a contact person', () => {
    expect(resolvePrimaryCustomerForContact('person-1', [link('l1', 'customer-1', 'person-1')])).toBe('customer-1');
  });

  it('prefers an explicit isPrimary company when a contact person has multiple companies', () => {
    expect(resolvePrimaryCustomerForContact('person-1', [
      link('l1', 'customer-1', 'person-1'),
      link('l2', 'customer-2', 'person-1', true),
    ])).toBe('customer-2');
  });

  it('does not silently select a company when multiple links exist without a primary company', () => {
    expect(resolvePrimaryCustomerForContact('person-1', [
      link('l1', 'customer-1', 'person-1'),
      link('l2', 'customer-2', 'person-1'),
    ])).toBeNull();
  });

  it('detects whether a selected contact person is already linked to the selected company', () => {
    const links = [link('l1', 'customer-1', 'person-1')];

    expect(isContactLinkedToCustomer('person-1', 'customer-1', links)).toBe(true);
    expect(isContactLinkedToCustomer('person-1', 'customer-2', links)).toBe(false);
  });

  it('builds a warning when company and contact person are selected but no relation is maintained', () => {
    expect(buildMissingCustomerContactLinkWarning({
      customerId: 'customer-2',
      contactPersonId: 'person-1',
      customerContactPersons: [link('l1', 'customer-1', 'person-1')],
    })).toContain('nicht als Ansprechpartner verknüpft');
  });
});
