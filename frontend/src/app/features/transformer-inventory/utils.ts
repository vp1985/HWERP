import type {
  TransformerInventoryCalculationLink,
  TransformerInventoryDetailOverride,
  TransformerInventoryItem,
  TransformerInventoryReservation,
  TransformerInventoryStatus,
  TransformerInventorySummary,
} from './types';

export const allTransformerInventoryStatusFilters: TransformerInventoryStatus[] = ['available', 'reserved', 'sold', 'scrapped', 'unchecked'];

const emptySummary = (): TransformerInventorySummary => ({
  total: 0,
  available: 0,
  reserved: 0,
  sold: 0,
  scrapped: 0,
  unchecked: 0,
});

function toDay(value: string): string {
  return value.slice(0, 10);
}

function todayDay(): string {
  return new Date().toISOString().slice(0, 10);
}

export function toggleTransformerStatusFilter(
  selectedStatuses: TransformerInventoryStatus[],
  status: TransformerInventoryStatus,
): TransformerInventoryStatus[] {
  if (selectedStatuses.includes(status)) {
    return selectedStatuses.filter((selectedStatus) => selectedStatus !== status);
  }

  return allTransformerInventoryStatusFilters.filter((filterStatus) => [...selectedStatuses, status].includes(filterStatus));
}

export function findActiveTransformerReservation(
  inventoryPosition: string,
  reservations: TransformerInventoryReservation[] = [],
  currentDate: string = todayDay(),
): TransformerInventoryReservation | null {
  const day = toDay(currentDate);
  return reservations.find((reservation) => (
    reservation.inventoryPosition === inventoryPosition
    && reservation.status === 'active'
    && reservation.reservedFrom <= day
    && reservation.reservedUntil >= day
  )) ?? null;
}

export function getTransformerStatus(
  item: TransformerInventoryItem,
  reservations: TransformerInventoryReservation[] = [],
  currentDate: string = todayDay(),
): TransformerInventoryStatus {
  const soldTo = item.soldTo.trim().toLowerCase();
  const note = item.note.trim().toLowerCase();

  if (soldTo.includes('verschrottet') || note.includes('schrott')) {
    return 'scrapped';
  }

  if (soldTo || note.includes('verkauft')) {
    return 'sold';
  }

  if (findActiveTransformerReservation(item.position, reservations, currentDate)) {
    return 'reserved';
  }

  if (item.availableListed || item.resaleListed || item.maschinensucherListed || item.exportListed) {
    return 'available';
  }

  return 'unchecked';
}

export function deriveTransformerInventorySummary(
  items: TransformerInventoryItem[],
  reservations: TransformerInventoryReservation[] = [],
  currentDate: string = todayDay(),
): TransformerInventorySummary {
  return items.reduce<TransformerInventorySummary>(
    (summary, item) => {
      summary.total += 1;
      summary[getTransformerStatus(item, reservations, currentDate)] += 1;
      return summary;
    },
    emptySummary(),
  );
}

export function formatTransformerTitle(item: TransformerInventoryItem): string {
  const power = item.powerKva ? `${item.powerKva} kVA` : 'kVA offen';
  const voltage = [item.primaryVoltageKv ? `${item.primaryVoltageKv} kV` : null, item.secondaryVoltageV ? `${item.secondaryVoltageV} V` : null]
    .filter(Boolean)
    .join(' / ');
  return [item.manufacturer, power, voltage].filter(Boolean).join(' · ');
}

export function filterTransformerInventory(
  items: TransformerInventoryItem[],
  query: string,
  selectedStatuses: TransformerInventoryStatus[] = allTransformerInventoryStatusFilters,
  reservations: TransformerInventoryReservation[] = [],
  calculationLinks: TransformerInventoryCalculationLink[] = [],
  customerNamesById: Record<string, string> = {},
  currentDate: string = todayDay(),
): TransformerInventoryItem[] {
  const activeStatusSet = new Set(selectedStatuses);
  const statusFilteredItems = items.filter((item) => activeStatusSet.has(getTransformerStatus(item, reservations, currentDate)));
  const terms = query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  if (terms.length === 0) return statusFilteredItems;

  return statusFilteredItems.filter((item) => {
    const itemReservations = reservations.filter((reservation) => reservation.inventoryPosition === item.position);
    const itemCalculationLinks = calculationLinks.filter((link) => link.inventoryPosition === item.position);
    const searchable = [
      item.position,
      item.manufacturer,
      item.serialNumber,
      item.vectorGroup,
      item.constructionType,
      item.origin,
      item.connectionType,
      item.note,
      item.soldTo,
      item.powerKva ? `${item.powerKva}` : '',
      item.primaryVoltageKv && item.secondaryVoltageV ? `${item.primaryVoltageKv}/${item.secondaryVoltageV}` : '',
      item.primaryVoltageKv ? `${item.primaryVoltageKv}` : '',
      item.secondaryVoltageV ? `${item.secondaryVoltageV}` : '',
      ...itemReservations.flatMap((reservation) => [reservation.note ?? '', reservation.reservedFrom, reservation.reservedUntil, customerNamesById[reservation.customerId] ?? '']),
      ...itemCalculationLinks.flatMap((link) => [link.calculatedAt, link.note ?? '', customerNamesById[link.customerId] ?? '', link.calculationId]),
    ]
      .join(' ')
      .toLowerCase();

    return terms.every((term) => searchable.includes(term));
  });
}

export function hasReservationConflict(
  reservations: TransformerInventoryReservation[],
  request: { inventoryPosition: string; reservedFrom: string; reservedUntil: string; ignoreReservationId?: string | null },
): boolean {
  return reservations.some((reservation) => (
    reservation.id !== request.ignoreReservationId
    && reservation.inventoryPosition === request.inventoryPosition
    && reservation.status === 'active'
    && reservation.reservedFrom <= request.reservedUntil
    && reservation.reservedUntil >= request.reservedFrom
  ));
}

export function validateTransformerReservationRequest(
  item: TransformerInventoryItem,
  reservations: TransformerInventoryReservation[],
  request: { customerId: string; reservedFrom: string; reservedUntil: string; calculationId?: string | null; ignoreReservationId?: string | null },
): { valid: true } | { valid: false; reason: string } {
  if (!request.customerId) return { valid: false, reason: 'Bitte einen Kunden auswählen.' };
  if (!request.reservedFrom || !request.reservedUntil) return { valid: false, reason: 'Bitte Von- und Bis-Datum setzen.' };
  if (request.reservedUntil < request.reservedFrom) return { valid: false, reason: 'Das Bis-Datum darf nicht vor dem Von-Datum liegen.' };
  const status = getTransformerStatus(item, [], request.reservedFrom);
  if (status === 'sold' || status === 'scrapped') return { valid: false, reason: 'Verkaufte oder verschrottete Trafos können nicht reserviert werden.' };
  if (hasReservationConflict(reservations, { inventoryPosition: item.position, reservedFrom: request.reservedFrom, reservedUntil: request.reservedUntil, ignoreReservationId: request.ignoreReservationId })) {
    return { valid: false, reason: 'Für diesen Zeitraum gibt es bereits eine aktive Reservierung.' };
  }
  return { valid: true };
}

export function mergeInventoryDetailOverride(
  item: TransformerInventoryItem,
  override: TransformerInventoryDetailOverride | null | undefined,
): TransformerInventoryItem {
  if (!override) return { ...item };
  const sanitizedFields = Object.fromEntries(
    Object.entries(override.fields).filter(([, value]) => value !== undefined && value !== ''),
  );
  return { ...item, ...sanitizedFields };
}

export function getLatestCalculationLink(
  inventoryPosition: string,
  links: TransformerInventoryCalculationLink[] = [],
): TransformerInventoryCalculationLink | null {
  return [...links]
    .filter((link) => link.inventoryPosition === inventoryPosition)
    .sort((a, b) => Date.parse(b.calculatedAt) - Date.parse(a.calculatedAt))[0] ?? null;
}
