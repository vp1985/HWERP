import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate, useParams, Link } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { useAppStore } from '../context/AppStoreContext';
import { Customer } from '../lib/types';
import { uuid } from '../lib/utils';
import { useModalClose } from '../hooks/useModalClose';
import {
  DEFAULT_NUMBER_RANGES,
  EditableNumberRangeConfig,
  loadNumberRangesFromStorage,
  saveNumberRangesToStorage,
} from '../lib/numberRangeUtils';
import { listNumberCircles, type NumberCircle } from '../lib/numberCircles';
import { buildNextCustomerNumber, reserveNextCustomerNumber } from './customerNumbers';
import {
  buildNextSupplierNumber,
  hasCustomerRole,
  hasSupplierRole,
  normalizeCustomerRoles,
  reserveNextSupplierNumber,
  shouldAssignCustomerNumber,
  shouldAssignSupplierNumber,
} from './customerBusinessPartner';
import { CustomerFormErrors, validateCustomerForm } from './customerFormValidation';

export default function CustomerForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { dispatch, repository } = useAppStore();

  const [isLoading, setIsLoading] = useState(!!id);
  const [notFound, setNotFound] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [showDirtyConfirm, setShowDirtyConfirm] = useState(false);

  const [formData, setFormData] = useState<Omit<Customer, 'createdAt' | 'updatedAt'>>({
    id: id || uuid(),
    name: '',
    customerNumber: '',
    supplierNumber: '',
    roles: ['customer'],
    streetLine: '',
    postalCode: '',
    city: '',
    country: 'Deutschland',
    contactName: '',
    phone: '',
    email: '',
    notes: '',
  });

  const [errors, setErrors] = useState<CustomerFormErrors>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [numberRanges, setNumberRanges] = useState<EditableNumberRangeConfig[]>(() =>
    typeof window === 'undefined' ? DEFAULT_NUMBER_RANGES : loadNumberRangesFromStorage(),
  );
  const [numberCircles, setNumberCircles] = useState<NumberCircle[]>([]);
  const originalDataRef = useRef<string>('');

  // Load existing customer if editing
  useEffect(() => {
    async function loadCustomer() {
      if (!id) {
        setIsLoading(false);
        return;
      }

      try {
        const customer = await repository.get<Customer>('customers', id);
        if (!customer) {
          setNotFound(true);
        } else {
          setFormData({
            id: customer.id,
            name: customer.name,
            customerNumber: customer.customerNumber || '',
            supplierNumber: customer.supplierNumber || '',
            roles: normalizeCustomerRoles(customer.roles),
            streetLine: customer.streetLine || '',
            postalCode: customer.postalCode || '',
            city: customer.city || '',
            country: customer.country || 'Deutschland',
            contactName: customer.contactName || '',
            phone: customer.phone || '',
            email: customer.email || '',
            notes: customer.notes || '',
          });
          originalDataRef.current = JSON.stringify({
            name: customer.name,
            roles: normalizeCustomerRoles(customer.roles),
            supplierNumber: customer.supplierNumber || '',
            streetLine: customer.streetLine || '',
            postalCode: customer.postalCode || '',
            city: customer.city || '',
            country: customer.country || 'Deutschland',
            contactName: customer.contactName || '',
            phone: customer.phone || '',
            email: customer.email || '',
            notes: customer.notes || '',
          });
        }
      } catch (error) {
        console.error('Failed to load customer:', error);
        setNotFound(true);
      } finally {
        setIsLoading(false);
      }
    }

    loadCustomer();
  }, [id, repository]);

  useEffect(() => {
    let isMounted = true;

    listNumberCircles()
      .then((circles) => {
        if (isMounted) setNumberCircles(circles);
      })
      .catch((error) => {
        console.error('Failed to load number circles:', error);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Track dirty state
  useEffect(() => {
    const currentData = JSON.stringify({
      name: formData.name,
      roles: normalizeCustomerRoles(formData.roles),
      supplierNumber: formData.supplierNumber || '',
      streetLine: formData.streetLine || '',
      postalCode: formData.postalCode || '',
      city: formData.city || '',
      country: formData.country || 'Deutschland',
      contactName: formData.contactName,
      phone: formData.phone,
      email: formData.email,
      notes: formData.notes,
    });

    if (id) {
      setIsDirty(currentData !== originalDataRef.current);
    } else {
      // For new customer, dirty if any field has content
      setIsDirty(
        formData.name.trim() !== '' ||
        normalizeCustomerRoles(formData.roles).join('|') !== 'customer' ||
        formData.supplierNumber?.trim() !== '' ||
        formData.streetLine?.trim() !== '' ||
        formData.postalCode?.trim() !== '' ||
        formData.city?.trim() !== '' ||
        (formData.country || 'Deutschland').trim() !== 'Deutschland' ||
        formData.contactName?.trim() !== '' ||
        formData.phone?.trim() !== '' ||
        formData.email?.trim() !== '' ||
        formData.notes?.trim() !== ''
      );
    }
  }, [formData, id]);

  const handleChange = (
    field: keyof Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>,
    value: string
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if ((field === 'name' && errors.name) || (field === 'email' && errors.email)) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
    setSaveError(null);
  };

  const handleRoleChange = (role: 'customer' | 'supplier', checked: boolean) => {
    setFormData((prev) => {
      const nextRoles = new Set(normalizeCustomerRoles(prev.roles));
      if (checked) {
        nextRoles.add(role);
      } else {
        nextRoles.delete(role);
      }
      return { ...prev, roles: normalizeCustomerRoles(Array.from(nextRoles)) };
    });
    setSaveError(null);
  };

  const validate = (): boolean => {
    const newErrors = validateCustomerForm(formData);
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    setSaveError(null);
    setIsSaving(true);

    try {
      const now = new Date().toISOString();
      const roles = normalizeCustomerRoles(formData.roles);
      let nextNumberRanges = numberRanges;
      const reservedCustomerNumber = shouldAssignCustomerNumber(roles, formData.customerNumber)
        ? await reserveNextCustomerNumber()
        : null;
      const reservedSupplierNumber = shouldAssignSupplierNumber(roles, formData.supplierNumber)
        ? reserveNextSupplierNumber(nextNumberRanges)
        : null;
      if (reservedSupplierNumber) nextNumberRanges = reservedSupplierNumber.numberRanges;
      const customerData: Customer = {
        ...formData,
        name: formData.name.trim(),
        roles,
        customerNumber: (reservedCustomerNumber ?? formData.customerNumber?.trim()) || undefined,
        supplierNumber: (reservedSupplierNumber?.supplierNumber ?? formData.supplierNumber?.trim()) || undefined,
        streetLine: formData.streetLine?.trim() || undefined,
        postalCode: formData.postalCode?.trim() || undefined,
        city: formData.city?.trim() || undefined,
        country: formData.country?.trim() || 'Deutschland',
        contactName: formData.contactName?.trim(),
        phone: formData.phone?.trim(),
        email: formData.email?.trim(),
        notes: formData.notes?.trim(),
        createdAt: now, // Will be overridden by repo if updating
        updatedAt: now,
      };

      const savedCustomer = await repository.upsert<Customer>('customers', customerData);

      if (reservedSupplierNumber) {
        saveNumberRangesToStorage(nextNumberRanges);
        setNumberRanges(nextNumberRanges);
      }

      if (id) {
        dispatch({ type: 'UPDATE_ENTITY', entity: 'customers', data: savedCustomer });
      } else {
        dispatch({ type: 'ADD_ENTITY', entity: 'customers', data: savedCustomer });
      }

      navigate('/customers');
    } catch (error) {
      console.error('Failed to save customer:', error);
      setSaveError('Kunde konnte nicht gespeichert werden. Bitte erneut versuchen.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (isDirty) {
      setShowDirtyConfirm(true);
    } else {
      navigate('/customers');
    }
  };

  const confirmCancel = () => {
    navigate('/customers');
  };

  const handleCloseDirtyConfirm = useCallback(() => setShowDirtyConfirm(false), []);
  const handleDirtyConfirmBackdropClick = useModalClose(showDirtyConfirm, handleCloseDirtyConfirm);
  const customerRoles = normalizeCustomerRoles(formData.roles);
  const visibleCustomerNumber = hasCustomerRole(customerRoles)
    ? formData.customerNumber?.trim() || buildNextCustomerNumber(numberCircles)
    : 'Keine Kundenrolle aktiv';
  const visibleSupplierNumber = hasSupplierRole(customerRoles)
    ? formData.supplierNumber?.trim() || buildNextSupplierNumber(numberRanges)
    : 'Keine Lieferantenrolle aktiv';

  if (isLoading) {
    return (
      <div className="p-8">
        <h1 className="text-3xl font-bold mb-6">Kunde laden...</h1>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="p-8">
        <h1 className="text-3xl font-bold mb-6">Kunde nicht gefunden</h1>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <p className="text-gray-700 mb-4">
            Der gesuchte Kunde konnte nicht gefunden werden.
          </p>
          <Link
            to="/customers"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            <ArrowLeft size={20} />
            Zurück zur Liste
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <Link
          to="/customers"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft size={20} />
          Zurück zur Liste
        </Link>
        <h1 className="text-3xl font-bold">
          {id ? 'Kunde bearbeiten' : 'Neuer Kunde'}
        </h1>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6 max-w-2xl">
        <form noValidate onSubmit={handleSubmit}>
          <div className="mb-5 grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Kundennummer</p>
              <p className="mt-1 font-mono text-lg font-bold text-blue-950">{visibleCustomerNumber}</p>
              {hasCustomerRole(customerRoles) && !formData.customerNumber && (
                <p className="mt-1 text-xs text-blue-700">Wird beim Speichern aus dem Nummernkreis reserviert.</p>
              )}
            </div>
            <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">Lieferantennummer</p>
              <p className="mt-1 font-mono text-lg font-bold text-emerald-950">{visibleSupplierNumber}</p>
              {hasSupplierRole(customerRoles) && !formData.supplierNumber && (
                <p className="mt-1 text-xs text-emerald-700">Wird beim Speichern aus dem Nummernkreis reserviert.</p>
              )}
            </div>
          </div>

          <fieldset className="mb-5 rounded-lg border border-gray-200 p-4">
            <legend className="px-1 text-sm font-semibold text-gray-700">Funktionen</legend>
            <p className="mb-3 text-sm text-gray-500">
              Ein Geschäftspartner kann Kunde, Lieferant oder beides sein. Es wird kein zweiter Lieferanten-Datensatz angelegt.
            </p>
            <div className="flex flex-wrap gap-4">
              <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700">
                <input
                  type="checkbox"
                  checked={hasCustomerRole(customerRoles)}
                  onChange={(e) => handleRoleChange('customer', e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                Kunde
              </label>
              <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700">
                <input
                  type="checkbox"
                  checked={hasSupplierRole(customerRoles)}
                  onChange={(e) => handleRoleChange('supplier', e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                />
                Lieferant
              </label>
            </div>
          </fieldset>

          {/* Name (Required) */}
          <div className="mb-4">
            <label htmlFor="name" className="block text-sm font-semibold text-gray-700 mb-2">
              Name <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              id="name"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              className={`w-full px-4 py-2 border rounded focus:outline-none focus:ring-2 ${
                errors.name
                  ? 'border-red-500 focus:ring-red-500'
                  : 'border-gray-300 focus:ring-blue-500'
              }`}
              placeholder="Firma oder Name"
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-600">{errors.name}</p>
            )}
          </div>

          {/* Address */}
          <fieldset className="mb-4 rounded-lg border border-gray-200 p-4">
            <legend className="px-1 text-sm font-semibold text-gray-700">Adresse</legend>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="md:col-span-3">
                <label htmlFor="streetLine" className="block text-sm font-semibold text-gray-700 mb-2">
                  Straße + Hausnummer
                </label>
                <input
                  type="text"
                  id="streetLine"
                  value={formData.streetLine || ''}
                  onChange={(e) => handleChange('streetLine', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Musterstraße 12"
                />
              </div>
              <div>
                <label htmlFor="postalCode" className="block text-sm font-semibold text-gray-700 mb-2">
                  PLZ
                </label>
                <input
                  type="text"
                  id="postalCode"
                  value={formData.postalCode || ''}
                  onChange={(e) => handleChange('postalCode', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="26125"
                />
              </div>
              <div>
                <label htmlFor="city" className="block text-sm font-semibold text-gray-700 mb-2">
                  Ort
                </label>
                <input
                  type="text"
                  id="city"
                  value={formData.city || ''}
                  onChange={(e) => handleChange('city', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Oldenburg"
                />
              </div>
              <div>
                <label htmlFor="country" className="block text-sm font-semibold text-gray-700 mb-2">
                  Land
                </label>
                <input
                  type="text"
                  id="country"
                  value={formData.country || 'Deutschland'}
                  onChange={(e) => handleChange('country', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Deutschland"
                />
              </div>
            </div>
          </fieldset>

          {/* Contact Name */}
          <div className="mb-4">
            <label htmlFor="contactName" className="block text-sm font-semibold text-gray-700 mb-2">
              Kontaktperson
            </label>
            <input
              type="text"
              id="contactName"
              value={formData.contactName}
              onChange={(e) => handleChange('contactName', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Name der Kontaktperson"
            />
          </div>

          {/* Phone */}
          <div className="mb-4">
            <label htmlFor="phone" className="block text-sm font-semibold text-gray-700 mb-2">
              Telefon
            </label>
            <input
              type="tel"
              id="phone"
              value={formData.phone}
              onChange={(e) => handleChange('phone', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="+49 123 456789"
            />
          </div>

          {/* Email */}
          <div className="mb-4">
            <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-2">
              E-Mail
            </label>
            <input
              type="email"
              id="email"
              value={formData.email}
              onChange={(e) => handleChange('email', e.target.value)}
              aria-invalid={errors.email ? 'true' : undefined}
              aria-describedby={errors.email ? 'email-error' : undefined}
              className={`w-full px-4 py-2 border rounded focus:outline-none focus:ring-2 ${
                errors.email
                  ? 'border-red-500 focus:ring-red-500'
                  : 'border-gray-300 focus:ring-blue-500'
              }`}
              placeholder="mail@example.com"
            />
            {errors.email && (
              <p id="email-error" className="mt-1 text-sm text-red-600">{errors.email}</p>
            )}
          </div>

          {/* Notes */}
          <div className="mb-6">
            <label htmlFor="notes" className="block text-sm font-semibold text-gray-700 mb-2">
              Notizen
            </label>
            <textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Zusätzliche Informationen..."
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-3 justify-end">
            {saveError && (
              <p className="mr-auto text-sm text-red-600" role="alert">{saveError}</p>
            )}
            <button
              type="button"
              onClick={handleCancel}
              disabled={isSaving}
              className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {isSaving ? 'Speichern...' : 'Speichern'}
            </button>
          </div>
        </form>
      </div>

      {/* Dirty Confirm Dialog */}
      {showDirtyConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={handleDirtyConfirmBackdropClick}>
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">Änderungen verwerfen?</h2>
            <p className="text-gray-600 mb-6">
              Sie haben ungespeicherte Änderungen. Möchten Sie diese wirklich verwerfen?
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDirtyConfirm(false)}
                className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
              >
                Zurück
              </button>
              <button
                onClick={confirmCancel}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
              >
                Änderungen verwerfen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
