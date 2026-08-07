import { describe, expect, it } from 'vitest';
import type { Location, LocationCustomer } from './types';
import {
  filterLocationsForCustomer,
  resolveLocationForCustomerChange,
} from './assetAssignmentUtils';

const location = (id: string, name = id): Location => ({
  id,
  name,
  addressLine: null,
  gpsDecimalLat: null,
  gpsDecimalLng: null,
  gpsDmsLat: null,
  gpsDmsLng: null,
  tagIds: [],
  notes: null,
  createdAt: '2026-06-04T00:00:00.000Z',
  updatedAt: '2026-06-04T00:00:00.000Z',
});

const link = (customerId: string, locationId: string): LocationCustomer => ({
  id: `${customerId}-${locationId}`,
  customerId,
  locationId,
  createdAt: '2026-06-04T00:00:00.000Z',
  updatedAt: '2026-06-04T00:00:00.000Z',
});

describe('assetAssignmentUtils', () => {
  it('filters locations by selected customer links', () => {
    const locations = [location('loc-a'), location('loc-b'), location('loc-c')];
    const links = [link('customer-a', 'loc-a'), link('customer-b', 'loc-b')];

    expect(filterLocationsForCustomer(locations, links, 'customer-a')).toEqual([
      locations[0],
    ]);
  });

  it('returns no locations when no customer is selected', () => {
    const locations = [location('loc-a')];
    const links = [link('customer-a', 'loc-a')];

    expect(filterLocationsForCustomer(locations, links, null)).toEqual([]);
  });

  it('keeps selected location when it belongs to the new customer', () => {
    const links = [link('customer-a', 'loc-a')];

    expect(resolveLocationForCustomerChange('customer-a', 'loc-a', links)).toBe('loc-a');
  });

  it('clears selected location when customer changes to an unrelated customer', () => {
    const links = [link('customer-a', 'loc-a'), link('customer-b', 'loc-b')];

    expect(resolveLocationForCustomerChange('customer-b', 'loc-a', links)).toBeNull();
  });

  it('clears selected location when customer is removed', () => {
    const links = [link('customer-a', 'loc-a')];

    expect(resolveLocationForCustomerChange(null, 'loc-a', links)).toBeNull();
  });
});
