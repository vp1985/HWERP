import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const customerFormSource = readFileSync(new URL('./CustomerForm.tsx', import.meta.url), 'utf8');
const customersSource = readFileSync(new URL('./Customers.tsx', import.meta.url), 'utf8');
const suppliersSource = readFileSync(new URL('./SuppliersPage.tsx', import.meta.url), 'utf8');
const typesSource = readFileSync(new URL('../lib/types.ts', import.meta.url), 'utf8');

describe('business partner UI contracts', () => {
  it('stores customer and supplier roles plus separate Lexoffice-compatible numbers on the shared Customer type', () => {
    expect(typesSource).toContain("CustomerRole = 'customer' | 'supplier'");
    expect(typesSource).toContain('roles?: CustomerRole[]');
    expect(typesSource).toContain('supplierNumber?: string');
    expect(typesSource).toContain('lexofficeVendorNumber?: string');
  });

  it('lets one customer form assign customer and supplier roles without a duplicate supplier form', () => {
    expect(customerFormSource).toContain('Funktionen');
    expect(customerFormSource).toContain('Kunde');
    expect(customerFormSource).toContain('Lieferant');
    expect(customerFormSource).toContain('visibleSupplierNumber');
    expect(customerFormSource).toContain('reserveNextSupplierNumber');
  });

  it('shows role and supplier-number columns in the existing customer table', () => {
    expect(customersSource).toContain('Rolle');
    expect(customersSource).toContain('Lieferantennr.');
    expect(customersSource).toContain('getCustomerRoleLabel');
    expect(customersSource).toContain('supplierNumber');
  });

  it('builds the Lieferanten page from shared customer rows with supplier role', () => {
    expect(suppliersSource).toContain("repository.list<Customer>('customers')");
    expect(suppliersSource).toContain('hasSupplierRole');
    expect(suppliersSource).toContain('supplierNumber');
  });

  it('lets Lieferantenanfrage maintain product categories and supplier capabilities', () => {
    expect(suppliersSource).toContain("repository.list<SupplierProductCategory>('supplierProductCategories')");
    expect(suppliersSource).toContain("repository.upsert<SupplierProductCategory>('supplierProductCategories'");
    expect(suppliersSource).toContain("repository.upsert<SupplierCapability>('supplierCapabilities'");
    expect(suppliersSource).toContain('findSupplierMatches');
    expect(suppliersSource).toContain('Kategorie hinzufügen');
    expect(suppliersSource).toContain('Fähigkeit hinzufügen');
  });
});
