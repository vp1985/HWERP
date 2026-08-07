import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router';
import { Plus, Search, Pencil, Trash2 } from 'lucide-react';
import { useAppStore } from '../context/AppStoreContext';
import { Customer } from '../lib/types';
import { useModalClose } from '../hooks/useModalClose';
import { getCustomerRoleLabel, hasSupplierRole } from './customerBusinessPartner';

export default function Customers() {
  const { state, dispatch, repository } = useAppStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [storageDebug, setStorageDebug] = useState<string | null>(null);

  // Load customers on mount
  useEffect(() => {
    async function loadCustomers() {
      try {
        const customers = await repository.list<Customer>('customers');
        dispatch({ type: 'SET_ENTITIES', entity: 'customers', data: customers });
      } catch (error) {
        console.error('Failed to load customers:', error);
      } finally {
        setIsLoading(false);
      }
    }
    loadCustomers();
  }, [repository, dispatch]);

  const customers = state.customers as Customer[];

  // Filter customers based on search query
  const filteredCustomers = customers.filter((customer) => {
    const query = searchQuery.toLowerCase();
    return (
      customer.customerNumber?.toLowerCase().includes(query) ||
      customer.supplierNumber?.toLowerCase().includes(query) ||
      customer.name.toLowerCase().includes(query) ||
      customer.contactName?.toLowerCase().includes(query) ||
      customer.email?.toLowerCase().includes(query)
    );
  });

  const handleCloseDeleteConfirm = useCallback(() => setDeleteConfirm(null), []);
  const handleDeleteBackdropClick = useModalClose(!!deleteConfirm, handleCloseDeleteConfirm);

  const handleDelete = async (id: string) => {
    try {
      await repository.delete('customers', id);
      dispatch({ type: 'DELETE_ENTITY', entity: 'customers', id });
      setDeleteConfirm(null);
    } catch (error) {
      console.error('Failed to delete customer:', error);
    }
  };

  // DEBUG: Check localStorage
  const checkStorage = () => {
    const raw = localStorage.getItem('hwerp');
    if (raw) {
      setStorageDebug(`✅ LocalStorage EXISTS (${raw.length} bytes)`);
    } else {
      setStorageDebug('❌ LocalStorage is NULL');
    }
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <h1 className="text-3xl font-bold mb-6">Kunden</h1>
        <p className="text-gray-600">Laden...</p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Kunden</h1>
        <Link
          to="/customers/new"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          <Plus size={20} />
          Neuer Kunde
        </Link>
      </div>

      {customers.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-12 text-center">
          <p className="text-gray-600 mb-4">Noch keine Kunden</p>
          <Link
            to="/customers/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            <Plus size={20} />
            Neuer Kunde
          </Link>
        </div>
      ) : (
        <>
          {/* Search */}
          <div className="mb-4">
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                size={20}
              />
              <input
                type="text"
                placeholder="Suche nach Kunden-/Lieferantennr., Name, Kontakt oder E-Mail..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Table */}
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                    Kundennr.
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                    Lieferantennr.
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                    Rolle
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                    Kontakt
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                    Telefon
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                    E-Mail
                  </th>
                  <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">
                    Aktionen
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredCustomers.map((customer) => (
                  <tr
                    key={customer.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-6 py-4 font-mono text-sm text-gray-700">
                      {customer.customerNumber || '-'}
                    </td>
                    <td className="px-6 py-4 font-mono text-sm text-gray-700">
                      {customer.supplierNumber || '-'}
                    </td>
                    <td className="px-6 py-4">
                      <Link
                        to={`/customers/${customer.id}`}
                        className="text-blue-600 hover:text-blue-800 font-medium"
                      >
                        {customer.name}
                      </Link>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                        hasSupplierRole(customer.roles)
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-blue-50 text-blue-700'
                      }`}>
                        {getCustomerRoleLabel(customer.roles)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-700">
                      {customer.contactName || '-'}
                    </td>
                    <td className="px-6 py-4 text-gray-700">
                      {customer.phone || '-'}
                    </td>
                    <td className="px-6 py-4 text-gray-700">
                      {customer.email || '-'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          to={`/customers/${customer.id}`}
                          className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Bearbeiten"
                        >
                          <Pencil size={18} />
                        </Link>
                        <button
                          onClick={() => setDeleteConfirm(customer.id)}
                          className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Löschen"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredCustomers.length === 0 && searchQuery && (
            <div className="mt-4 text-center text-gray-600">
              Keine Kunden gefunden für "{searchQuery}"
            </div>
          )}
        </>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={handleDeleteBackdropClick}>
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">Kunde löschen?</h2>
            <p className="text-gray-600 mb-6">
              Möchten Sie diesen Kunden wirklich löschen? Diese Aktion kann nicht
              rückgängig gemacht werden.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
              >
                Abbrechen
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
              >
                Löschen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DEBUG: Check localStorage */}
      <div className="mt-8">
        <button
          onClick={checkStorage}
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
        >
          Check LocalStorage
        </button>
        {storageDebug && (
          <p className="mt-2 text-sm" style={{ color: storageDebug.startsWith('✅') ? 'green' : 'red' }}>
            {storageDebug}
          </p>
        )}
      </div>
    </div>
  );
}
