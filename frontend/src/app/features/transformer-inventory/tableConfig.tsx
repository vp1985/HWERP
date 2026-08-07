import { useState } from 'react';
import type { DataTableColumn } from '../../components/ui/DataTable';
import type { TransformerInventoryItem, TransformerInventoryReservation, TransformerInventoryStatus, TransformerInventorySummary } from './types';
import { allTransformerInventoryStatusFilters, getTransformerStatus } from './utils';

export const transformerStatusLabels: Record<TransformerInventoryStatus, string> = {
  available: 'Verfügbar',
  reserved: 'Reserviert',
  sold: 'Verkauft',
  scrapped: 'Schrott',
  unchecked: 'Ungeprüft',
};

const transformerStatusClasses: Record<TransformerInventoryStatus, string> = {
  available: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  reserved: 'bg-blue-50 text-blue-700 border-blue-200',
  sold: 'bg-amber-50 text-amber-700 border-amber-200',
  scrapped: 'bg-rose-50 text-rose-700 border-rose-200',
  unchecked: 'bg-slate-50 text-slate-600 border-slate-200',
};

export interface TransformerInventoryColumnOptions {
  canViewPrices: boolean;
  hidePrices: boolean;
  revealPrices: boolean;
  reservations?: TransformerInventoryReservation[];
  onOpenDetail?: (item: TransformerInventoryItem) => void;
  statusFilter?: {
    selectedStatuses: TransformerInventoryStatus[];
    summary: TransformerInventorySummary;
    onToggle: (status: TransformerInventoryStatus) => void;
    onSelectAll: () => void;
    onSelectNone: () => void;
  };
}

function StatusFilterHeader({ statusFilter }: { statusFilter: NonNullable<TransformerInventoryColumnOptions['statusFilter']> }) {
  const [open, setOpen] = useState<boolean>(false);

  return (
    <div className="relative inline-flex justify-center" onClick={(event) => event.stopPropagation()}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-bold uppercase tracking-wider text-gray-500 hover:bg-gray-100 hover:text-gray-800"
        title="Statusfilter öffnen"
      >
        Status
        <span aria-hidden="true">▾</span>
      </button>

      {open && (
        <div className="absolute left-1/2 top-full z-30 mt-2 w-56 -translate-x-1/2 rounded-xl border border-gray-200 bg-white p-2 text-left normal-case tracking-normal shadow-xl">
          <div className="mb-2 flex gap-2 border-b border-gray-100 pb-2">
            <button
              type="button"
              onClick={statusFilter.onSelectAll}
              className="flex-1 rounded-lg border border-gray-200 px-2 py-1 text-[11px] font-semibold text-gray-700 hover:bg-gray-50"
            >
              Alle Status aktivieren
            </button>
            <button
              type="button"
              onClick={statusFilter.onSelectNone}
              className="flex-1 rounded-lg border border-gray-200 px-2 py-1 text-[11px] font-semibold text-gray-700 hover:bg-gray-50"
            >
              Alle aus
            </button>
          </div>

          <div className="space-y-1">
            {allTransformerInventoryStatusFilters.map((status) => {
              const active = statusFilter.selectedStatuses.includes(status);
              return (
                <button
                  key={status}
                  type="button"
                  aria-pressed={active}
                  onClick={() => statusFilter.onToggle(status)}
                  className={`flex w-full items-center justify-between rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${
                    active
                      ? 'border-blue-200 bg-blue-50 text-blue-700'
                      : 'border-gray-200 bg-gray-50 text-gray-400 line-through hover:text-gray-600'
                  }`}
                >
                  <span>{transformerStatusLabels[status]}</span>
                  <span>{statusFilter.summary[status]}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function StatusChip({ status }: { status: TransformerInventoryStatus }) {
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${transformerStatusClasses[status]}`}>
      {transformerStatusLabels[status]}
    </span>
  );
}

function ChannelBadge({ label, active }: { label: string; active: boolean }) {
  return (
    <span className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${active ? 'border-blue-100 bg-blue-50 text-blue-600' : 'border-slate-100 bg-slate-50 text-slate-300'}`}>
      {label}
    </span>
  );
}

function renderMaskedPriceNote(item: TransformerInventoryItem, options: TransformerInventoryColumnOptions) {
  if (!item.priceNote) return '—';
  if (options.hidePrices && !options.revealPrices) {
    return <span className="font-mono text-slate-400">••••••</span>;
  }
  return item.priceNote;
}

export function getDefaultTransformerInventoryColumnKeys(canViewPrices: boolean): string[] {
  const keys = ['position', 'manufacturer', 'powerKva', 'primaryVoltageKv', 'secondaryVoltageV', 'vectorGroup', 'serialNumber', 'origin', 'constructionYear', 'status', 'channels', 'note'];
  return canViewPrices ? [...keys, 'priceNote'] : keys;
}

export function buildTransformerInventoryColumns(options: TransformerInventoryColumnOptions): DataTableColumn<TransformerInventoryItem>[] {
  const columns: DataTableColumn<TransformerInventoryItem>[] = [
    {
      key: 'position',
      header: 'Pos.',
      width: 96,
      sortable: true,
      sortValue: (item) => Number(item.position.replace(/\D/g, '')) || item.position,
      render: (item) => (
        <button
          type="button"
          aria-label={`${item.position} HT-Nummer öffnen`}
          onClick={(event) => {
            event.stopPropagation();
            options.onOpenDetail?.(item);
          }}
          className="font-mono font-bold text-blue-600 underline-offset-2 hover:underline"
        >
          {item.position}
        </button>
      ),
    },
    {
      key: 'manufacturer',
      header: 'Hersteller',
      width: 130,
      sortable: true,
      sortValue: (item) => item.manufacturer || '',
      render: (item) => <span className="font-semibold text-slate-900">{item.manufacturer || '—'}</span>,
    },
    {
      key: 'powerKva',
      header: 'kVA',
      width: 80,
      sortable: true,
      sortValue: (item) => item.powerKva ?? -1,
      render: (item) => item.powerKva ?? '—',
    },
    {
      key: 'primaryVoltageKv',
      header: 'OS',
      width: 80,
      sortable: true,
      sortValue: (item) => item.primaryVoltageKv ?? -1,
      render: (item) => (item.primaryVoltageKv ? `${item.primaryVoltageKv} kV` : '—'),
    },
    {
      key: 'secondaryVoltageV',
      header: 'US',
      width: 80,
      sortable: true,
      sortValue: (item) => item.secondaryVoltageV ?? -1,
      render: (item) => (item.secondaryVoltageV ? `${item.secondaryVoltageV} V` : '—'),
    },
    {
      key: 'vectorGroup',
      header: 'Schaltgr.',
      width: 95,
      sortable: true,
      render: (item) => item.vectorGroup || '—',
    },
    {
      key: 'serialNumber',
      header: 'Seriennr.',
      width: 115,
      sortable: true,
      sortValue: (item) => item.serialNumber || '',
      render: (item) => item.serialNumber || '—',
    },
    {
      key: 'origin',
      header: 'Herkunft',
      width: 130,
      sortable: true,
      sortValue: (item) => item.origin || '',
      render: (item) => item.origin || 'offen',
    },
    {
      key: 'constructionYear',
      header: 'Bj.',
      width: 80,
      align: 'center',
      sortable: true,
      sortValue: (item) => item.constructionYear,
      render: (item) => item.constructionYear || '—',
    },
    {
      key: 'constructionType',
      header: 'Bauart',
      width: 130,
      sortable: true,
      render: (item) => item.constructionType || '—',
    },
    {
      key: 'status',
      header: 'Status',
      headerContent: options.statusFilter ? <StatusFilterHeader statusFilter={options.statusFilter} /> : undefined,
      width: 115,
      align: 'center',
      render: (item) => <StatusChip status={getTransformerStatus(item, options.reservations ?? [])} />,
    },
    {
      key: 'channels',
      header: 'Kanäle',
      width: 210,
      render: (item) => (
        <div className="flex flex-wrap gap-1">
          <ChannelBadge label="Export" active={item.exportListed} />
          <ChannelBadge label="Resale" active={item.resaleListed} />
          <ChannelBadge label="Maschinen" active={item.maschinensucherListed} />
        </div>
      ),
    },
    {
      key: 'note',
      header: 'Notiz',
      width: 220,
      render: (item) => item.note || item.soldTo || '—',
    },
  ];

  if (options.canViewPrices) {
    columns.push({
      key: 'priceNote',
      header: 'Preisnotiz',
      width: 150,
      render: (item) => renderMaskedPriceNote(item, options),
    });
  }

  return columns;
}
