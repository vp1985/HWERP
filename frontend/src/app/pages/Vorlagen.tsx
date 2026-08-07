import { useState, useMemo } from 'react';
import { Edit2, Trash2, Loader2, Power, XCircle, RefreshCcw, FileText, PlusCircle, Filter, X, Eye, EyeOff, Shield } from 'lucide-react';
import { DataTable, DataTableColumn } from '../components/ui/DataTable';
import { Money } from '../components/ui/Money';
import DevTooltip from '../components/DevTooltip';
import { usePriceVisibility, rolePermissions } from '../context/PriceVisibilityContext';
import { QuickViewModal } from '../components/QuickViewModal';

type Role = 'Admin' | 'Projektleiter' | 'GF-Assistenz' | 'Servicetechniker' | 'Lagerist' | 'Helfer';

export default function Vorlagen() {
  const [demoSearch, setDemoSearch] = useState('');
  const [demoLoading, setDemoLoading] = useState(false);
  const [demoEmpty, setDemoEmpty] = useState(false);
  const [demoError, setDemoError] = useState(false);

  // Filter State
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [showTagFilter, setShowTagFilter] = useState(false);
  const [showStatusFilter, setShowStatusFilter] = useState(false);

  // Quick View Modal State
  const [selectedCalculation, setSelectedCalculation] = useState<any | null>(null);
  const [showQuickView, setShowQuickView] = useState(false);

  // Role & Permissions from global context
  const {
    currentRole,
    setCurrentRole,
    hidePrices,
    setHidePrices,
    revealPrices,
    setRevealPrices,
    permissions
  } = usePriceVisibility();

  // Alle verfügbaren Tags und Statuses aus den Daten extrahieren
  const availableTags = useMemo(() => {
    const tagSet = new Set<string>();
    const addTags = (rows: any[]) => {
      rows.forEach(r => {
        r.tags?.forEach((t: string) => tagSet.add(t));
        if (r.children) addTags(r.children);
      });
    };
    // Temporär alle Rows generieren um Tags zu sammeln
    const allRows = Array.from({ length: 10 }, (_, i) => ({
      tags: i % 2 === 0 ? ['Wartung', 'Hochspannung', 'Dringend'] : ['Prüfung', 'Standard'],
      children: i % 3 === 0 ? [
        { tags: ['Sub-Task'] },
        { tags: ['Detail'] },
      ] : undefined,
    }));
    addTags(allRows);
    return Array.from(tagSet).sort();
  }, []);

  const availableStatuses = ['Aktiv', 'Entwurf'];

  const demoRows = useMemo(() => {
    if (demoEmpty) return [];

    const rows = Array.from({ length: 10 }, (_, i) => ({
      id: `demo-${i + 1}`,
      number: `K-000${(123 + i).toString().padStart(3, '0')}`,
      name: i % 2 === 0 ? `Umspannwerk Hafen West - Sektor ${i + 1}` : `Wartung Trafo Station ${i + 1} Nord-Ost Gel\u00e4nde`,
      customer: i % 3 === 0 ? 'Stadtwerke Nord' : i % 3 === 1 ? 'Energie AG S\u00fcd' : 'Netzbetreiber West',
      status: i % 4 === 0 ? 'Aktiv' : 'Entwurf',
      updatedAt: new Date(Date.now() - i * 86400000).toISOString(),
      tags: i % 2 === 0 ? ['Wartung', 'Hochspannung', 'Dringend'] : ['Pr\u00fcfung', 'Standard'],
      unitPrice: 150.00 + i * 10,
      total: 1500.00 + i * 150,
      children: i % 3 === 0 ? [
        {
          id: `demo-${i + 1}-1`,
          number: `K-000${(123 + i).toString().padStart(3, '0')}-1`,
          name: `Unterprojekt A - Transformator`,
          customer: i % 3 === 0 ? 'Stadtwerke Nord' : 'Netzbetreiber West',
          status: 'Aktiv',
          updatedAt: new Date(Date.now() - i * 86400000 - 86400000).toISOString(),
          tags: ['Sub-Task'],
          unitPrice: 120.00 + i * 5,
          total: 800.00 + i * 80,
          children: [
            {
              id: `demo-${i + 1}-1-1`,
              number: `K-000${(123 + i).toString().padStart(3, '0')}-1-1`,
              name: `Detail-Aufgabe Wicklung`,
              customer: i % 3 === 0 ? 'Stadtwerke Nord' : 'Netzbetreiber West',
              status: 'Entwurf',
              updatedAt: new Date(Date.now() - i * 86400000 - 172800000).toISOString(),
              tags: ['Detail'],
              unitPrice: 80.00 + i * 3,
              total: 400.00 + i * 40,
            },
          ],
        },
        {
          id: `demo-${i + 1}-2`,
          number: `K-000${(123 + i).toString().padStart(3, '0')}-2`,
          name: `Unterprojekt B - Schaltanlage`,
          customer: i % 3 === 0 ? 'Stadtwerke Nord' : 'Netzbetreiber West',
          status: 'Entwurf',
          updatedAt: new Date(Date.now() - i * 86400000 - 172800000).toISOString(),
          tags: ['Sub-Task'],
          unitPrice: 110.00 + i * 4,
          total: 700.00 + i * 70,
        },
      ] : undefined,
    }));

    // Filter-Logik anwenden
    let filteredRows = rows;

    // Such-Filter
    if (demoSearch) {
      const q = demoSearch.toLowerCase();
      filteredRows = filteredRows.filter(r =>
        r.number.toLowerCase().includes(q) ||
        r.name.toLowerCase().includes(q) ||
        r.customer.toLowerCase().includes(q)
      );
    }

    // Tags-Filter
    if (selectedTags.length > 0) {
      filteredRows = filteredRows.filter(r =>
        selectedTags.some(tag => r.tags.includes(tag))
      );
    }

    // Status-Filter
    if (selectedStatuses.length > 0) {
      filteredRows = filteredRows.filter(r =>
        selectedStatuses.includes(r.status)
      );
    }

    return filteredRows;
  }, [demoEmpty, demoSearch, selectedTags, selectedStatuses]);

  // Toggle Tag-Auswahl
  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  // Toggle Status-Auswahl
  const toggleStatus = (status: string) => {
    setSelectedStatuses(prev =>
      prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
    );
  };

  // Filter zurücksetzen
  const resetFilters = () => {
    setSelectedTags([]);
    setSelectedStatuses([]);
  };

  // Aktive Filter zählen
  const activeFilterCount = selectedTags.length + selectedStatuses.length;

  // Base columns (always visible)
  const baseColumns: DataTableColumn<any>[] = [
    {
      key: 'number',
      header: 'Nummer',
      width: 120,
      sortable: true,
      render: (r) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setSelectedCalculation(r);
            setShowQuickView(true);
          }}
          className="font-mono font-bold text-blue-600 hover:text-blue-800 hover:underline transition-colors"
        >
          {r.number}
        </button>
      )
    },
    { key: 'name', header: 'Name', sortable: true, render: (r) => r.name },
    { key: 'customer', header: 'Kunde', width: 180, sortable: true, render: (r) => r.customer },
    {
      key: 'status',
      header: 'Status',
      width: 100,
      align: 'center',
      render: (r) => (
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${r.status === 'Aktiv' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
          {r.status}
        </span>
      )
    },
    {
      key: 'tags',
      header: 'Tags',
      width: 180,
      render: (r) => (
        <div className="flex flex-wrap gap-1">
          {r.tags.slice(0, 2).map((t: string) => (
            <span key={t} className="px-1.5 py-0.5 bg-blue-50 text-blue-600 text-[10px] rounded border border-blue-100">{t}</span>
          ))}
          {r.tags.length > 2 && <span className="text-[10px] text-gray-400">+{r.tags.length - 2}</span>}
        </div>
      )
    },
    { key: 'updatedAt', header: 'Aktualisiert', width: 120, sortable: true, render: (r) => new Date(r.updatedAt).toLocaleDateString('de-DE') },
  ];

  // Price columns (only if can_view_prices=true)
  const priceColumns: DataTableColumn<any>[] = [
    {
      key: 'unitPrice',
      header: 'Einzelpreis',
      width: 120,
      align: 'right',
      sortable: true,
      render: (r) => <Money value={r.unitPrice} hidden={hidePrices} reveal={revealPrices} />
    },
    {
      key: 'total',
      header: 'Gesamt',
      width: 120,
      align: 'right',
      sortable: true,
      render: (r) => <Money value={r.total} hidden={hidePrices} reveal={revealPrices} />
    },
  ];

  // DEV: Rechte filtern Spalten vor dem Chooser
  const demoColumns = permissions.can_view_prices
    ? [...baseColumns, ...priceColumns]
    : baseColumns;

  // DEV: Spaltenauswahl basierend auf Rechten
  const defaultVisibleKeys = permissions.can_view_prices
    ? ['number', 'name', 'customer', 'status', 'total', 'updatedAt']
    : ['number', 'name', 'customer', 'status', 'updatedAt'];

  return (
    <div className="container max-w-7xl mx-auto py-8 px-6">
      {/* Page Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <FileText size={32} className="text-blue-600" />
          <h1 className="text-3xl font-bold">Vorlagen</h1>
        </div>
        <p className="text-gray-600">
          Verwalten Sie Ihre Kalkulationsvorlagen und erstellen Sie neue Vorlagen f\u00fcr wiederkehrende Auftr\u00e4ge.
        </p>
      </div>

      {/* Role Selector */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Shield size={20} className="text-blue-600" />
          <h2 className="text-xl font-bold">Rolle & Berechtigungen</h2>
          <DevTooltip
            text="DEV: \u00c4ndere die Rolle, um Preissichtbarkeit zu testen. Spalten werden automatisch gefiltert basierend auf Rechten."
            placement="right"
          />
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* Role Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Aktuelle Rolle</label>
            <select
              value={currentRole}
              onChange={(e) => setCurrentRole(e.target.value as Role)}
              className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {Object.keys(rolePermissions).map((role) => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>
          </div>

          {/* Permission Display */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Berechtigungen</label>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${permissions.can_view_prices ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-sm text-gray-600">
                  Preise anzeigen: <strong>{permissions.can_view_prices ? 'Ja' : 'Nein'}</strong>
                </span>
              </div>
              {permissions.can_view_prices && (
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${permissions.hide_prices_default ? 'bg-orange-500' : 'bg-green-500'}`} />
                  <span className="text-sm text-gray-600">
                    Standard ausgeblendet: <strong>{permissions.hide_prices_default ? 'Ja' : 'Nein'}</strong>
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Price Toggle (only wenn can_view_prices=true) */}
        {permissions.can_view_prices && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">Preise maskieren</label>
                <button
                  onClick={() => setHidePrices(!hidePrices)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${hidePrices ? 'bg-blue-600' : 'bg-gray-200'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${hidePrices ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Eye-Press zum Einblenden:</span>
                <button
                  onPointerDown={() => setRevealPrices(true)}
                  onPointerUp={() => setRevealPrices(false)}
                  onPointerLeave={() => setRevealPrices(false)}
                  className={`p-2 rounded-lg transition-colors ${revealPrices ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                  title="Halten um Preise anzuzeigen"
                >
                  {revealPrices ? <Eye size={16} /> : <EyeOff size={16} />}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* DataTable Demo Section */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <RefreshCcw size={20} className="text-blue-600" />
            <h2 className="text-xl font-bold">Demo-Tabelle</h2>
            <DevTooltip
              text="DEV: Referenz-Implementierung der neuen DataTable-Komponente. Dient als Blaupause f\u00fcr die Vereinheitlichung aller Tabellen in HWERP."
              placement="right"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setDemoLoading(!demoLoading)}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-lg transition-colors border ${demoLoading ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
            >
              <Loader2 size={12} className={demoLoading ? 'animate-spin' : ''} />
              Loading
            </button>
            <button
              onClick={() => setDemoEmpty(!demoEmpty)}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-lg transition-colors border ${demoEmpty ? 'bg-orange-600 text-white border-orange-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
            >
              <Power size={12} />
              Empty
            </button>
            <button
              onClick={() => setDemoError(!demoError)}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-lg transition-colors border ${demoError ? 'bg-red-600 text-white border-red-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
            >
              <XCircle size={12} />
              Error
            </button>
          </div>
        </div>

        {/* Filter Section */}
        <div className="mb-4 flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Filter:</span>
          </div>

          {/* Tags Filter */}
          <div className="relative">
            <button
              onClick={() => {
                setShowTagFilter(!showTagFilter);
                setShowStatusFilter(false);
              }}
              className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg transition-colors border ${
                selectedTags.length > 0
                  ? 'bg-blue-50 border-blue-300 text-blue-700 font-medium'
                  : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span>Tags</span>
              {selectedTags.length > 0 && (
                <span className="px-1.5 py-0.5 bg-blue-600 text-white text-xs rounded-full font-bold">
                  {selectedTags.length}
                </span>
              )}
            </button>

            {showTagFilter && (
              <>
                <div
                  className="fixed inset-0 z-20"
                  onClick={() => setShowTagFilter(false)}
                />
                <div className="absolute top-full left-0 mt-2 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-30 py-2">
                  <div className="px-3 py-2 border-b border-gray-100">
                    <h3 className="text-xs font-bold text-gray-700 uppercase">Tags filtern</h3>
                  </div>
                  <div className="max-h-64 overflow-y-auto py-1">
                    {availableTags.map((tag) => (
                      <label
                        key={tag}
                        className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedTags.includes(tag)}
                          onChange={() => toggleTag(tag)}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">{tag}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Status Filter */}
          <div className="relative">
            <button
              onClick={() => {
                setShowStatusFilter(!showStatusFilter);
                setShowTagFilter(false);
              }}
              className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg transition-colors border ${
                selectedStatuses.length > 0
                  ? 'bg-green-50 border-green-300 text-green-700 font-medium'
                  : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span>Status</span>
              {selectedStatuses.length > 0 && (
                <span className="px-1.5 py-0.5 bg-green-600 text-white text-xs rounded-full font-bold">
                  {selectedStatuses.length}
                </span>
              )}
            </button>

            {showStatusFilter && (
              <>
                <div
                  className="fixed inset-0 z-20"
                  onClick={() => setShowStatusFilter(false)}
                />
                <div className="absolute top-full left-0 mt-2 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-30 py-2">
                  <div className="px-3 py-2 border-b border-gray-100">
                    <h3 className="text-xs font-bold text-gray-700 uppercase">Status filtern</h3>
                  </div>
                  <div className="max-h-64 overflow-y-auto py-1">
                    {availableStatuses.map((status) => (
                      <label
                        key={status}
                        className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedStatuses.includes(status)}
                          onChange={() => toggleStatus(status)}
                          className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-2 focus:ring-green-500"
                        />
                        <span className="text-sm text-gray-700">{status}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Reset Filter Button */}
          {activeFilterCount > 0 && (
            <button
              onClick={resetFilters}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
              title="Filter zur\u00fccksetzen"
            >
              <X size={14} />
              <span>Zur\u00fccksetzen ({activeFilterCount})</span>
            </button>
          )}

          {/* Active Filter Display */}
          {activeFilterCount > 0 && (
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-xs text-gray-500">Aktive Filter:</span>
              {selectedTags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-md"
                >
                  {tag}
                  <button
                    onClick={() => toggleTag(tag)}
                    className="hover:text-blue-900"
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
              {selectedStatuses.map((status) => (
                <span
                  key={status}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 text-xs rounded-md"
                >
                  {status}
                  <button
                    onClick={() => toggleStatus(status)}
                    className="hover:text-green-900"
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <DataTable
          title="Demo Kalkulationen"
          primaryAction={{
            label: "Kalkulation erstellen",
            onClick: () => console.log("Primary Action: Create")
          }}
          search={{
            value: demoSearch,
            onChange: setDemoSearch,
            placeholder: "Nummer, Name oder Kunde suchen..."
          }}
          columns={demoColumns}
          rows={demoRows}
          rowKey={(r) => r.id}
          getChildren={(r) => r.children}
          loading={demoLoading}
          error={demoError ? { message: "Verbindung zum Server fehlgeschlagen. Bitte pr\u00fcfen Sie Ihre Internetverbindung." } : undefined}
          emptyState={{
            title: "Keine Kalkulationen vorhanden",
            description: "Erstellen Sie Ihre erste Kalkulation, um mit der Arbeit zu beginnen.",
            actionLabel: "Jetzt erstellen",
            onAction: () => console.log("Empty State Action")
          }}
          columnVisibility={{
            enabled: true,
            storageKey: "datatable.vorlagen",
            defaultVisibleKeys: defaultVisibleKeys,
            enableReordering: true,
            enableResizing: true,
          }}
          actions={(r) => (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); console.log("Add Child to:", r.id); }}
                className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-md transition-colors"
                title="Child hinzuf\u00fcgen"
              >
                <PlusCircle size={14} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); console.log("Edit:", r.id); }}
                className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                title="Bearbeiten"
              >
                <Edit2 size={14} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (window.confirm(`M\u00f6chten Sie ${r.number} wirklich l\u00f6schen?`)) {
                    console.log("Delete:", r.id);
                  }
                }}
                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                title="L\u00f6schen"
              >
                <Trash2 size={14} />
              </button>
            </>
          )}
        />
      </div>

      {/* Quick View Modal */}
      <QuickViewModal
        open={showQuickView}
        title={selectedCalculation ? `Kalkulation ${selectedCalculation.number}` : 'Kalkulation'}
        onClose={() => {
          setShowQuickView(false);
          setSelectedCalculation(null);
        }}
        maxWidth="900px"
      >
        {selectedCalculation && (
          <div className="space-y-4">
            {/* Grid Layout */}
            <div className="grid grid-cols-2 gap-4">
              {/* Titel */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Titel</label>
                <div className="text-sm text-gray-900">{selectedCalculation.name}</div>
              </div>

              {/* Status */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
                <span className={`inline-block px-2 py-1 rounded-full text-xs font-bold uppercase ${selectedCalculation.status === 'Aktiv' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                  {selectedCalculation.status}
                </span>
              </div>

              {/* Kunde */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Kunde</label>
                <div className="text-sm text-gray-900">{selectedCalculation.customer}</div>
              </div>

              {/* Standort - Placeholder */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Standort</label>
                <div className="text-sm text-gray-400 italic">Nicht zugewiesen</div>
              </div>

              {/* Asset - Placeholder */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Asset</label>
                <div className="text-sm text-gray-400 italic">Nicht zugewiesen</div>
              </div>

              {/* Aktualisiert */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Aktualisiert</label>
                <div className="text-sm text-gray-900">
                  {new Date(selectedCalculation.updatedAt).toLocaleDateString('de-DE', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </div>
              </div>
            </div>

            {/* Tags */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-2">Tags</label>
              <div className="flex flex-wrap gap-2">
                {selectedCalculation.tags.map((tag: string) => (
                  <span
                    key={tag}
                    className="px-2 py-1 bg-blue-50 text-blue-600 text-xs rounded border border-blue-100"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            {/* Preise (nur wenn Berechtigung vorhanden) */}
            {permissions.can_view_prices && (
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Einzelpreis</label>
                  <div className="text-sm font-semibold text-gray-900">
                    <Money value={selectedCalculation.unitPrice} hidden={hidePrices} reveal={revealPrices} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Gesamtsumme</label>
                  <div className="text-sm font-semibold text-gray-900">
                    <Money value={selectedCalculation.total} hidden={hidePrices} reveal={revealPrices} />
                  </div>
                </div>
              </div>
            )}

            {/* Beschreibung - Placeholder */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Beschreibung</label>
              <div className="text-sm text-gray-400 italic p-3 bg-gray-50 rounded border border-gray-200 min-h-[80px]">
                Keine Beschreibung vorhanden.
              </div>
            </div>

            {/* Hierarchie-Info */}
            {selectedCalculation.children && selectedCalculation.children.length > 0 && (
              <div className="pt-4 border-t border-gray-200">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span className="font-medium">Unterprojekte:</span>
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-bold">
                    {selectedCalculation.children.length}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </QuickViewModal>

      {/* Info Section */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="font-bold text-blue-900 mb-2">\u00dcber die DataTable-Komponente</h3>
        <p className="text-sm text-blue-800 mb-3">
          Diese Seite demonstriert die wiederverwendbare DataTable-Komponente, die als Standard f\u00fcr alle Tabellen in HWERP dient.
        </p>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>\u2022 <strong>Konsistentes Design:</strong> Einheitliches Erscheinungsbild \u00fcber alle Module hinweg</li>
          <li>\u2022 <strong>Flexible Konfiguration:</strong> Anpassbare Spalten, Actions und States</li>
          <li>\u2022 <strong>Column Chooser:</strong> Spalten k\u00f6nnen an/abgew\u00e4hlt werden und bleiben nach Reload erhalten</li>
          <li>\u2022 <strong>Multi-Filter:</strong> Mehrfachauswahl f\u00fcr Tags und Status mit aktiver Badge-Anzeige</li>
          <li>\u2022 <strong>Rollenbasierte Berechtigungen:</strong> Preis-Spalten nur sichtbar mit can_view_prices</li>
          <li>\u2022 <strong>Preis-Maskierung:</strong> Toggle + Eye-Press f\u00fcr tempor\u00e4res Einblenden</li>
          <li>\u2022 <strong>Hierarchische Daten:</strong> Rekursives Expand/Collapse \u00fcber mehrere Ebenen</li>
          <li>\u2022 <strong>Loading & Error States:</strong> Integrierte Zust\u00e4nde f\u00fcr bessere UX</li>
          <li>\u2022 <strong>Empty State:</strong> Hilfreiche Platzhalter bei leeren Tabellen</li>
          <li>\u2022 <strong>Sortierung & Suche:</strong> Eingebaute Funktionen f\u00fcr bessere Navigation</li>
        </ul>
      </div>
    </div>
  );
}
