import { useCallback } from 'react';
import { useAppStore } from '../context/AppStoreContext';
import {
  Location,
  LocationCustomer,
  ContactPerson,
  CustomerContactPerson,
  LocationContactOverride,
} from '../lib/types';

/**
 * Custom Hook für Location CRUD Operationen
 * Kapselt Repository-Zugriffe und Dispatch-Calls
 */
export function useLocations() {
  const { state, dispatch, repository } = useAppStore();

  const loadLocations = useCallback(async () => {
    const data = await repository.list<Location>('locations');
    dispatch({ type: 'SET_ENTITIES', entity: 'locations', data });
  }, [repository, dispatch]);

  const loadLocationCustomers = useCallback(async () => {
    const data = await repository.list<LocationCustomer>('locationCustomers');
    dispatch({ type: 'SET_ENTITIES', entity: 'locationCustomers', data });
  }, [repository, dispatch]);

  const loadContactPersons = useCallback(async () => {
    const data = await repository.list<ContactPerson>('contactPersons');
    dispatch({ type: 'SET_ENTITIES', entity: 'contactPersons', data });
  }, [repository, dispatch]);

  const loadCustomerContactPersons = useCallback(async () => {
    const data = await repository.list<CustomerContactPerson>('customerContactPersons');
    dispatch({ type: 'SET_ENTITIES', entity: 'customerContactPersons', data });
  }, [repository, dispatch]);

  const loadLocationContactOverrides = useCallback(async () => {
    const data = await repository.list<LocationContactOverride>('locationContactOverrides');
    dispatch({ type: 'SET_ENTITIES', entity: 'locationContactOverrides', data });
  }, [repository, dispatch]);

  const upsertLocation = useCallback(async (location: Location) => {
    const updated = await repository.upsert<Location>('locations', location);
    dispatch({ type: 'UPDATE_ENTITY', entity: 'locations', data: updated });
    return updated;
  }, [repository, dispatch]);

  const upsertLocationCustomer = useCallback(async (locationCustomer: LocationCustomer) => {
    const updated = await repository.upsert<LocationCustomer>('locationCustomers', locationCustomer);
    dispatch({ type: 'UPDATE_ENTITY', entity: 'locationCustomers', data: updated });
    return updated;
  }, [repository, dispatch]);

  const upsertLocationContactOverride = useCallback(async (override: LocationContactOverride) => {
    const updated = await repository.upsert<LocationContactOverride>('locationContactOverrides', override);
    dispatch({ type: 'UPDATE_ENTITY', entity: 'locationContactOverrides', data: updated });
    return updated;
  }, [repository, dispatch]);

  const deleteLocation = useCallback(async (id: string) => {
    await repository.delete('locations', id);
    dispatch({ type: 'DELETE_ENTITY', entity: 'locations', id });
  }, [repository, dispatch]);

  const deleteLocationCustomer = useCallback(async (id: string) => {
    await repository.delete('locationCustomers', id);
    dispatch({ type: 'DELETE_ENTITY', entity: 'locationCustomers', id });
  }, [repository, dispatch]);

  const deleteLocationContactOverride = useCallback(async (id: string) => {
    await repository.delete('locationContactOverrides', id);
    dispatch({ type: 'DELETE_ENTITY', entity: 'locationContactOverrides', id });
  }, [repository, dispatch]);

  return {
    locations: (state.locations || []) as Location[],
    locationCustomers: (state.locationCustomers || []) as LocationCustomer[],
    contactPersons: (state.contactPersons || []) as ContactPerson[],
    customerContactPersons: (state.customerContactPersons || []) as CustomerContactPerson[],
    locationContactOverrides: (state.locationContactOverrides || []) as LocationContactOverride[],
    loadLocations,
    loadLocationCustomers,
    loadContactPersons,
    loadCustomerContactPersons,
    loadLocationContactOverrides,
    upsertLocation,
    upsertLocationCustomer,
    upsertLocationContactOverride,
    deleteLocation,
    deleteLocationCustomer,
    deleteLocationContactOverride,
  };
}
