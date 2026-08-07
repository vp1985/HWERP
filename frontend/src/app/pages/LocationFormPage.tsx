import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import { ArrowLeft, Save, X } from 'lucide-react';
import { useAppStore } from '../context/AppStoreContext';
import {
  Location,
  LocationCustomer,
  Customer,
  ContactPerson,
  CustomerContactPerson,
  LocationContactOverride,
} from '../lib/types';
import { Tag } from '../types/tag';
import { parseDmsToDecimal } from '../lib/gpsUtils';
import { TagBadge } from '../components/TagBadge';
import { v4 as uuidv4 } from 'uuid';
import { useModalClose } from '../hooks/useModalClose';
import { formatCustomerAddress } from './customerAddress';

export default function LocationFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { repository } = useAppStore();
  const isNew = !id;

  // Tabs
  const [activeTab, setActiveTab] = useState<'stammdaten' | 'zuordnungen'>(
    'stammdaten'
  );

  // Form State
  const [name, setName] = useState('');
  const [addressLine, setAddressLine] = useState('');
  const [gpsDecimalLat, setGpsDecimalLat] = useState('');
  const [gpsDecimalLng, setGpsDecimalLng] = useState('');
  const [gpsDmsLat, setGpsDmsLat] = useState('');
  const [gpsDmsLng, setGpsDmsLng] = useState('');
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [notes, setNotes] = useState('');

  // Validation Errors
  const [dmsLatError, setDmsLatError] = useState('');
  const [dmsLngError, setDmsLngError] = useState('');

  // Zuordnungen State
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([]);
  const [manualContactIds, setManualContactIds] = useState<string[]>([]);
  const [showContactPicker, setShowContactPicker] = useState(false);

  // Data state
  const [locations, setLocations] = useState<Location[]>([]);
  const [locationCustomers, setLocationCustomers] = useState<LocationCustomer[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [contactPersons, setContactPersons] = useState<ContactPerson[]>([]);
  const [customerContactPersons, setCustomerContactPersons] = useState<CustomerContactPerson[]>([]);
  const [locationContactOverrides, setLocationContactOverrides] = useState<LocationContactOverride[]>([]);

  const handleCloseContactPicker = useCallback(() => setShowContactPicker(false), []);
  const handleContactPickerBackdropClick = useModalClose(showContactPicker, handleCloseContactPicker);

  // Daten laden
  useEffect(() => {
    async function loadData() {
      const [locsData, lcData, custsData, tagsData, cpData, ccpData, lcoData] = await Promise.all([
        repository.list<Location>('locations'),
        repository.list<LocationCustomer>('locationCustomers'),
        repository.list<Customer>('customers'),
        repository.list<Tag>('tags'),
        repository.list<ContactPerson>('contactPersons'),
        repository.list<CustomerContactPerson>('customerContactPersons'),
        repository.list<LocationContactOverride>('locationContactOverrides'),
      ]);
      setLocations(locsData);
      setLocationCustomers(lcData);
      setCustomers(custsData);
      setTags(tagsData);
      setContactPersons(cpData);
      setCustomerContactPersons(ccpData);
      setLocationContactOverrides(lcoData);
    }
    loadData();
  }, [repository]);

  // Location laden (bei Edit)
  useEffect(() => {
    if (!isNew && id) {
      const location = locations.find((l) => l.id === id);
      if (location) {
        setName(location.name);
        setAddressLine(location.addressLine || '');
        setGpsDecimalLat(
          location.gpsDecimalLat !== null
            ? location.gpsDecimalLat.toString()
            : ''
        );
        setGpsDecimalLng(
          location.gpsDecimalLng !== null
            ? location.gpsDecimalLng.toString()
            : ''
        );
        setGpsDmsLat(location.gpsDmsLat || '');
        setGpsDmsLng(location.gpsDmsLng || '');
        setTagIds(location.tagIds);
        setNotes(location.notes || '');

        // Lade Kunden-Zuordnungen
        const linkedCustomerIds = locationCustomers
          .filter((lc) => lc.locationId === id)
          .map((lc) => lc.customerId);
        setSelectedCustomerIds(linkedCustomerIds);

        // Lade manuelle Ansprechpartner
        const manualIds = locationContactOverrides
          .filter((lco) => lco.locationId === id)
          .map((lco) => lco.contactPersonId);
        setManualContactIds(manualIds);
      }
    }
  }, [isNew, id, locations, locationCustomers, locationContactOverrides]);

  // Geerbte Ansprechpartner berechnen
  const getInheritedContacts = (): ContactPerson[] => {
    const contactIds = customerContactPersons
      .filter((ccp) => selectedCustomerIds.includes(ccp.customerId))
      .map((ccp) => ccp.contactPersonId);
    const uniqueContactIds = Array.from(new Set(contactIds));
    return contactPersons.filter((cp) => uniqueContactIds.includes(cp.id));
  };

  const inheritedContacts = getInheritedContacts();
  const manualContacts = contactPersons.filter((cp) =>
    manualContactIds.includes(cp.id)
  );
  const hasOverrides = manualContactIds.length > 0;

  // Speichern
  const handleSave = async () => {
    if (!name.trim()) {
      alert('Bitte einen Namen eingeben.');
      setActiveTab('stammdaten');
      return;
    }

    let finalDecimalLat: number | null = null;
    let finalDecimalLng: number | null = null;

    if (gpsDecimalLat.trim()) {
      finalDecimalLat = parseFloat(gpsDecimalLat);
    } else if (gpsDmsLat.trim()) {
      const parsed = parseDmsToDecimal(gpsDmsLat);
      if (parsed === null) {
        setDmsLatError('Ungültiges DMS-Format für Latitude');
        setActiveTab('stammdaten');
        return;
      }
      finalDecimalLat = parsed;
    }

    if (gpsDecimalLng.trim()) {
      finalDecimalLng = parseFloat(gpsDecimalLng);
    } else if (gpsDmsLng.trim()) {
      const parsed = parseDmsToDecimal(gpsDmsLng);
      if (parsed === null) {
        setDmsLngError('Ungültiges DMS-Format für Longitude');
        setActiveTab('stammdaten');
        return;
      }
      finalDecimalLng = parsed;
    }

    const now = new Date().toISOString();
    const locationData: Location = {
      id: isNew ? uuidv4() : id!,
      name: name.trim(),
      addressLine: addressLine.trim() || null,
      gpsDecimalLat: finalDecimalLat,
      gpsDecimalLng: finalDecimalLng,
      gpsDmsLat: gpsDmsLat.trim() || null,
      gpsDmsLng: gpsDmsLng.trim() || null,
      tagIds,
      notes: notes.trim() || null,
      createdAt: now,
      updatedAt: now,
    };

    await repository.upsert<Location>('locations', locationData);

    // Kunden-Zuordnungen aktualisieren (diff-basiert)
    if (!isNew && id) {
      const existingLinks = locationCustomers.filter(
        (lc) => lc.locationId === id
      );
      const existingCustomerIds = existingLinks.map((lc) => lc.customerId);

      const toRemove = existingLinks.filter(
        (lc) => !selectedCustomerIds.includes(lc.customerId)
      );
      for (const link of toRemove) {
        await repository.delete('locationCustomers', link.id);
      }

      const toAdd = selectedCustomerIds.filter(
        (cid) => !existingCustomerIds.includes(cid)
      );
      for (const customerId of toAdd) {
        const linkData: LocationCustomer = {
          id: uuidv4(),
          locationId: id,
          customerId,
          createdAt: now,
          updatedAt: now,
        };
        await repository.upsert<LocationCustomer>('locationCustomers', linkData);
      }
    } else {
      for (const customerId of selectedCustomerIds) {
        const linkData: LocationCustomer = {
          id: uuidv4(),
          locationId: locationData.id,
          customerId,
          createdAt: now,
          updatedAt: now,
        };
        await repository.upsert<LocationCustomer>('locationCustomers', linkData);
      }
    }

    // Manuelle Ansprechpartner-Overrides aktualisieren
    if (!isNew && id) {
      const existingOverrides = locationContactOverrides.filter(
        (lco) => lco.locationId === id
      );
      const existingContactIds = existingOverrides.map(
        (lco) => lco.contactPersonId
      );

      const toRemoveOverrides = existingOverrides.filter(
        (lco) => !manualContactIds.includes(lco.contactPersonId)
      );
      for (const override of toRemoveOverrides) {
        await repository.delete('locationContactOverrides', override.id);
      }

      const toAddContactIds = manualContactIds.filter(
        (cid) => !existingContactIds.includes(cid)
      );
      for (const contactPersonId of toAddContactIds) {
        const overrideData: LocationContactOverride = {
          id: uuidv4(),
          locationId: id,
          contactPersonId,
          createdAt: now,
          updatedAt: now,
        };
        await repository.upsert<LocationContactOverride>(
          'locationContactOverrides',
          overrideData
        );
      }
    } else {
      for (const contactPersonId of manualContactIds) {
        const overrideData: LocationContactOverride = {
          id: uuidv4(),
          locationId: locationData.id,
          contactPersonId,
          createdAt: now,
          updatedAt: now,
        };
        await repository.upsert<LocationContactOverride>(
          'locationContactOverrides',
          overrideData
        );
      }
    }

    navigate('/locations');
  };

  // Tags filtern
  const availableTags = tags.filter((t) => {
    if ('context' in t && t.context) {
      return t.context === 'ASSETS' || t.context === null;
    }
    return true;
  });

  const toggleCustomer = (customerId: string) => {
    if (selectedCustomerIds.includes(customerId)) {
      setSelectedCustomerIds(selectedCustomerIds.filter((id) => id !== customerId));
    } else {
      setSelectedCustomerIds([...selectedCustomerIds, customerId]);
    }
  };

  const addManualContact = (contactPersonId: string) => {
    if (!manualContactIds.includes(contactPersonId)) {
      setManualContactIds([...manualContactIds, contactPersonId]);
    }
    setShowContactPicker(false);
  };

  const removeManualContact = (contactPersonId: string) => {
    setManualContactIds(
      manualContactIds.filter((id) => id !== contactPersonId)
    );
  };

  const availableContactsForPicker = contactPersons.filter(
    (cp) => !manualContactIds.includes(cp.id)
  );

  return (
    <div className="p-8 max-w-6xl">
      {/* Header */}
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-2xl font-bold">
          {isNew ? 'Standort anlegen' : 'Standort bearbeiten'}
        </h1>
        <div className="flex gap-2">
          <Link
            to="/locations"
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
          >
            <X size={20} />
            Abbrechen
          </Link>
          <button
            onClick={handleSave}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            <Save size={20} />
            Speichern
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b mb-6">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('stammdaten')}
            className={`px-4 py-2 border-b-2 font-medium transition-colors ${
              activeTab === 'stammdaten'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Stammdaten
          </button>
          <button
            onClick={() => setActiveTab('zuordnungen')}
            className={`px-4 py-2 border-b-2 font-medium transition-colors ${
              activeTab === 'zuordnungen'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Zuordnungen
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'stammdaten' && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="grid grid-cols-2 gap-6">
            {/* Zeile 1: Name + Tags */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border rounded"
                placeholder="z.B. Hauptsitz Berlin"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tags
              </label>
              <div className="flex flex-wrap gap-2 p-2 border rounded min-h-[42px]">
                {tagIds.length === 0 ? (
                  <span className="text-sm text-gray-400">Keine Tags</span>
                ) : (
                  tagIds.map((tid) => {
                    const tag = availableTags.find((t) => t.id === tid);
                    return tag ? (
                      <TagBadge
                        key={tid}
                        tag={tag}
                        size="sm"
                        onRemove={() =>
                          setTagIds(tagIds.filter((id) => id !== tid))
                        }
                      />
                    ) : null;
                  })
                )}
              </div>
              <select
                value=""
                onChange={(e) => {
                  const tid = e.target.value;
                  if (tid && !tagIds.includes(tid)) {
                    setTagIds([...tagIds, tid]);
                  }
                }}
                className="mt-2 w-full px-3 py-2 border rounded text-sm"
              >
                <option value="">Tag hinzufügen...</option>
                {availableTags
                  .filter((t) => !tagIds.includes(t.id))
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
              </select>
            </div>

            {/* Zeile 2: Adresse (volle Breite) */}
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Adresse
              </label>
              <input
                type="text"
                value={addressLine}
                onChange={(e) => setAddressLine(e.target.value)}
                className="w-full px-3 py-2 border rounded"
                placeholder="z.B. Musterstraße 123, 10115 Berlin"
              />
            </div>

            {/* Zeile 3: GPS (4 Felder) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                GPS Decimal Lat
              </label>
              <input
                type="text"
                value={gpsDecimalLat}
                onChange={(e) => setGpsDecimalLat(e.target.value)}
                className="w-full px-3 py-2 border rounded"
                placeholder="z.B. 52.5200"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                GPS Decimal Lng
              </label>
              <input
                type="text"
                value={gpsDecimalLng}
                onChange={(e) => setGpsDecimalLng(e.target.value)}
                className="w-full px-3 py-2 border rounded"
                placeholder="z.B. 13.4050"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                GPS DMS Lat
              </label>
              <input
                type="text"
                value={gpsDmsLat}
                onChange={(e) => {
                  setGpsDmsLat(e.target.value);
                  setDmsLatError('');
                }}
                className={`w-full px-3 py-2 border rounded ${
                  dmsLatError ? 'border-red-500' : ''
                }`}
                placeholder='z.B. 52° 31&apos; 12&quot; N'
              />
              {dmsLatError && (
                <div className="text-xs text-red-600 mt-1">{dmsLatError}</div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                GPS DMS Lng
              </label>
              <input
                type="text"
                value={gpsDmsLng}
                onChange={(e) => {
                  setGpsDmsLng(e.target.value);
                  setDmsLngError('');
                }}
                className={`w-full px-3 py-2 border rounded ${
                  dmsLngError ? 'border-red-500' : ''
                }`}
                placeholder='z.B. 13° 24&apos; 18&quot; E'
              />
              {dmsLngError && (
                <div className="text-xs text-red-600 mt-1">{dmsLngError}</div>
              )}
            </div>

            {/* Zeile 4: Notes (volle Breite) */}
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notizen
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 border rounded"
                rows={4}
                placeholder="Optionale Notizen..."
              />
            </div>
          </div>
        </div>
      )}

      {activeTab === 'zuordnungen' && (
        <div className="space-y-6">
          {/* B1: Kunden-Zuordnung */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Kunden</h2>
            {customers.length === 0 ? (
              <div className="text-sm text-gray-500">
                Keine Kunden vorhanden.{' '}
                <Link to="/customers/new" className="text-blue-600 underline">
                  Jetzt anlegen
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {customers.map((customer) => (
                  <label
                    key={customer.id}
                    className="flex items-center gap-3 p-3 border rounded hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedCustomerIds.includes(customer.id)}
                      onChange={() => toggleCustomer(customer.id)}
                      className="w-4 h-4"
                    />
                    <div className="flex-1">
                      <div className="font-medium">{customer.name}</div>
                      {formatCustomerAddress(customer) && (
                        <div className="whitespace-pre-line text-sm text-gray-500">
                          {formatCustomerAddress(customer)}
                        </div>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* B2: Ansprechpartner */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Ansprechpartner</h2>

            {hasOverrides && (
              <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
                Manuelle Ansprechpartner überschreiben die geerbten für diesen
                Standort.
              </div>
            )}

            {/* Geerbt (read-only) */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">
                Geerbt
              </h3>
              {inheritedContacts.length === 0 ? (
                <div className="text-sm text-gray-500">
                  Keine geerbten Ansprechpartner.
                  <br />
                  <span className="text-xs">
                    Diese Ansprechpartner kommen über die zugeordneten Kunden.
                  </span>
                </div>
              ) : (
                <>
                  <div className="text-xs text-gray-600 mb-2">
                    Diese Ansprechpartner kommen über die zugeordneten Kunden.
                  </div>
                  <div className="space-y-2">
                    {inheritedContacts.map((contact) => (
                      <div
                        key={contact.id}
                        className="flex items-center gap-3 p-3 border rounded bg-gray-50"
                      >
                        <div className="flex-1">
                          <div className="font-medium">
                            {contact.firstName} {contact.lastName}
                          </div>
                          {contact.email && (
                            <div className="text-sm text-gray-500">
                              {contact.email}
                            </div>
                          )}
                        </div>
                        <span className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded">
                          geerbt
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Manuell */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-sm font-semibold text-gray-700">
                  Manuell
                </h3>
                <button
                  onClick={() => setShowContactPicker(true)}
                  className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                >
                  Manuell hinzufügen
                </button>
              </div>
              {manualContacts.length === 0 ? (
                <div className="text-sm text-gray-500">
                  Keine manuellen Ansprechpartner.
                </div>
              ) : (
                <div className="space-y-2">
                  {manualContacts.map((contact) => (
                    <div
                      key={contact.id}
                      className="flex items-center gap-3 p-3 border rounded"
                    >
                      <div className="flex-1">
                        <div className="font-medium">
                          {contact.firstName} {contact.lastName}
                        </div>
                        {contact.email && (
                          <div className="text-sm text-gray-500">
                            {contact.email}
                          </div>
                        )}
                      </div>
                      <span className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded">
                        manuell
                      </span>
                      <button
                        onClick={() => removeManualContact(contact.id)}
                        className="px-2 py-1 text-sm text-red-600 hover:bg-red-50 rounded transition-colors"
                      >
                        Entfernen
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Contact Picker Modal */}
      {showContactPicker && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={handleContactPickerBackdropClick}>
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">
                Ansprechpartner hinzufügen
              </h3>
              <button
                onClick={() => setShowContactPicker(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={20} />
              </button>
            </div>
            {availableContactsForPicker.length === 0 ? (
              <div className="text-sm text-gray-500">
                Alle Ansprechpartner sind bereits hinzugefügt oder keine
                vorhanden.
              </div>
            ) : (
              <div className="space-y-2">
                {availableContactsForPicker.map((contact) => (
                  <button
                    key={contact.id}
                    onClick={() => addManualContact(contact.id)}
                    className="w-full text-left p-3 border rounded hover:bg-gray-50 transition-colors"
                  >
                    <div className="font-medium">
                      {contact.firstName} {contact.lastName}
                    </div>
                    {contact.email && (
                      <div className="text-sm text-gray-500">
                        {contact.email}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
