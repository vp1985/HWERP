import type { Location, LocationCustomer } from './types';

export function filterLocationsForCustomer(
  locations: Location[],
  locationCustomers: LocationCustomer[],
  customerId: string | null,
): Location[] {
  if (!customerId) return [];

  const allowedLocationIds = new Set(
    locationCustomers
      .filter((link) => link.customerId === customerId)
      .map((link) => link.locationId),
  );

  return locations.filter((location) => allowedLocationIds.has(location.id));
}

export function resolveLocationForCustomerChange(
  nextCustomerId: string | null,
  currentLocationId: string | null,
  locationCustomers: LocationCustomer[],
): string | null {
  if (!nextCustomerId || !currentLocationId) return null;

  const stillAllowed = locationCustomers.some(
    (link) => link.customerId === nextCustomerId && link.locationId === currentLocationId,
  );

  return stillAllowed ? currentLocationId : null;
}
