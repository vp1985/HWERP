import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { Edit2, Trash2, Calculator } from 'lucide-react';
import { useAppStore } from '../context/AppStoreContext';
import { Calculation, CalculationLineItem, Customer, Location, AssetNode } from '../lib/types';
import DevTooltip from '../components/DevTooltip';
import { DataTable, DataTableColumn } from '../components/ui/DataTable';
import { QuickViewModal } from '../components/QuickViewModal';
import { useModalClose } from '../hooks/useModalClose';

export default function Calculations() {
  const { state, dispatch, repository } = useAppStore();
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; number: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const [lineItems, setLineItems] = useState<CalculationLineItem[]>([]);
  const [selectedCalc, setSelectedCalc] = useState<Calculation | null>(null);
  const [showQuickView, setShowQuickView] = useState(false);

  // Daten beim Mount laden
  useEffect(() => {
    async function loadData() {
      try {
        const [calcs, custs, locs, assets, items] = await Promise.all([
          repository.list<Calculation>('calculations'),
          repository.list<Customer>('customers'),
          repository.list<Location>('locations'),
          repository.list<AssetNode>('assets'),
          repository.list<CalculationLineItem>('calculationLineItems'),
        ]);
        dispatch({ type: 'SET_ENTITIES', entity: 'calculations', data: calcs });
        dispatch({ type: 'SET_ENTITIES', entity: 'customers', data: custs });
        dispatch({ type: 'SET_ENTITIES', entity: 'locations', data: locs });
        dispatch({ type: 'SET_ENTITIES', entity: 'assets', data: assets });
        setLineItems(items);
      } catch (error) {
        console.error('Fehler beim Laden der Kalkulationen:', error);
        setLoadError(true);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [repository, dispatch]);

  const calculations = (state.calculations as Calculation[]) || [];
  const customers = (state.customers as Customer[]) || [];
  const locations = (state.locations as Location[]) || [];
  const assets = (state.assets as AssetNode[]) || [];

  // Lookup-Helfer
  const getCustomerName = (id: string | null) =>
    id ? customers.find((c) => c.id === id)?.name ?? null : null;

  const getLocationName = (id: string | null) =>
    id ? locations.find((l) => l.id === id)?.name ?? null : null;

  const getAssetName = (id: string | null) =>
    id ? assets.find((a) => a.id === id)?.name ?? null : null;

  const getCalcTotal = (calcId: string) =>
    lineItems
      .filter((li) => li.calculationId === calcId)
      .reduce((sum, li) => sum + li.totalPrice, 0);

  // Suche + Sortierung
  const filteredRows = useMemo(() => {
    let rows = [...calculations];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      rows = rows.filter(
        (c) =>
          c.number.toLowerCase().includes(q) ||
          (c.title && c.title.toLowerCase().includes(q))
      );
    }
    return rows.sort((a, b) => b.number.localeCompare(a.number));
  }, [calculations, searchQuery]);

  const handleCloseDeleteConfirm = useCallback(() => setDeleteConfirm(null), []);
  const handleDeleteBackdropClick = useModalClose(!!deleteConfirm, handleCloseDeleteConfirm);

  // Löschen
  const handleDelete = async (id: string) => {
    try {
      await repository.delete('calculations', id);
      dispatch({ type: 'DELETE_ENTITY', entity: 'calculations', id });
      setDeleteConfirm(null);
    } catch (error) {
      console.error('Fehler beim Löschen:', error);
    }
  };

  const columns: DataTableColumn<Calculation>[] = [
    {
      key: 'number',
      header: 'Nummer',
      width: 130,
      sortable: true,
      render: (r) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setSelectedCalc(r);
            setShowQuickView(true);
          }}
          className="font-mono font-bold text-blue-600 hover:text-blue-800 hover:underline transition-colors"
        >
          {r.number}
        </button>
      ),
    },
    {
      key: 'title',
      header: 'Titel',
      sortable: true,
      render: (r) =>
        r.title || <span className="text-gray-400 italic">Ohne Titel</span>,
    },
    {
      key: 'customer',
      header: 'Kunde',
      width: 200,
      sortable: true,
      render: (r) =>
        getCustomerName(r.customerId) || <span className="text-gray-400">—</span>,
    },
    {
      key: 'location',
      header: 'Standort',
      width: 180,
      render: (r) =>
        getLocationName(r.locationId) || <span className="text-gray-400">—</span>,
    },
    {
      key: 'asset',
      header: 'Asset',
      width: 180,
      render: (r) =>
        getAssetName(r.assetId) || <span className="text-gray-400">—</span>,
    },
    {
      key: 'status',
      header: 'Status',
      width: 100,
      align: 'center',
      render: (r) => (
        <span
          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
            r.status === 'ACTIVE'
              ? 'bg-green-100 text-green-700'
              : 'bg-gray-100 text-gray-600'
          }`}
        >
          {r.status === 'ACTIVE' ? 'Aktiv' : 'Entwurf'}
        </span>
      ),
    },
    {
      key: 'total',
      header: 'Summe',
      width: 130,
      align: 'right',
      render: (r) => {
        const total = getCalcTotal(r.id);
        return (
          <span className="font-mono font-semibold text-gray-900">
            {total.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
          </span>
        );
      },
    },
    {
      key: 'updatedAt',
      header: 'Aktualisiert',
      width: 120,
      sortable: true,
      render: (r) => new Date(r.updatedAt).toLocaleDateString('de-DE'),
    },
  ];

  return (
    <div className="container max-w-7xl mx-auto py-8 px-6">
      {/* Page Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Calculator size={32} className="text-blue-600" />
          <h1 className="text-3xl font-bold">Kalkulationen</h1>
          <DevTooltip
            text="DEV: Entity 'calculations' im Repo. Nummer via meta.nextCalcNumber (K-XXXXXX). Positionen über CalculationLineItems."
            placement="right"
          />
        </div>
        <p className="text-gray-600">
          Verwalten Sie Ihre Kalkulationen und erstellen Sie neue Angebote für Aufträge.
        </p>
      </div>

      {/* DataTable */}
      <DataTable
        title="Kalkulationen"
        primaryAction={{
          label: 'Neue Kalkulation',
          onClick: () => navigate('/calculations/new'),
        }}
        search={{
          value: searchQuery,
          onChange: setSearchQuery,
          placeholder: 'Nummer oder Titel suchen...',
        }}
        columns={columns}
        rows={filteredRows}
        rowKey={(r) => r.id}
        onRowClick={(r) => navigate(`/calculations/${r.id}`)}
        loading={isLoading}
        error={
          loadError
            ? { message: 'Kalkulationen konnten nicht geladen werden.' }
            : undefined
        }
        emptyState={{
          title: 'Keine Kalkulationen vorhanden',
          description: 'Erstellen Sie Ihre erste Kalkulation, um mit der Arbeit zu beginnen.',
          actionLabel: 'Jetzt erstellen',
          onAction: () => navigate('/calculations/new'),
        }}
        columnVisibility={{
          enabled: true,
          storageKey: 'datatable.calculations',
          defaultVisibleKeys: ['number', 'title', 'customer', 'status', 'total', 'updatedAt'],
          enableReordering: true,
        }}
        actions={(r) => (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/calculations/${r.id}`);
              }}
              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
              title="Bearbeiten"
            >
              <Edit2 size={14} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setDeleteConfirm({ id: r.id, number: r.number });
              }}
              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
              title="Löschen"
            >
              <Trash2 size={14} />
            </button>
          </>
        )}
      />

      {/* Quick View Modal */}
      <QuickViewModal
        open={showQuickView}
        title={selectedCalc ? `Kalkulation ${selectedCalc.number}` : 'Kalkulation'}
        onClose={() => {
          setShowQuickView(false);
          setSelectedCalc(null);
        }}
        maxWidth="700px"
      >
        {selectedCalc && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Titel</label>
                <div className="text-sm text-gray-900">
                  {selectedCalc.title || (
                    <span className="text-gray-400 italic">Ohne Titel</span>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
                <span
                  className={`inline-block px-2 py-1 rounded-full text-xs font-bold uppercase ${
                    selectedCalc.status === 'ACTIVE'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {selectedCalc.status === 'ACTIVE' ? 'Aktiv' : 'Entwurf'}
                </span>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Kunde</label>
                <div className="text-sm text-gray-900">
                  {getCustomerName(selectedCalc.customerId) || (
                    <span className="text-gray-400 italic">Nicht zugewiesen</span>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Standort</label>
                <div className="text-sm text-gray-900">
                  {getLocationName(selectedCalc.locationId) || (
                    <span className="text-gray-400 italic">Nicht zugewiesen</span>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Asset</label>
                <div className="text-sm text-gray-900">
                  {getAssetName(selectedCalc.assetId) || (
                    <span className="text-gray-400 italic">Nicht zugewiesen</span>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Summe</label>
                <div className="text-sm font-mono font-semibold text-gray-900">
                  {getCalcTotal(selectedCalc.id).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Aktualisiert</label>
                <div className="text-sm text-gray-900">
                  {new Date(selectedCalc.updatedAt).toLocaleDateString('de-DE', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              </div>
            </div>

            {selectedCalc.description && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Beschreibung</label>
                <div className="text-sm text-gray-700 p-3 bg-gray-50 rounded border border-gray-200">
                  {selectedCalc.description}
                </div>
              </div>
            )}

            <div className="pt-3 border-t border-gray-200">
              <button
                onClick={() => {
                  setShowQuickView(false);
                  navigate(`/calculations/${selectedCalc.id}`);
                }}
                className="w-full px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                Kalkulation öffnen
              </button>
            </div>
          </div>
        )}
      </QuickViewModal>

      {/* Lösch-Bestätigung */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={handleDeleteBackdropClick}>
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">Kalkulation löschen?</h2>
            <p className="text-gray-600 mb-2">
              Möchten Sie die Kalkulation{' '}
              <strong>{deleteConfirm.number}</strong> wirklich löschen?
            </p>
            <p className="text-sm text-orange-700 mb-6">
              Achtung: Löschen entfernt die Kalkulation dauerhaft (MVP).
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Abbrechen
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm.id)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Löschen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
