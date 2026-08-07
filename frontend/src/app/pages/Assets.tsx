import { useEffect, useState, useCallback } from 'react';
import { Plus, Search, ChevronRight, ChevronDown, ChevronUp, ArrowUpDown, Columns2, Edit2, FolderPlus, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useAppStore } from '../context/AppStoreContext';
import { AssetNode, Customer } from '../lib/types';
import { AssetType, pgAssetTypeStore } from '../lib/assetTypeStorage';
import { buildAssetSearchText, formatTransformerProperties } from '../lib/assetTechnicalDataUtils';
import { Tag } from '../types/tag';
import type { SelectOption } from '../lib/selectOptions';
import TagBadge from '../components/TagBadge';
import { useModalClose } from '../hooks/useModalClose';
import type { AssetSortConfig, AssetSortKey, AssetSortableRow } from './assetTableSort';
import { sortAssetTableRows } from './assetTableSort';

const ASSET_TIMESTAMP_FORMATTER = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export function formatAssetTimestamp(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return ASSET_TIMESTAMP_FORMATTER.format(date);
}

const ASSET_TABLE_COLUMNS: Array<{ key: AssetSortKey; label: string }> = [
  { key: 'name', label: 'Name' },
  { key: 'customer', label: 'Kunde' },
  { key: 'assetType', label: 'Assettyp' },
  { key: 'construction', label: 'Bauart' },
  { key: 'customerAssetId', label: 'Kunden-ID' },
  { key: 'internalAssetId', label: 'Interne ID' },
  { key: 'manufacturer', label: 'Hersteller' },
  { key: 'buildYear', label: 'Baujahr' },
  { key: 'totalWeight', label: 'Gewicht (kg)' },
  { key: 'parent', label: 'Parent' },
  { key: 'tags', label: 'Tags' },
  { key: 'createdAt', label: 'Angelegt am' },
  { key: 'updatedAt', label: 'Geändert am' },
];

const DEFAULT_VISIBLE_ASSET_COLUMNS = ASSET_TABLE_COLUMNS.map((column) => column.key);
const DEFAULT_ASSET_SORT_CONFIG: AssetSortConfig = { key: null, direction: 'asc' };
const ASSET_COLUMN_VISIBILITY_STORAGE_KEY = 'hwerp.assets.visibleColumns';
const ASSET_SORT_STORAGE_KEY = 'hwerp.assets.sortConfig';

function isAssetSortKey(value: unknown): value is AssetSortKey {
  return ASSET_TABLE_COLUMNS.some((column) => column.key === value);
}

function loadVisibleAssetColumns(): AssetSortKey[] {
  if (typeof window === 'undefined') return DEFAULT_VISIBLE_ASSET_COLUMNS;
  try {
    const raw = window.localStorage.getItem(ASSET_COLUMN_VISIBILITY_STORAGE_KEY);
    if (!raw) return DEFAULT_VISIBLE_ASSET_COLUMNS;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_VISIBLE_ASSET_COLUMNS;
    const validKeys = new Set(DEFAULT_VISIBLE_ASSET_COLUMNS);
    const columns = parsed.filter((key): key is AssetSortKey => validKeys.has(key));
    return columns.length > 0 ? columns : DEFAULT_VISIBLE_ASSET_COLUMNS;
  } catch {
    return DEFAULT_VISIBLE_ASSET_COLUMNS;
  }
}

function loadAssetSortConfig(): AssetSortConfig {
  if (typeof window === 'undefined') return DEFAULT_ASSET_SORT_CONFIG;
  try {
    const raw = window.localStorage.getItem(ASSET_SORT_STORAGE_KEY);
    if (!raw) return DEFAULT_ASSET_SORT_CONFIG;
    const parsed = JSON.parse(raw) as Partial<AssetSortConfig>;
    const direction = parsed.direction === 'desc' ? 'desc' : 'asc';
    const key = isAssetSortKey(parsed.key) ? parsed.key : null;
    return { key, direction };
  } catch {
    return DEFAULT_ASSET_SORT_CONFIG;
  }
}

/**
 * Assets - Tabellarische Übersicht aller Assets
 *
 * Motivation: Zentrale Anlaufstelle für Verwaltung der Asset-Hierarchie.
 * Tabelle statt Tree ermöglicht schnelleren Überblick und direkten Zugriff auf Aktionen.
 * Navigation zu Detailseiten für Create/Edit ermöglicht komplexere Formulare mit Tab-System.
 *
 * URL-Struktur:
 * - /assets              → Diese Seite (Tabelle)
 * - /assets/new          → Neues Root-Asset erstellen
 * - /assets/new?parentId → Neues Kind-Asset erstellen
 * - /assets/:id          → Bestehendes Asset bearbeiten
 */

export default function Assets() {
  const navigate = useNavigate();
  const { state, dispatch, repository } = useAppStore();
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [assetTypes, setAssetTypes] = useState<AssetType[]>([]);
  const [sortConfig, setSortConfig] = useState<AssetSortConfig>(loadAssetSortConfig);
  const [visibleColumnKeys, setVisibleColumnKeys] = useState<AssetSortKey[]>(loadVisibleAssetColumns);
  const [columnPickerOpen, setColumnPickerOpen] = useState(false);

  // Load assets and tags on mount
  useEffect(() => {
    async function loadData() {
      try {
        const [assets, tags, customers, selectOptions] = await Promise.all([
          repository.list<AssetNode>('assets'),
          repository.list<Tag>('tags'),
          repository.list<Customer>('customers'),
          repository.list<SelectOption>('selectOptions'),
        ]);
        await pgAssetTypeStore.seedIfEmpty().catch(() => undefined);
        const assetTypesData = await pgAssetTypeStore.getAll().catch(() => [] as AssetType[]);
        dispatch({ type: 'SET_ENTITIES', entity: 'assets', data: assets });
        dispatch({ type: 'SET_ENTITIES', entity: 'tags', data: tags });
        dispatch({ type: 'SET_ENTITIES', entity: 'customers', data: customers });
        dispatch({ type: 'SET_ENTITIES', entity: 'selectOptions', data: selectOptions });
        setAssetTypes(assetTypesData.filter((type) => type.isActive));
      } catch (error) {
        console.error('Failed to load data:', error);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [repository, dispatch]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(ASSET_SORT_STORAGE_KEY, JSON.stringify(sortConfig));
  }, [sortConfig]);

  const assets = (state.assets as AssetNode[]) || [];
  const tags = (state.tags as Tag[]) || [];
  const customers = (state.customers as Customer[]) || [];
  const selectOptions = (state.selectOptions as SelectOption[]) || [];

  // Hierarchie-Helfer
  const getChildren = (parentId: string | null): AssetNode[] => {
    return assets.filter((asset) => asset.parentId === parentId);
  };

  const hasChildren = (assetId: string): boolean => {
    return assets.some((asset) => asset.parentId === assetId);
  };

  const getParent = (parentId: string | null): AssetNode | null => {
    if (!parentId) return null;
    return assets.find((a) => a.id === parentId) || null;
  };

  const getCustomer = (customerId: string | null): Customer | null => {
    if (!customerId) return null;
    return customers.find((customer) => customer.id === customerId) || null;
  };

  const getAssetType = (assetTypeId: string | null | undefined): AssetType | null => {
    if (!assetTypeId) return null;
    return assetTypes.find((type) => type.id === assetTypeId) || null;
  };

  // Suche: Filterung nach Name, Kunde und Tags (Option B: Treffer + Parents)
  const filterAssets = (): AssetNode[] => {
    if (!searchQuery.trim()) {
      // Keine Suche: Alle Assets zurückgeben
      return assets;
    }

    const query = searchQuery.toLowerCase();
    const matchingAssets = new Set<string>();

    // 1. Finde alle direkten Treffer
    assets.forEach((asset) => {
      const searchableText = buildAssetSearchText(
        asset,
        tags,
        getCustomer(asset.customerId),
        getAssetType(asset.assetTypeId),
        selectOptions,
      );
      if (searchableText.includes(query)) {
        matchingAssets.add(asset.id);
      }
    });

    // 2. Erweitere um alle Parents (Option B)
    const result = new Set<string>(matchingAssets);
    matchingAssets.forEach((assetId) => {
      let current = assets.find((a) => a.id === assetId);
      while (current && current.parentId) {
        result.add(current.parentId);
        current = assets.find((a) => a.id === current!.parentId);
      }
    });

    return assets.filter((a) => result.has(a.id));
  };

  const filteredAssets = filterAssets();

  // Baue Tabellenzeilen mit Hierarchie auf (rekursiv)
  interface TableRow extends AssetSortableRow {}

  const buildTableRows = (): TableRow[] => {
    const rows: TableRow[] = [];
    const query = searchQuery.toLowerCase();

    // Hilfsfunktion: Ist Asset ein direkter Suchtreffer?
    const isDirectMatch = (asset: AssetNode): boolean => {
      if (!searchQuery.trim()) return false;
      return buildAssetSearchText(
        asset,
        tags,
        getCustomer(asset.customerId),
        getAssetType(asset.assetTypeId),
        selectOptions,
      ).includes(query);
    };

    const buildSortableRow = (asset: AssetNode, depth: number): TableRow => {
      const parent = getParent(asset.parentId);
      const customer = getCustomer(asset.customerId);
      const assetType = getAssetType(asset.assetTypeId);
      const transformerProperties = formatTransformerProperties(asset, selectOptions);
      const assetTags = tags.filter((tag) => asset.tagIds && asset.tagIds.includes(tag.id));

      return {
        asset,
        depth,
        isMatch: isDirectMatch(asset),
        parentName: parent?.name ?? '',
        customerName: customer?.name ?? '',
        assetTypeLabel: assetType?.label ?? '',
        constructionText: transformerProperties.join(' · '),
        tagText: assetTags.map((tag) => [tag.name, tag.code].filter(Boolean).join(' ')).join(' · '),
      };
    };

    const addRowsRecursive = (parentId: string | null, depth: number) => {
      const children = getChildren(parentId).filter((child) =>
        filteredAssets.some((fa) => fa.id === child.id)
      );
      const sortedChildren = sortAssetTableRows(
        children.map((child) => buildSortableRow(child, depth)),
        sortConfig,
      );

      sortedChildren.forEach((row) => {
        rows.push(row);

        // Wenn expanded oder Suche aktiv: Kinder rekursiv hinzufügen
        if (expandedNodes.has(row.asset.id) || searchQuery.trim()) {
          addRowsRecursive(row.asset.id, depth + 1);
        }
      });
    };

    addRowsRecursive(null, 0);
    return rows;
  };

  const tableRows = buildTableRows();

  // Toggle expand/collapse
  const toggleExpand = (assetId: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(assetId)) {
      newExpanded.delete(assetId);
    } else {
      newExpanded.add(assetId);
    }
    setExpandedNodes(newExpanded);
  };

  // Navigation
  const handleCreateRoot = () => {
    navigate('/assets/new');
  };

  const handleEditAsset = (id: string) => {
    navigate(`/assets/${id}`);
  };

  const handleAddChild = (parentId: string) => {
    navigate(`/assets/new?parentId=${parentId}`);
  };

  const handleCloseDeleteConfirm = useCallback(() => {
    setDeleteConfirm(null);
    setDeleteError(null);
  }, []);
  const handleDeleteBackdropClick = useModalClose(!!deleteConfirm, handleCloseDeleteConfirm);

  // Delete-Logik
  const handleDelete = async (id: string) => {
    setDeleteError(null);

    // Check ob Kinder vorhanden
    if (hasChildren(id)) {
      setDeleteError('Asset kann nicht gelöscht werden, da es untergeordnete Assets hat.');
      return;
    }

    try {
      await repository.delete('assets', id);
      const updatedAssets = assets.filter((a) => a.id !== id);
      dispatch({ type: 'SET_ENTITIES', entity: 'assets', data: updatedAssets });
      setDeleteConfirm(null);
    } catch (error) {
      console.error('Failed to delete asset:', error);
      setDeleteError('Fehler beim Löschen des Assets.');
    }
  };

  const handleSort = (key: AssetSortKey) => {
    setSortConfig((current) => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const handleSortColumnSelect = (key: string) => {
    setSortConfig((current) => ({
      key: key ? (key as AssetSortKey) : null,
      direction: current.direction,
    }));
  };

  const toggleSortDirection = () => {
    setSortConfig((current) => ({
      ...current,
      direction: current.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const isColumnVisible = (key: AssetSortKey) => visibleColumnKeys.includes(key);

  const toggleColumnVisibility = (key: AssetSortKey) => {
    setVisibleColumnKeys((current) => {
      const next = current.includes(key)
        ? current.filter((columnKey) => columnKey !== key)
        : [...current, key];
      const safeNext = next.length > 0 ? next : current;
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(ASSET_COLUMN_VISIBILITY_STORAGE_KEY, JSON.stringify(safeNext));
      }
      return safeNext;
    });
  };

  const showAllColumns = () => {
    setVisibleColumnKeys(DEFAULT_VISIBLE_ASSET_COLUMNS);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(
        ASSET_COLUMN_VISIBILITY_STORAGE_KEY,
        JSON.stringify(DEFAULT_VISIBLE_ASSET_COLUMNS),
      );
    }
  };

  const renderSortIcon = (key: AssetSortKey) => {
    if (sortConfig.key !== key) return <ArrowUpDown size={13} className="text-gray-400" />;
    return sortConfig.direction === 'asc'
      ? <ChevronUp size={14} className="text-blue-600" />
      : <ChevronDown size={14} className="text-blue-600" />;
  };

  const renderSortableHeader = (label: string, key: AssetSortKey) => {
    if (!isColumnVisible(key)) return null;

    return (
      <th
        aria-sort={sortConfig.key === key ? (sortConfig.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
      >
        <button
          type="button"
          onClick={() => handleSort(key)}
          className="inline-flex items-center gap-1 hover:text-gray-800"
          title={`${label} sortieren`}
        >
          <span>{label}</span>
          {renderSortIcon(key)}
        </button>
      </th>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-600">Lade Assets...</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">Assets</h1>
          <button
            onClick={handleCreateRoot}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            <Plus size={20} />
            Neues Asset
          </button>
        </div>

        {/* Suche, Sortierung und Spalten */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative min-w-[260px] flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Suche nach Name, Assettyp, Bauart oder Tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="asset-sort-column" className="text-xs font-bold uppercase tracking-wide text-gray-500">
              Sortieren nach:
            </label>
            <select
              id="asset-sort-column"
              value={sortConfig.key ?? ''}
              onChange={(e) => handleSortColumnSelect(e.target.value)}
              className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Keine Sortierung</option>
              {ASSET_TABLE_COLUMNS.map((column) => (
                <option key={column.key} value={column.key}>
                  {column.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={toggleSortDirection}
              disabled={!sortConfig.key}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 shadow-sm transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              title={sortConfig.direction === 'asc' ? 'Aufsteigend sortieren' : 'Absteigend sortieren'}
              aria-label={sortConfig.direction === 'asc' ? 'Aufsteigend sortieren' : 'Absteigend sortieren'}
            >
              {sortConfig.direction === 'asc' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => setColumnPickerOpen((open) => !open)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 text-gray-700 text-xs font-bold rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
                title="Spalten auswählen"
              >
                <Columns2 size={14} />
                Spalten
              </button>

              {columnPickerOpen && (
                <div className="absolute right-0 z-30 mt-2 w-60 rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Spalten anzeigen</p>
                    <button
                      type="button"
                      onClick={showAllColumns}
                      className="text-xs font-medium text-blue-600 hover:text-blue-700"
                    >
                      Alle
                    </button>
                  </div>
                  <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
                    {ASSET_TABLE_COLUMNS.map((column) => (
                      <label
                        key={column.key}
                        className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        <input
                          type="checkbox"
                          checked={isColumnVisible(column.key)}
                          onChange={() => toggleColumnVisibility(column.key)}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span>{column.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {assets.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full">
            <p className="text-gray-600 mb-4">Noch keine Assets</p>
            <button
              onClick={handleCreateRoot}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              <Plus size={20} />
              Neues Asset
            </button>
          </div>
        ) : tableRows.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-600">Keine Assets gefunden für "{searchQuery}"</p>
          </div>
        ) : (
          <div className="bg-white">
            <table className="min-w-max w-full">
              <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                <tr>
                  {renderSortableHeader('Name', 'name')}
                  {renderSortableHeader('Kunde', 'customer')}
                  {renderSortableHeader('Assettyp', 'assetType')}
                  {renderSortableHeader('Bauart', 'construction')}
                  {renderSortableHeader('Kunden-ID', 'customerAssetId')}
                  {renderSortableHeader('Interne ID', 'internalAssetId')}
                  {renderSortableHeader('Hersteller', 'manufacturer')}
                  {renderSortableHeader('Baujahr', 'buildYear')}
                  {renderSortableHeader('Gewicht (kg)', 'totalWeight')}
                  {renderSortableHeader('Parent', 'parent')}
                  {renderSortableHeader('Tags', 'tags')}
                  {renderSortableHeader('Angelegt am', 'createdAt')}
                  {renderSortableHeader('Geändert am', 'updatedAt')}
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Aktionen
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {tableRows.map(({ asset, depth, isMatch }) => {
                  const parent = getParent(asset.parentId);
                  const customer = getCustomer(asset.customerId);
                  const assetType = getAssetType(asset.assetTypeId);
                  const transformerProperties = formatTransformerProperties(asset, selectOptions);
                  const assetHasChildren = hasChildren(asset.id);
                  const isExpanded = expandedNodes.has(asset.id);
                  // Filter tags und entferne undefined (falls Tag gelöscht wurde)
                  const assetTags = tags
                    .filter((tag) => asset.tagIds && asset.tagIds.includes(tag.id))
                    .filter((tag) => tag != null); // Extra safety check

                  return (
                    <tr
                      key={asset.id}
                      className={`hover:bg-gray-50 transition-colors ${
                        isMatch ? 'bg-blue-50' : ''
                      } ${assetHasChildren ? 'cursor-pointer' : ''}`}
                      onClick={() => {
                        if (assetHasChildren) {
                          toggleExpand(asset.id);
                        }
                      }}
                    >
                      {/* Name mit Hierarchie-Indentation */}
                      {isColumnVisible('name') && (
                        <td className="px-6 py-4">
                          <div
                            className="flex items-center gap-2"
                            style={{ paddingLeft: `${depth * 24}px` }}
                          >
                            {/* Expand/Collapse Button */}
                            {assetHasChildren ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleExpand(asset.id);
                                }}
                                className="flex-shrink-0 p-0.5 hover:bg-gray-200 rounded"
                              >
                                {isExpanded ? (
                                  <ChevronDown size={16} className="text-gray-600" />
                                ) : (
                                  <ChevronRight size={16} className="text-gray-600" />
                                )}
                              </button>
                            ) : (
                              <div className="w-[18px] flex-shrink-0" />
                            )}

                            <span
                              className="font-medium text-gray-900 hover:text-blue-600 cursor-pointer"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditAsset(asset.id);
                              }}
                            >
                              {asset.name || '(Unbenannt)'}
                            </span>
                          </div>
                        </td>
                      )}

                      {/* Kunde */}
                      {isColumnVisible('customer') && (
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {customer ? customer.name : '—'}
                        </td>
                      )}

                      {/* Assettyp */}
                      {isColumnVisible('assetType') && (
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {assetType ? assetType.label : '—'}
                        </td>
                      )}

                      {/* Bauart / Trafo-Eigenschaften */}
                      {isColumnVisible('construction') && (
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {transformerProperties.length > 0 ? transformerProperties.join(' · ') : '—'}
                        </td>
                      )}

                      {/* Kunden-ID */}
                      {isColumnVisible('customerAssetId') && (
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {asset.customerAssetId || '—'}
                        </td>
                      )}

                      {/* Interne ID */}
                      {isColumnVisible('internalAssetId') && (
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {asset.internalAssetId || '—'}
                        </td>
                      )}

                      {/* Hersteller */}
                      {isColumnVisible('manufacturer') && (
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {asset.manufacturer || '—'}
                        </td>
                      )}

                      {/* Baujahr */}
                      {isColumnVisible('buildYear') && (
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {asset.buildYear || '—'}
                        </td>
                      )}

                      {/* Gesamtgewicht */}
                      {isColumnVisible('totalWeight') && (
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {asset.totalWeight ? `${asset.totalWeight} kg` : '—'}
                        </td>
                      )}

                      {/* Parent */}
                      {isColumnVisible('parent') && (
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {parent ? parent.name : '—'}
                        </td>
                      )}

                      {/* Tags */}
                      {isColumnVisible('tags') && (
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-1">
                            {assetTags.map((tag) => (
                              <TagBadge key={tag.id} tag={tag} size="sm" showCode={true} />
                            ))}
                          </div>
                        </td>
                      )}

                      {/* Angelegt am */}
                      {isColumnVisible('createdAt') && (
                        <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">
                          {formatAssetTimestamp(asset.createdAt)}
                        </td>
                      )}

                      {/* Geändert am */}
                      {isColumnVisible('updatedAt') && (
                        <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">
                          {formatAssetTimestamp(asset.updatedAt)}
                        </td>
                      )}

                      {/* Aktionen */}
                      <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleEditAsset(asset.id)}
                            className="p-2 hover:bg-gray-100 rounded transition-colors"
                            title="Asset bearbeiten"
                          >
                            <Edit2 size={16} className="text-gray-600" />
                          </button>

                          <button
                            onClick={() => handleAddChild(asset.id)}
                            className="p-2 hover:bg-gray-100 rounded transition-colors"
                            title="Untergeordnetes Asset anlegen"
                          >
                            <FolderPlus size={16} className="text-gray-600" />
                          </button>

                          <button
                            onClick={() => setDeleteConfirm(asset.id)}
                            className="p-2 hover:bg-red-50 rounded transition-colors"
                            title="Asset löschen"
                          >
                            <Trash2 size={16} className="text-red-600" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete Confirm Dialog */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={handleDeleteBackdropClick}>
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">Asset löschen?</h2>
            <p className="text-gray-600 mb-6">
              Möchten Sie dieses Asset wirklich löschen?
              <br />
              <br />
              Diese Aktion kann nicht rückgängig gemacht werden.
            </p>

            {deleteError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded">
                <p className="text-sm text-red-600">{deleteError}</p>
              </div>
            )}

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setDeleteConfirm(null);
                  setDeleteError(null);
                }}
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
    </div>
  );
}
