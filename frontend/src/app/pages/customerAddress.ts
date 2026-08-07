import type { Customer } from '../lib/types';

export function formatCustomerAddress(customer: Pick<Customer, 'streetLine' | 'postalCode' | 'city' | 'country'> | null | undefined): string {
  if (!customer) return '';
  const cityLine = [customer.postalCode, customer.city].filter(Boolean).join(' ');
  return [customer.streetLine, cityLine, customer.country].filter(Boolean).join('\n');
}
