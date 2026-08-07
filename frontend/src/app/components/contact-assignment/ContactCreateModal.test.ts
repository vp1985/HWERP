import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const componentSource = () => readFileSync(resolve(__dirname, 'ContactCreateModal.tsx'), 'utf8');
const fieldSource = () => readFileSync(resolve(__dirname, 'ContactAssignmentField.tsx'), 'utf8');

describe('universal contact assignment components contract', () => {
  it('defines one reusable contact create modal with contextual defaults but no fixed contact role checkboxes', () => {
    const source = componentSource();

    expect(source).toContain('export type ContactCreateContext');
    expect(source).toContain("'invoiceRecipient'");
    expect(source).toContain("'operator'");
    expect(source).toContain("'mediator'");
    expect(source).toContain("'contactPerson'");
    expect(source).toContain('Firma');
    expect(source).toContain('Ansprechpartner');
    expect(source).toContain('Firma + Ansprechpartner');
    expect(source).toContain('onCreated');
    expect(source).toContain('customerContactPersons');
    expect(source).toContain('isPrimary');
    expect(source).not.toContain('istBetreiber');
    expect(source).not.toContain('istVermittler');
  });

  it('returns created company/contact IDs and immediately dispatches the created entities', () => {
    const source = componentSource();

    expect(source).toContain("repository.create<Customer>('customers'");
    expect(source).toContain("repository.create<ContactPerson>('contactPersons'");
    expect(source).toContain("repository.create<CustomerContactPerson>('customerContactPersons'");
    expect(source).toContain("dispatch({ type: 'ADD_ENTITY', entity: 'customers'");
    expect(source).toContain("dispatch({ type: 'ADD_ENTITY', entity: 'contactPersons'");
    expect(source).toContain("dispatch({ type: 'ADD_ENTITY', entity: 'customerContactPersons'");
    expect(source).toContain('onCreated({');
  });

  it('defines a reusable assignment field with autocomplete and a plus button for opening the universal modal', () => {
    const source = fieldSource();

    expect(source).toContain('export type ContactAssignmentOptionType');
    expect(source).toContain('role="combobox"');
    expect(source).toContain('onCreateNew');
    expect(source).toContain('Neu anlegen');
    expect(source).toContain('warning');
    expect(source).toContain('onWarningAction');
    expect(source).toContain('Verknüpfung erstellen');
  });
});
