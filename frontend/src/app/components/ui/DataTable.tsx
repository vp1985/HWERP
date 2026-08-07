import React, { useState, useEffect } from 'react';
import { Search, Plus, AlertCircle, Loader2, ChevronDown, ChevronUp, ChevronRight, Columns, GripVertical, Check, SlidersHorizontal } from 'lucide-react';
import Tooltip from '../Tooltip';

/**
 * DEV: Zentrale Tabellen-Komponente, damit Make später nicht pro Seite ein eigenes Design baut.
 *
 * Diese Komponente ist auf maximale Platzersparnis und Konsistenz ausgelegt.
 * Sie unterstützt Sticky Header, Loading Skeletons, Empty States, responsive Ellipsis mit Tooltips
 * und hierarchische Expand/Collapse-Funktionalität für verschachtelte Daten.
 */

export interface DataTableColumn<T> {
  key: string;
  header: string;
  headerContent?: React.ReactNode;
  width?: number | string;
  align?: 'left' | 'right' | 'center';
  sortable?: boolean;
  sortValue?: (row: T) => string | number | null | undefined;
  render: (row: T, depth?: number) => React.ReactNode;
}

export type DataTableSortConfig = { key: string; direction: 'asc' | 'desc' };

function defaultSortValue<T>(row: T, key: string): string | number | null | undefined {
  return (row as Record<string, unknown>)[key] as string | number | null | undefined;
}

function compareDataTableValues(a: string | number | null | undefined, b: string | number | null | undefined): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;

  if (typeof a === 'number' && typeof b === 'number') {
    return a - b;
  }

  return String(a).localeCompare(String(b), 'de', { numeric: true, sensitivity: 'base' });
}

export function sortDataTableRows<T>(rows: T[], columns: DataTableColumn<T>[], sortConfig: DataTableSortConfig | null): T[] {
  if (!sortConfig) return rows;

  const column = columns.find((col) => col.key === sortConfig.key && col.sortable);
  if (!column) return rows;

  const getValue = column.sortValue ?? ((row: T) => defaultSortValue(row, column.key));
  const directionMultiplier = sortConfig.direction === 'asc' ? 1 : -1;

  return [...rows].sort((left, right) => compareDataTableValues(getValue(left), getValue(right)) * directionMultiplier);
}

// DEV: Spaltenauswahl pro Tabelle, damit Nutzer sich Ansichten bauen können. Rechte filtern Spalten vor dem Chooser.
interface ColumnVisibilityConfig {
  enabled: boolean;
  storageKey: string; // z.B. "datatable.demo"
  defaultVisibleKeys: string[];
  // DEV: Column Reordering Support (Pilot)
  enableReordering?: boolean;
}

// DEV: Zentrales Layout pro Tabelle. Damit ist die fachliche Standardposition im Code festgelegt,
// während Nutzer optional weiter eigene Sichtbarkeit/Reihenfolge im Browser speichern können.
interface ColumnLayoutConfig {
  defaultOrder?: string[];
  defaultVisible?: string[];
  lockedLeft?: string[];
  lockedRight?: string[];
  required?: string[];
}

type DataTableFilterPrimitive = string | number | boolean | null | undefined;
type DataTableRangeFilterValue = { from?: string; to?: string };
export type DataTableFilterValue = string | string[] | DataTableRangeFilterValue;
export type DataTableFilterValues = Record<string, DataTableFilterValue | undefined>;

export interface DataTableFilterConfig<T> {
  key: string;
  label: string;
  type: 'select' | 'multiSelect' | 'dateRange' | 'numberRange' | 'text';
  options?: { value: string; label: string }[];
  getValue?: (row: T) => DataTableFilterPrimitive;
  placeholder?: string;
}

// DEV: Storage-Struktur für Column State (persistiert)
interface ColumnStorageState {
  visibleKeys: string[];
  orderKeys: string[];
  version: number;
}

interface DataTableProps<T> {
  title: string;
  primaryAction?: { label: string; onClick: () => void; ariaLabel?: string; title?: string; iconOnly?: boolean };
  density?: 'normal' | 'ultraCompact';
  search?: { value: string; onChange: (v: string) => void; placeholder?: string };
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  actions?: (row: T) => React.ReactNode;
  loading?: boolean;
  emptyState?: { title: string; description?: string; actionLabel?: string; onAction?: () => void };
  error?: { message: string; onRetry?: () => void };
  // Hierarchie-Support
  getChildren?: (row: T) => T[] | undefined;
  // Column Chooser Support
  columnVisibility?: ColumnVisibilityConfig;
  columnLayout?: ColumnLayoutConfig;
  filters?: DataTableFilterConfig<T>[];
  filterValues?: DataTableFilterValues;
  onFilterChange?: (values: DataTableFilterValues) => void;
}

export function DataTable<T>(props: DataTableProps<T>) {
  const {
    title,
    primaryAction,
    density = 'normal',
    search,
    columns,
    rows,
    rowKey,
    onRowClick,
    actions,
    loading,
    emptyState,
    error,
    getChildren,
    columnVisibility,
    columnLayout,
    filters,
    filterValues,
    onFilterChange,
  } = props;

  const [sortConfig, setSortConfig] = useState<DataTableSortConfig | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [internalFilterValues, setInternalFilterValues] = useState<DataTableFilterValues>({});
  const [columnChooserOpen, setColumnChooserOpen] = useState(false);
  const [columnReorderMode, setColumnReorderMode] = useState(false);
  const [visibleColumnKeys, setVisibleColumnKeys] = useState<string[]>([]);
  const [columnOrderKeys, setColumnOrderKeys] = useState<string[]>([]);

  // DEV: Drag & Drop State
  const [draggedColumnKey, setDraggedColumnKey] = useState<string | null>(null);
  const [dragOverColumnKey, setDragOverColumnKey] = useState<string | null>(null);
  const isUltraCompact = density === 'ultraCompact';

  const availableColumnKeys = columns.map((c) => c.key);
  const columnChooserEnabled = Boolean(columnVisibility?.enabled);
  const requiredColumnKeys = (columnLayout?.required ?? []).filter((key) => availableColumnKeys.includes(key));
  const lockedLeftColumnKeys = (columnLayout?.lockedLeft ?? []).filter((key) => availableColumnKeys.includes(key));
  const lockedRightColumnKeys = (columnLayout?.lockedRight ?? []).filter((key) => availableColumnKeys.includes(key));

  const uniqueKeys = (keys: string[]) => Array.from(new Set(keys));
  const defaultVisibleColumnKeys = uniqueKeys([
    ...requiredColumnKeys,
    ...(columnLayout?.defaultVisible ?? columnVisibility?.defaultVisibleKeys ?? availableColumnKeys),
  ]).filter((key) => availableColumnKeys.includes(key));
  const defaultOrderColumnKeys = uniqueKeys([
    ...lockedLeftColumnKeys,
    ...(columnLayout?.defaultOrder ?? columnVisibility?.defaultVisibleKeys ?? availableColumnKeys),
    ...availableColumnKeys,
    ...lockedRightColumnKeys,
  ]).filter((key) => availableColumnKeys.includes(key));

  const normalizeVisibleKeys = (keys: string[]) => {
    const normalized = uniqueKeys([...requiredColumnKeys, ...keys]).filter((key) => availableColumnKeys.includes(key));
    if (normalized.length > 0) return normalized;
    return defaultVisibleColumnKeys.length > 0 ? defaultVisibleColumnKeys : availableColumnKeys.slice(0, 1);
  };

  const normalizeOrderKeys = (keys?: string[]) => {
    const source = keys && keys.length > 0 ? keys : defaultOrderColumnKeys;
    return uniqueKeys([...source, ...defaultOrderColumnKeys]).filter((key) => availableColumnKeys.includes(key));
  };

  const applyLayoutLocks = (keys: string[]) => {
    const normalized = normalizeOrderKeys(keys);
    const lockedLeft = lockedLeftColumnKeys.filter((key) => normalized.includes(key));
    const lockedRight = lockedRightColumnKeys.filter((key) => normalized.includes(key));
    const middle = normalized.filter((key) => !lockedLeft.includes(key) && !lockedRight.includes(key));
    return [...lockedLeft, ...middle, ...lockedRight];
  };

  const canReorderColumn = (key: string) => {
    if (!columnReorderMode) return false;
    if (!columnVisibility?.enableReordering) return false;
    if (lockedLeftColumnKeys.includes(key) || lockedRightColumnKeys.includes(key)) return false;
    return true;
  };

  const activeFilterValues = filterValues ?? internalFilterValues;
  const activeFilterCount = Object.values(activeFilterValues).filter((value) => {
    if (value == null) return false;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'object') return Boolean(value.from || value.to);
    return String(value).trim().length > 0;
  }).length;

  const updateFilterValue = (key: string, value: DataTableFilterValue | undefined) => {
    const nextValues: DataTableFilterValues = { ...activeFilterValues, [key]: value };
    const nextValue = nextValues[key];
    if (
      nextValue == null ||
      (Array.isArray(nextValue) && nextValue.length === 0) ||
      (typeof nextValue === 'object' && !Array.isArray(nextValue) && !nextValue.from && !nextValue.to) ||
      (typeof nextValue === 'string' && nextValue.trim() === '')
    ) {
      delete nextValues[key];
    }

    setInternalFilterValues(nextValues);
    onFilterChange?.(nextValues);
  };

  const resetFilters = () => {
    setInternalFilterValues({});
    onFilterChange?.({});
  };

  const parseNumberFilterValue = (value: DataTableFilterPrimitive) => {
    if (typeof value === 'number') return value;
    if (value == null) return null;
    const normalized = String(value)
      .replace(/[^0-9,.-]/g, '')
      .replace(/\./g, '')
      .replace(',', '.');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const parseDateFilterValue = (value: DataTableFilterPrimitive) => {
    if (value == null) return null;
    const text = String(value).trim();
    const germanDate = text.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    if (germanDate) return `${germanDate[3]}-${germanDate[2]}-${germanDate[1]}`;
    return text;
  };

  const getFilterRawValue = (row: T, filter: DataTableFilterConfig<T>) => (
    filter.getValue ? filter.getValue(row) : (row as Record<string, unknown>)[filter.key] as DataTableFilterPrimitive
  );

  const rowsAfterFilters = (filters && filters.length > 0)
    ? rows.filter((row) => filters.every((filter) => {
      const filterValue = activeFilterValues[filter.key];
      if (filterValue == null) return true;
      const rawValue = getFilterRawValue(row, filter);

      if (filter.type === 'select') {
        return !filterValue || String(rawValue) === String(filterValue);
      }

      if (filter.type === 'multiSelect') {
        return Array.isArray(filterValue) && (filterValue.length === 0 || filterValue.includes(String(rawValue)));
      }

      if (filter.type === 'text') {
        return String(rawValue ?? '').toLowerCase().includes(String(filterValue).toLowerCase());
      }

      if (filter.type === 'numberRange' && typeof filterValue === 'object' && !Array.isArray(filterValue)) {
        const numberValue = parseNumberFilterValue(rawValue);
        if (numberValue == null) return false;
        const from = filterValue.from ? Number(String(filterValue.from).replace(',', '.')) : null;
        const to = filterValue.to ? Number(String(filterValue.to).replace(',', '.')) : null;
        if (from != null && Number.isFinite(from) && numberValue < from) return false;
        if (to != null && Number.isFinite(to) && numberValue > to) return false;
        return true;
      }

      if (filter.type === 'dateRange' && typeof filterValue === 'object' && !Array.isArray(filterValue)) {
        const dateValue = parseDateFilterValue(rawValue);
        if (!dateValue) return false;
        if (filterValue.from && dateValue < filterValue.from) return false;
        if (filterValue.to && dateValue > filterValue.to) return false;
        return true;
      }

      return true;
    }))
    : rows;

  // DEV: Initialisiere sichtbare Spalten und Reihenfolge aus localStorage oder Layout-Defaults.
  useEffect(() => {
    if (!columnChooserEnabled) {
      setVisibleColumnKeys(availableColumnKeys);
      setColumnOrderKeys(applyLayoutLocks(defaultOrderColumnKeys));
      return;
    }

    const stored = columnVisibility?.storageKey ? localStorage.getItem(columnVisibility.storageKey) : null;

    if (stored) {
      try {
        const parsed = JSON.parse(stored) as ColumnStorageState | string[];

        if (Array.isArray(parsed)) {
          setVisibleColumnKeys(normalizeVisibleKeys(parsed));
          setColumnOrderKeys(applyLayoutLocks(defaultOrderColumnKeys));
        } else {
          setVisibleColumnKeys(normalizeVisibleKeys(parsed.visibleKeys));
          setColumnOrderKeys(applyLayoutLocks(parsed.orderKeys));
        }
      } catch {
        setVisibleColumnKeys(normalizeVisibleKeys(defaultVisibleColumnKeys));
        setColumnOrderKeys(applyLayoutLocks(defaultOrderColumnKeys));
      }
    } else {
      setVisibleColumnKeys(normalizeVisibleKeys(defaultVisibleColumnKeys));
      setColumnOrderKeys(applyLayoutLocks(defaultOrderColumnKeys));
    }
  }, [columns, columnVisibility, columnLayout]);

  // DEV: Speichere sichtbare Spalten und Reihenfolge in localStorage
  const updateColumnState = (visibleKeys: string[], orderKeys?: string[]) => {
    const nextVisibleKeys = normalizeVisibleKeys(visibleKeys);
    const nextOrderKeys = applyLayoutLocks(orderKeys ?? columnOrderKeys);

    setVisibleColumnKeys(nextVisibleKeys);
    setColumnOrderKeys(nextOrderKeys);

    if (columnChooserEnabled && columnVisibility?.storageKey) {
      const state: ColumnStorageState = {
        visibleKeys: nextVisibleKeys,
        orderKeys: nextOrderKeys,
        version: 2,
      };
      localStorage.setItem(columnVisibility.storageKey, JSON.stringify(state));
    }
  };

  // DEV: Filtere und sortiere Spalten basierend auf Sichtbarkeit, Reihenfolge und Layout-Locks.
  const getOrderedVisibleColumns = () => {
    const activeVisibleKeys = columnChooserEnabled ? normalizeVisibleKeys(visibleColumnKeys) : availableColumnKeys;
    const visible = columns.filter((c) => activeVisibleKeys.includes(c.key));
    const orderedKeys = applyLayoutLocks(columnOrderKeys.length > 0 ? columnOrderKeys : defaultOrderColumnKeys);

    return [...visible].sort((a, b) => {
      const indexA = orderedKeys.indexOf(a.key);
      const indexB = orderedKeys.indexOf(b.key);
      if (indexA === -1 && indexB === -1) return 0;
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });
  };

  const visibleColumns = getOrderedVisibleColumns();
  const sortedRows = sortDataTableRows(rowsAfterFilters, columns, sortConfig);

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const handleRowClick = (row: T, e: React.MouseEvent) => {
    const rowId = rowKey(row);
    const children = getChildren ? getChildren(row) : undefined;

    // Wenn die Zeile Kinder hat, toggle den expand state
    if (children && children.length > 0) {
      e.stopPropagation();
      const newExpandedRows = new Set(expandedRows);
      if (newExpandedRows.has(rowId)) {
        newExpandedRows.delete(rowId);
      } else {
        newExpandedRows.add(rowId);
      }
      setExpandedRows(newExpandedRows);
    } else if (onRowClick) {
      // Nur onRowClick aufrufen, wenn keine Kinder vorhanden sind
      onRowClick(row);
    }
  };

  // Render Helpers
  const renderLoading = () => (
    <div className="divide-y divide-gray-100">
      {[...Array(5)].map((_, i) => (
        <div key={i} className={`flex items-center animate-pulse ${isUltraCompact ? 'px-[2px] py-[1px]' : 'px-6 py-3'}`}>
          {columns.map((col) => (
            <div key={col.key} className="flex-1 mr-4 h-4 bg-gray-100 rounded" style={{ width: col.width }} />
          ))}
          {actions && <div className="w-16 h-4 bg-gray-100 rounded" />}
        </div>
      ))}
    </div>
  );

  const renderEmpty = () => (
    <div className="py-16 flex flex-col items-center justify-center text-center px-4">
      <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mb-4 text-gray-400">
        <AlertCircle size={24} />
      </div>
      <h3 className="text-base font-semibold text-gray-900">{emptyState?.title || 'Keine Daten gefunden'}</h3>
      <p className="text-sm text-gray-500 mt-1 max-w-xs">{emptyState?.description || 'Es wurden keine Einträge für diese Ansicht gefunden.'}</p>
      {emptyState?.onAction && (
        <button
          onClick={emptyState.onAction}
          className="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
        >
          <Plus size={16} />
          {emptyState.actionLabel || 'Hinzufügen'}
        </button>
      )}
    </div>
  );

  const renderError = () => (
    <div className="py-16 flex flex-col items-center justify-center text-center px-4">
      <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mb-4 text-red-500">
        <AlertCircle size={24} />
      </div>
      <h3 className="text-base font-semibold text-gray-900">Ein Fehler ist aufgetreten</h3>
      <p className="text-sm text-red-500 mt-1 max-w-xs">{error?.message || 'Die Daten konnten nicht geladen werden.'}</p>
      {error?.onRetry && (
        <button
          onClick={error.onRetry}
          className="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
        >
          <Loader2 size={16} className="animate-spin" />
          Erneut versuchen
        </button>
      )}
    </div>
  );

  // Rekursive Funktion zum Rendern von Zeilen mit ihren Kindern
  const renderRows = (rowsToRender: T[], depth: number = 0): React.ReactNode[] => {
    const result: React.ReactNode[] = [];

    rowsToRender.forEach((row) => {
      const rowId = rowKey(row);
      const children = getChildren ? getChildren(row) : undefined;
      const hasChildren = children && children.length > 0;
      const isExpanded = expandedRows.has(rowId);

      result.push(
        <tr
          key={rowId}
          onClick={(e) => handleRowClick(row, e)}
          className={`
            group transition-colors border-b border-gray-50/50
            ${hasChildren || onRowClick ? 'cursor-pointer hover:bg-blue-50/30' : 'hover:bg-gray-50/50'}
          `}
        >
          {visibleColumns.map((col, colIndex) => (
            <td
              key={col.key}
              className={`
                ${isUltraCompact ? 'px-[2px] py-[1px] text-sm' : 'px-6 py-2.5 text-sm'}
                ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'}
              `}
              style={{ width: col.width }}
            >
              <div className={`flex items-center ${col.align === 'right' ? 'justify-end' : col.align === 'center' ? 'justify-center' : 'justify-start'}`}>
                {/* Expand/Collapse Icon in erster Spalte wenn Kinder vorhanden */}
                {colIndex === 0 && depth > 0 && (
                  <span style={{ marginLeft: `${depth * 24}px` }} />
                )}
                {colIndex === 0 && hasChildren && (
                  <span className="mr-2 flex-shrink-0" style={{ marginLeft: `${depth * 24}px` }}>
                    {isExpanded ? (
                      <ChevronDown size={16} className="text-gray-500" />
                    ) : (
                      <ChevronRight size={16} className="text-gray-500" />
                    )}
                  </span>
                )}
                <TruncatedCell content={col.render(row, depth)} />
              </div>
            </td>
          ))}
          {actions && (
            <td className={`${isUltraCompact ? 'px-[2px] py-[1px]' : 'px-6 py-2.5'} text-right sticky right-0 bg-white/80 group-hover:bg-blue-50/30 backdrop-blur-sm transition-colors`}>
              <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all transform translate-x-1 group-hover:translate-x-0">
                {actions(row)}
              </div>
            </td>
          )}
        </tr>
      );

      // Wenn expanded und hat Kinder, rekursiv Kinder rendern
      if (isExpanded && hasChildren) {
        result.push(...renderRows(children, depth + 1));
      }
    });

    return result;
  };

  // DEV: Drag & Drop Handlers für Column Reordering
  const handleDragStart = (e: React.DragEvent, columnKey: string) => {
    e.stopPropagation();
    setDraggedColumnKey(columnKey);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', columnKey);

    // DEV: Custom drag image (optional)
    if (e.currentTarget instanceof HTMLElement) {
      e.dataTransfer.setDragImage(e.currentTarget, 20, 20);
    }
  };

  const handleDragOver = (e: React.DragEvent, columnKey: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (draggedColumnKey && draggedColumnKey !== columnKey) {
      setDragOverColumnKey(columnKey);
      e.dataTransfer.dropEffect = 'move';
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverColumnKey(null);
  };

  const handleDrop = (e: React.DragEvent, targetColumnKey: string) => {
    e.preventDefault();
    e.stopPropagation();

    if (!draggedColumnKey || draggedColumnKey === targetColumnKey) {
      setDraggedColumnKey(null);
      setDragOverColumnKey(null);
      return;
    }

    // DEV: Reorder orderKeys
    if (!canReorderColumn(draggedColumnKey) || !canReorderColumn(targetColumnKey)) {
      setDraggedColumnKey(null);
      setDragOverColumnKey(null);
      return;
    }

    const newOrderKeys = applyLayoutLocks(columnOrderKeys);
    const draggedIndex = newOrderKeys.indexOf(draggedColumnKey);
    const targetIndex = newOrderKeys.indexOf(targetColumnKey);

    if (draggedIndex !== -1 && targetIndex !== -1) {
      // Remove dragged item
      newOrderKeys.splice(draggedIndex, 1);
      // Insert at target position
      newOrderKeys.splice(targetIndex, 0, draggedColumnKey);

      updateColumnState(visibleColumnKeys, newOrderKeys);
    }

    setDraggedColumnKey(null);
    setDragOverColumnKey(null);
  };

  const handleDragEnd = () => {
    setDraggedColumnKey(null);
    setDragOverColumnKey(null);
  };

  // DEV: Keyboard-Support für Column Reordering (Alt+←/→)
  const handleColumnKeyDown = (e: React.KeyboardEvent, columnKey: string) => {
    if (!canReorderColumn(columnKey)) return;

    // Alt+← (move left) or Alt+→ (move right)
    if (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      e.preventDefault();

      const currentIndex = columnOrderKeys.indexOf(columnKey);
      if (currentIndex === -1) return;

      const newIndex = e.key === 'ArrowLeft' ? currentIndex - 1 : currentIndex + 1;

      // Check bounds
      if (newIndex < 0 || newIndex >= columnOrderKeys.length) return;

      // Swap positions
      const newOrderKeys = [...columnOrderKeys];
      [newOrderKeys[currentIndex], newOrderKeys[newIndex]] = [newOrderKeys[newIndex], newOrderKeys[currentIndex]];

      updateColumnState(visibleColumnKeys, newOrderKeys);
    }
  };

  return (
    <div className="w-full bg-white border border-gray-200 rounded-xl shadow-sm flex h-full min-h-0 flex-col overflow-hidden">
      {/* Toolbar */}
      <div className={`${isUltraCompact ? 'px-[2px] py-[2px] border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-[2px]' : 'px-3 py-3 sm:px-6 sm:py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4'}`}>
        <div className={`flex w-full min-w-0 items-center justify-between sm:w-auto sm:justify-start ${isUltraCompact ? 'gap-[2px]' : 'gap-3 sm:gap-4'}`}>
          <h2 className="min-w-0 truncate text-lg font-bold text-gray-900 leading-none">{title}</h2>
          {primaryAction && (
            <button
              onClick={primaryAction.onClick}
              aria-label={primaryAction.ariaLabel ?? primaryAction.label}
              title={primaryAction.title ?? primaryAction.ariaLabel ?? primaryAction.label}
              className={primaryAction.iconOnly
                ? 'inline-flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white transition-colors shadow-sm hover:bg-blue-700'
                : 'inline-flex shrink-0 items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition-colors shadow-sm'}
            >
              <Plus size={primaryAction.iconOnly ? 18 : 14} />
              {!primaryAction.iconOnly && primaryAction.label}
            </button>
          )}
        </div>

        <div className={`flex w-full min-w-0 flex-wrap items-center ${isUltraCompact ? 'gap-[2px]' : 'gap-2 sm:w-auto sm:flex-nowrap sm:gap-3'}`}>
          {search && (
            <div className="relative min-w-[96px] flex-1 sm:max-w-xs sm:flex-none sm:w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                placeholder={search.placeholder || 'Suchen...'}
                value={search.value}
                onChange={(e) => search.onChange(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-inner"
              />
            </div>
          )}

          {filters && filters.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setFilterPanelOpen(!filterPanelOpen)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 border text-xs font-bold rounded-lg transition-colors shadow-sm ${
                  activeFilterCount > 0
                    ? 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100'
                    : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
                title="Filter"
              >
                <SlidersHorizontal size={14} />
                {activeFilterCount > 0 ? `${activeFilterCount} Filter` : 'Filter'}
              </button>

              {filterPanelOpen && (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setFilterPanelOpen(false)} />
                  <div className="fixed left-3 right-3 top-24 z-30 max-h-[72vh] overflow-y-auto rounded-lg border border-gray-200 bg-white py-2 shadow-lg sm:absolute sm:left-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-72">
                    <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
                      <h3 className="text-xs font-bold text-gray-700 uppercase">Filter</h3>
                      {activeFilterCount > 0 && (
                        <button
                          type="button"
                          onClick={resetFilters}
                          className="text-xs font-medium text-blue-600 hover:text-blue-700"
                        >
                          Zurücksetzen
                        </button>
                      )}
                    </div>
                    <div className="max-h-80 overflow-y-auto px-3 py-2 space-y-3">
                      {filters.map((filter) => {
                        const value = activeFilterValues[filter.key];
                        const rangeValue = value && typeof value === 'object' && !Array.isArray(value) ? value : {};

                        if (filter.type === 'select') {
                          return (
                            <label key={filter.key} className="block space-y-1">
                              <span className="text-xs font-semibold text-gray-600">{filter.label}</span>
                              <select
                                value={typeof value === 'string' ? value : ''}
                                onChange={(e) => updateFilterValue(filter.key, e.target.value || undefined)}
                                className="w-full rounded-md border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                              >
                                <option value="">Alle</option>
                                {(filter.options ?? []).map((option) => (
                                  <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                              </select>
                            </label>
                          );
                        }

                        if (filter.type === 'text') {
                          return (
                            <label key={filter.key} className="block space-y-1">
                              <span className="text-xs font-semibold text-gray-600">{filter.label}</span>
                              <input
                                type="text"
                                value={typeof value === 'string' ? value : ''}
                                placeholder={filter.placeholder ?? 'Suchen...'}
                                onChange={(e) => updateFilterValue(filter.key, e.target.value)}
                                className="w-full rounded-md border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                              />
                            </label>
                          );
                        }

                        if (filter.type === 'dateRange' || filter.type === 'numberRange') {
                          return (
                            <div key={filter.key} className="space-y-1">
                              <span className="text-xs font-semibold text-gray-600">{filter.label}</span>
                              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                <input
                                  type={filter.type === 'dateRange' ? 'date' : 'number'}
                                  value={rangeValue.from ?? ''}
                                  placeholder="Von"
                                  onChange={(e) => updateFilterValue(filter.key, { ...rangeValue, from: e.target.value })}
                                  className="w-full rounded-md border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                />
                                <input
                                  type={filter.type === 'dateRange' ? 'date' : 'number'}
                                  value={rangeValue.to ?? ''}
                                  placeholder="Bis"
                                  onChange={(e) => updateFilterValue(filter.key, { ...rangeValue, to: e.target.value })}
                                  className="w-full rounded-md border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                />
                              </div>
                            </div>
                          );
                        }

                        return null;
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* DEV: Column Chooser Button */}
          {columnChooserEnabled && (
            <div className="relative">
              <button
                onClick={() => {
                  if (columnReorderMode) {
                    setColumnReorderMode(false);
                    setColumnChooserOpen(false);
                    return;
                  }

                  setColumnChooserOpen(!columnChooserOpen);
                }}
                className={columnReorderMode
                  ? 'inline-flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white transition-colors shadow-sm hover:bg-blue-700'
                  : 'inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 text-gray-700 text-xs font-bold rounded-lg hover:bg-gray-50 transition-colors shadow-sm'}
                title={columnReorderMode ? 'Spaltenposition speichern' : 'Spalten auswählen'}
                aria-label={columnReorderMode ? 'Spaltenposition speichern' : 'Spalten auswählen'}
              >
                {columnReorderMode ? (
                  <Check size={16} />
                ) : (
                  <>
                    <Columns size={14} />
                    Spalten
                  </>
                )}
              </button>

              {/* Column Chooser Dropdown */}
              {columnChooserOpen && (
                <>
                  {/* Overlay zum Schließen */}
                  <div
                    className="fixed inset-0 z-20"
                    onClick={() => setColumnChooserOpen(false)}
                  />

                  {/* Dropdown Panel */}
                  <div className="fixed left-3 right-3 top-24 z-30 max-h-[72vh] overflow-y-auto rounded-lg border border-gray-200 bg-white py-2 shadow-lg sm:absolute sm:left-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-64">
                    <div className="px-3 py-2 border-b border-gray-100">
                      <h3 className="text-xs font-bold text-gray-700 uppercase">Spalten anzeigen</h3>
                    </div>

                    {/* Column Checkboxes */}
                    <div className="max-h-64 overflow-y-auto py-1">
                      {columns.map((col) => {
                        const isVisible = visibleColumnKeys.includes(col.key);
                        const isRequired = requiredColumnKeys.includes(col.key);
                        const isLastVisible = visibleColumnKeys.length === 1 && isVisible;

                        return (
                          <label
                            key={col.key}
                            className={`flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 cursor-pointer ${isLastVisible || isRequired ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            <input
                              type="checkbox"
                              checked={isVisible}
                              disabled={isLastVisible || isRequired}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  updateColumnState([...visibleColumnKeys, col.key]);
                                } else {
                                  updateColumnState(visibleColumnKeys.filter(k => k !== col.key));
                                }
                              }}
                              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-700">{col.header}{isRequired ? ' *' : ''}</span>
                          </label>
                        );
                      })}
                    </div>

                    {columnVisibility?.enableReordering && (
                      <div className="border-t border-gray-100 px-3 py-2">
                        <button
                          type="button"
                          onClick={() => {
                            setColumnReorderMode(true);
                            setColumnChooserOpen(false);
                          }}
                          className="w-full rounded bg-gray-50 px-2 py-1.5 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-100"
                        >
                          Spalten anordnen
                        </button>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="px-3 py-2 border-t border-gray-100 flex gap-2">
                      <button
                        onClick={() => updateColumnState(availableColumnKeys, defaultOrderColumnKeys)}
                        className="flex-1 px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded transition-colors"
                      >
                        Alle anzeigen
                      </button>
                      <button
                        onClick={() => {
                          updateColumnState(defaultVisibleColumnKeys, defaultOrderColumnKeys);
                        }}
                        className="flex-1 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 rounded transition-colors"
                      >
                        Zurücksetzen
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Table Container */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-separate border-spacing-0 text-left">
          <thead className="sticky top-0 z-10 bg-gray-50/95 backdrop-blur-sm border-b border-gray-200">
            <tr>
              {visibleColumns.map((col) => {
                const isReorderable = canReorderColumn(col.key);
                const isDragging = draggedColumnKey === col.key;
                const isDragOver = dragOverColumnKey === col.key;

                return (
                  <th
                    key={col.key}
                    className={`${isUltraCompact ? 'px-[2px] py-[1px] text-[11px]' : 'px-6 py-3 text-[11px]'} font-bold text-gray-500 uppercase tracking-wider border-b border-gray-100 ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'} ${isDragging ? 'opacity-40' : ''} ${isDragOver ? 'bg-blue-100/50' : ''} relative`}
                    style={{ width: col.width }}
                    onDragOver={isReorderable ? (e) => handleDragOver(e, col.key) : undefined}
                    onDragLeave={isReorderable ? handleDragLeave : undefined}
                    onDrop={isReorderable ? (e) => handleDrop(e, col.key) : undefined}
                  >
                    <div className={`flex items-center gap-1.5 ${col.align === 'right' ? 'justify-end' : col.align === 'center' ? 'justify-center' : 'justify-start'}`}>
                      {/* DEV: Drag Handle (nur wenn reordering enabled) */}
                      {isReorderable && (
                        <button
                          draggable
                          onDragStart={(e) => handleDragStart(e, col.key)}
                          onDragEnd={handleDragEnd}
                          onKeyDown={(e) => handleColumnKeyDown(e, col.key)}
                          onClick={(e) => e.stopPropagation()}
                          className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 transition-colors p-0.5 -ml-1 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
                          title="Spalte verschieben (Drag oder Alt+←/→)"
                          aria-label="Spalte verschieben"
                          tabIndex={0}
                        >
                          <GripVertical size={14} />
                        </button>
                      )}

                      {/* DEV: Header Text (klickbar für Sort) */}
                      <span
                        onClick={() => col.sortable && handleSort(col.key)}
                        className={col.sortable ? 'cursor-pointer hover:text-gray-700 transition-colors select-none' : ''}
                      >
                        {col.headerContent ?? col.header}
                      </span>

                      {/* DEV: Sort Indicator */}
                      {col.sortable && sortConfig?.key === col.key && (
                        sortConfig.direction === 'asc' ? <ChevronUp size={12} className="text-blue-500" /> : <ChevronDown size={12} className="text-blue-500" />
                      )}
                    </div>
                  </th>
                );
              })}
              {actions && (
                <th className={`${isUltraCompact ? 'px-[2px] py-[1px]' : 'px-6 py-3'} text-[11px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-100 text-right sticky right-0 bg-gray-50/95`}>
                  Aktionen
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr className="bg-white">
                <td colSpan={columns.length + (actions ? 1 : 0)} className="p-0">
                  {renderLoading()}
                </td>
              </tr>
            ) : error ? (
              <tr className="bg-white">
                <td colSpan={columns.length + (actions ? 1 : 0)} className="p-0">
                  {renderError()}
                </td>
              </tr>
            ) : sortedRows.length === 0 ? (
              <tr className="bg-white">
                <td colSpan={columns.length + (actions ? 1 : 0)} className="p-0">
                  {renderEmpty()}
                </td>
              </tr>
            ) : (
              renderRows(sortedRows)
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Helper component for truncated cells with tooltip
 */
function TruncatedCell({ content }: { content: React.ReactNode }) {
  // If content is just a string, we can use ellipsis.
  // If it's a React element, we just render it.
  if (typeof content !== 'string') {
    return <div className="flex items-center">{content}</div>;
  }

  return (
    <div className="relative group/cell flex items-center max-w-full">
      <span className="truncate block w-full text-gray-600" title={content}>
        {content}
      </span>
      {/* Optional: we could use the Tooltip component here if title attribute is not enough */}
    </div>
  );
}
