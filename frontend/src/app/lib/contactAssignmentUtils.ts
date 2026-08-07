import type { CustomerContactPerson } from './types';

export function resolvePrimaryCustomerForContact(
  contactPersonId: string,
  customerContactPersons: CustomerContactPerson[],
): string | null {
  const links = customerContactPersons.filter((link) => link.contactPersonId === contactPersonId);
  if (links.length === 0) return null;
  if (links.length === 1) return links[0].customerId;
  const primary = links.find((link) => link.isPrimary);
  return primary?.customerId ?? null;
}

export function isContactLinkedToCustomer(
  contactPersonId: string,
  customerId: string,
  customerContactPersons: CustomerContactPerson[],
): boolean {
  if (!contactPersonId || !customerId) return false;
  return customerContactPersons.some((link) => link.contactPersonId === contactPersonId && link.customerId === customerId);
}

export function buildMissingCustomerContactLinkWarning({
  customerId,
  contactPersonId,
  customerContactPersons,
}: {
  customerId: string;
  contactPersonId: string;
  customerContactPersons: CustomerContactPerson[];
}): string | null {
  if (!customerId || !contactPersonId) return null;
  if (isContactLinkedToCustomer(contactPersonId, customerId, customerContactPersons)) return null;
  return 'Dieser Ansprechpartner ist nicht als Ansprechpartner verknüpft mit dieser Firma.';
}
