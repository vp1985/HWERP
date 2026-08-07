import {
  type EditableNumberRangeConfig,
  SUPPLIER_NUMBER_RANGE_ID,
  buildNextNumber,
  findNumberRangeByIdOrLabel,
  reserveNextNumberFromRange,
} from '../lib/numberRangeUtils';
import { CustomerRole } from '../lib/types';

const SUPPLIER_NUMBER_RANGE_LABEL = 'Lieferantennummer';
const ROLE_ORDER: CustomerRole[] = ['customer', 'supplier'];

export function normalizeCustomerRoles(roles: CustomerRole[] | null | undefined): CustomerRole[] {
  const uniqueRoles = new Set<CustomerRole>();
  (roles ?? ['customer']).forEach((role) => {
    if (role === 'customer' || role === 'supplier') uniqueRoles.add(role);
  });
  if (uniqueRoles.size === 0) uniqueRoles.add('customer');
  return ROLE_ORDER.filter((role) => uniqueRoles.has(role));
}

export function hasCustomerRole(roles: CustomerRole[] | null | undefined): boolean {
  return normalizeCustomerRoles(roles).includes('customer');
}

export function hasSupplierRole(roles: CustomerRole[] | null | undefined): boolean {
  return normalizeCustomerRoles(roles).includes('supplier');
}

export function getCustomerRoleLabel(roles: CustomerRole[] | null | undefined): string {
  const normalized = normalizeCustomerRoles(roles);
  if (normalized.includes('customer') && normalized.includes('supplier')) return 'Kunde + Lieferant';
  if (normalized.includes('supplier')) return 'Lieferant';
  return 'Kunde';
}

export function buildNextSupplierNumber(numberRanges: EditableNumberRangeConfig[]): string {
  return buildNextNumber(
    findNumberRangeByIdOrLabel(numberRanges, SUPPLIER_NUMBER_RANGE_ID, SUPPLIER_NUMBER_RANGE_LABEL),
  );
}

export function reserveNextSupplierNumber(
  numberRanges: EditableNumberRangeConfig[],
): { supplierNumber: string; numberRanges: EditableNumberRangeConfig[] } {
  const reserved = reserveNextNumberFromRange(
    numberRanges,
    SUPPLIER_NUMBER_RANGE_ID,
    SUPPLIER_NUMBER_RANGE_LABEL,
  );
  return { supplierNumber: reserved.number, numberRanges: reserved.numberRanges };
}

export function shouldAssignCustomerNumber(
  roles: CustomerRole[] | null | undefined,
  currentCustomerNumber: string | null | undefined,
): boolean {
  return hasCustomerRole(roles) && !currentCustomerNumber?.trim();
}

export function shouldAssignSupplierNumber(
  roles: CustomerRole[] | null | undefined,
  currentSupplierNumber: string | null | undefined,
): boolean {
  return hasSupplierRole(roles) && !currentSupplierNumber?.trim();
}
