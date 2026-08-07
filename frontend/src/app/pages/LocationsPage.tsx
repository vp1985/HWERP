import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Plus, Search, Edit2, Trash2 } from 'lucide-react';
import { useAppStore } from '../context/AppStoreContext';
import { Location, LocationCustomer, Customer } from '../lib/types';
import { Tag } from '../types/tag';
import { TagBadge } from '../components/TagBadge';

export default function LocationsPage() {
  const { repository } = useAppStore();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [locations, setLocations] = useState<Location[]>([]);
  const [locationCustomers, setLocationCustomers] = useState<LocationCustomer[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);

  // Daten laden
  useEffect(() => {
    async function loadData() {
      const [locsData, lcData, custsData, tagsData] = await Promise.all([
        repository.list<Location>('locations'),
        repository.list<LocationCustomer>('locationCustomers'),
        repository.list<Customer>('customers'),
        repository.list<Tag>('tags'),
      ]);
      setLocations(locsData);
      setLocationCustomers(lcData);
      setCustomers(custsData);
      setTags(tagsData);
    }
    loadData();
  }, [repository]);

  // Filtere Locations nach Suchbegriff (name oder addressLine)
  const filteredLocations = locations.filter((loc) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const name = loc.name.toLowerCase();
    const address = (loc.addressLine || '').toLowerCase();
    return name.includes(query) || address.includes(query);
  });

  // Kunde-IDs pro Location ermitteln
  const getCustomersForLocation = (locationId: string): Customer[] => {
    const customerIds = locationCustomers
      .filter((lc) => lc.locationId === locationId)
      .map((lc) => lc.customerId);
    return customers.filter((c) => customerIds.includes(c.id));
  };

  // Tags für Location ermitteln
  const getTagsForLocation = (tagIds: string[]): Tag[] => {
    return tags.filter((t) => tagIds.includes(t.id));
  };

  // Löschen mit Confirm
  const handleDelete = async (location: Location) => {
    const confirmed = window.confirm(
      `Standort "${location.name}" wirklich löschen?`
    );
    if (confirmed) {
      const relatedLinks = locationCustomers.filter(
        (lc) => lc.locationId === location.id
      );
      for (const link of relatedLinks) {
        await repository.delete('locationCustomers', link.id);
      }
      await repository.delete('locations', location.id);
      const [locsData, lcData] = await Promise.all([
        repository.list<Location>('locations'),
        repository.list<LocationCustomer>('locationCustomers'),
      ]);
      setLocations(locsData);
      setLocationCustomers(lcData);
    }
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Standorte</h1>
        <Link
          to="/locations/new"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          <Plus size={20} />
          Neuer Standort
        </Link>
      </div>

      {/* Suche */}
      <div className="mb-6 flex items-center gap-2 max-w-md">
        <div className="relative flex-1">
          <Search
            className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
            size={20}
          />
          <input
            type="text"
            placeholder="Suche nach Name oder Adresse..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded"
          />
        </div>
      </div>

      {/* Tabelle */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kunden</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">GPS</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tags</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Aktionen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredLocations.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                  {searchQuery ? 'Keine Standorte gefunden.' : 'Noch keine Standorte vorhanden.'}
                </td>
              </tr>
            ) : (
              filteredLocations.map((location) => {
                const linkedCustomers = getCustomersForLocation(location.id);
                const locationTags = getTagsForLocation(location.tagIds);
                return (
                  <tr key={location.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{location.name}</div>
                      {location.addressLine && (
                        <div className="text-sm text-gray-500">{location.addressLine}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {linkedCustomers.length === 0 ? (
                        <span className="text-gray-400">—</span>
                      ) : (
                        <div>
                          <div className="font-medium">
                            {linkedCustomers.length} {linkedCustomers.length === 1 ? 'Kunde' : 'Kunden'}
                          </div>
                          {linkedCustomers.length <= 2 && (
                            <div className="text-xs text-gray-500">
                              {linkedCustomers.map((c) => c.name).join(', ')}
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {location.gpsDecimalLat && location.gpsDecimalLng ? (
                        <span>{location.gpsDecimalLat.toFixed(4)}, {location.gpsDecimalLng.toFixed(4)}</span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {locationTags.length === 0 ? (
                          <span className="text-sm text-gray-400">—</span>
                        ) : (
                          locationTags.map((tag) => (
                            <TagBadge key={tag.id} tag={tag} size="sm" />
                          ))
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => navigate(`/locations/${location.id}`)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Bearbeiten"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(location)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Löschen"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
