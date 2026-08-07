import { FormEvent, useMemo, useState } from 'react';
import { useAppStore } from '../../context/AppStoreContext';
import type { ContactPerson, Customer, CustomerContactPerson } from '../../lib/types';

export type ContactCreateContext = 'invoiceRecipient' | 'operator' | 'mediator' | 'contactPerson' | 'switchingContactPerson';
export type ContactCreateMode = 'company' | 'person' | 'companyContact';

export interface ContactCreateResult {
  context: ContactCreateContext;
  customerId?: string;
  contactPersonId?: string;
  customerContactPersonId?: string;
}

const emptyForm = {
  mode: 'companyContact' as ContactCreateMode,
  companyName: '',
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  role: '',
  isPrimary: true,
};

const contextLabels: Record<ContactCreateContext, string> = {
  invoiceRecipient: 'Rechnungsempfänger',
  operator: 'Betreiber',
  mediator: 'Vermittler',
  contactPerson: 'Ansprechpartner',
  switchingContactPerson: 'Ansprechpartner Schalthandlung',
};

function newId(_prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  const randomHex = (length: number) => Array.from({ length }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  return `${randomHex(8)}-${randomHex(4)}-4${randomHex(3)}-${(8 + Math.floor(Math.random() * 4)).toString(16)}${randomHex(3)}-${randomHex(12)}`;
}

export function ContactCreateModal({
  isOpen,
  context,
  defaultCustomerId = '',
  onClose,
  onCreated,
}: {
  isOpen: boolean;
  context: ContactCreateContext;
  defaultCustomerId?: string;
  onClose: () => void;
  onCreated: (result: ContactCreateResult) => void;
}) {
  const { state, dispatch, repository } = useAppStore();
  const [form, setForm] = useState({ ...emptyForm, role: contextLabels[context] });
  const customers = (state.customers as Customer[]) || [];
  const customerContactPersons = (state.customerContactPersons as CustomerContactPerson[]) || [];

  const defaultCustomer = useMemo(
    () => customers.find((customer) => customer.id === defaultCustomerId) ?? null,
    [customers, defaultCustomerId],
  );

  if (!isOpen) return null;

  const close = () => {
    setForm({ ...emptyForm, role: contextLabels[context] });
    onClose();
  };

  const create = async (event: FormEvent) => {
    event.preventDefault();
    const now = new Date().toISOString();
    let savedCustomer: Customer | null = null;
    let savedContact: ContactPerson | null = null;
    let savedLink: CustomerContactPerson | null = null;

    if (form.mode !== 'person') {
      const companyName = form.companyName.trim() || defaultCustomer?.name || '';
      if (!companyName) return;
      const customer: Customer = {
        id: defaultCustomer?.id ?? newId('customer'),
        name: companyName,
        roles: defaultCustomer?.roles ?? ['customer'],
        streetLine: defaultCustomer?.streetLine,
        postalCode: defaultCustomer?.postalCode,
        city: defaultCustomer?.city,
        country: defaultCustomer?.country ?? 'Deutschland',
        contactName: defaultCustomer?.contactName,
        phone: defaultCustomer?.phone,
        email: defaultCustomer?.email,
        notes: defaultCustomer?.notes,
        createdAt: defaultCustomer?.createdAt ?? now,
        updatedAt: now,
      };
      savedCustomer = defaultCustomer ? await repository.update<Customer>('customers', customer.id, customer) : await repository.create<Customer>('customers', customer);
      if (defaultCustomer) {
        dispatch({ type: 'UPDATE_ENTITY', entity: 'customers', data: savedCustomer });
      } else {
        dispatch({ type: 'ADD_ENTITY', entity: 'customers', data: savedCustomer });
      }
    }

    if (form.mode !== 'company') {
      const lastName = form.lastName.trim();
      if (!lastName) return;
      const contactPerson: ContactPerson = {
        id: newId('contact'),
        firstName: form.firstName.trim(),
        lastName,
        role: form.role.trim() || contextLabels[context],
        email: form.email.trim() || null,
        phone1: form.phone.trim() || null,
        phone2: null,
        phone3: null,
        birthday: null,
        personalNotes: null,
        tagIds: [],
        createdAt: now,
        updatedAt: now,
      };
      savedContact = await repository.create<ContactPerson>('contactPersons', contactPerson);
      dispatch({ type: 'ADD_ENTITY', entity: 'contactPersons', data: savedContact });
    }

    if (savedCustomer && savedContact) {
      const hasPrimaryForContact = customerContactPersons.some((link) => link.contactPersonId === savedContact!.id && link.isPrimary);
      const customerContactPerson: CustomerContactPerson = {
        id: newId('customer-contact'),
        customerId: savedCustomer.id,
        contactPersonId: savedContact.id,
        isPrimary: form.isPrimary || !hasPrimaryForContact,
        createdAt: now,
        updatedAt: now,
      };
      savedLink = await repository.create<CustomerContactPerson>('customerContactPersons', customerContactPerson);
      dispatch({ type: 'ADD_ENTITY', entity: 'customerContactPersons', data: savedLink });
    }

    onCreated({
      context,
      customerId: savedCustomer?.id,
      contactPersonId: savedContact?.id,
      customerContactPersonId: savedLink?.id,
    });
    close();
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-black/50 px-4 py-10" onClick={close}>
      <div role="dialog" aria-modal="true" aria-labelledby="contact-create-title" className="w-full max-w-3xl rounded-2xl bg-white p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 id="contact-create-title" className="text-lg font-semibold text-gray-900">Kontakt anlegen</h2>
            <p className="text-sm text-gray-500">Kontext: {contextLabels[context]} – der Kontakt wird danach direkt ausgewählt.</p>
          </div>
          <button type="button" aria-label="Kontakt-Modal schließen" onClick={close} className="rounded-full px-2 py-1 text-xl leading-none text-gray-400 hover:bg-gray-100 hover:text-gray-700">×</button>
        </div>

        <form onSubmit={create} className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-3">
            {([
              ['company', 'Firma'],
              ['person', 'Ansprechpartner'],
              ['companyContact', 'Firma + Ansprechpartner'],
            ] as const).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                onClick={() => setForm({ ...form, mode })}
                className={`rounded-xl border px-3 py-2 text-sm font-semibold ${form.mode === mode ? 'border-blue-500 bg-blue-50 text-blue-800' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
              >
                {label}
              </button>
            ))}
          </div>

          {form.mode !== 'person' && (
            <input className="w-full rounded-lg border px-3 py-2 text-sm" placeholder="Firmenname" value={form.companyName || defaultCustomer?.name || ''} onChange={(event) => setForm({ ...form, companyName: event.target.value })} />
          )}

          {form.mode !== 'company' && (
            <div className="space-y-2 rounded-xl border bg-gray-50 p-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <input className="w-full rounded-lg border px-3 py-2 text-sm" placeholder="Vorname" value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} />
                <input className="w-full rounded-lg border px-3 py-2 text-sm" placeholder="Nachname" value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} required />
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <input className="w-full rounded-lg border px-3 py-2 text-sm" placeholder="E-Mail" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
                <input className="w-full rounded-lg border px-3 py-2 text-sm" placeholder="Telefon" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
              </div>
              <input className="w-full rounded-lg border px-3 py-2 text-sm" placeholder="Rolle / Notiz" value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })} />
              {form.mode === 'companyContact' && (
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={form.isPrimary} onChange={(event) => setForm({ ...form, isPrimary: event.target.checked })} />
                  Hauptfirma für diesen Ansprechpartner setzen
                </label>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <button type="button" onClick={close} className="flex-1 rounded-lg border px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Abbrechen</button>
            <button type="submit" className="flex-1 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700">Anlegen & auswählen</button>
          </div>
        </form>
      </div>
    </div>
  );
}
