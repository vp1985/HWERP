import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { v4 as uuidv4 } from 'uuid';
import { useAppStore } from '../context/AppStoreContext';
import {
  ContactPerson, Customer, Location,
  CustomerContactPerson, LocationContactOverride, LocationCustomer,
} from '../lib/types';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Checkbox } from '../components/ui/checkbox';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import TagPicker from '../components/TagPicker';
import Tooltip from '../components/Tooltip';

export default function ContactPersonFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id;
  const { state, dispatch, repository } = useAppStore();

  const [formData, setFormData] = useState<Partial<ContactPerson>>({
    firstName: '', lastName: '', role: null, email: null,
    phone1: null, phone2: null, phone3: null,
    birthday: null, personalNotes: null, tagIds: [],
  });

  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([]);
  const [selectedLocationIds, setSelectedLocationIds] = useState<string[]>([]);

  const contactPersons = state.contactPersons as ContactPerson[];
  const customers = state.customers as Customer[];
  const locations = state.locations as Location[];
  const customerContactPersons = state.customerContactPersons as CustomerContactPerson[];
  const locationContactOverrides = state.locationContactOverrides as LocationContactOverride[];
  const locationCustomers = state.locationCustomers as LocationCustomer[];

  useEffect(() => {
    if (!isNew && id) {
      const existing = contactPersons.find((cp) => cp.id === id);
      if (existing) {
        setFormData(existing);
        const customerLinks = customerContactPersons.filter((ccp) => ccp.contactPersonId === id);
        setSelectedCustomerIds(customerLinks.map((ccp) => ccp.customerId));
        const locationLinks = locationContactOverrides.filter((lco) => lco.contactPersonId === id);
        setSelectedLocationIds(locationLinks.map((lco) => lco.locationId));
      }
    }
  }, [isNew, id, contactPersons, customerContactPersons, locationContactOverrides]);

  const inheritedLocationIds = locationCustomers
    .filter((lc) => selectedCustomerIds.includes(lc.customerId))
    .map((lc) => lc.locationId);

  const handleSave = async () => {
    if (!formData.firstName?.trim() || !formData.lastName?.trim()) { alert('Bitte Vor- und Nachname eingeben.'); return; }
    try {
      const existing = !isNew && id ? contactPersons.find((cp) => cp.id === id) ?? null : null;
      const now = new Date().toISOString();
      const contactId = isNew ? uuidv4() : id!;
      const contactPerson: ContactPerson = {
        id: contactId, firstName: formData.firstName.trim(), lastName: formData.lastName.trim(),
        role: formData.role?.trim() || null, email: formData.email?.trim() || null,
        phone1: formData.phone1?.trim() || null, phone2: formData.phone2?.trim() || null,
        phone3: formData.phone3?.trim() || null, birthday: formData.birthday || null,
        personalNotes: formData.personalNotes?.trim() || null, tagIds: formData.tagIds || [],
        createdAt: existing?.createdAt ?? now, updatedAt: now,
      };
      const savedContactPerson = await repository.upsert<ContactPerson>('contactPersons', contactPerson);
      if (isNew) dispatch({ type: 'ADD_ENTITY', entity: 'contactPersons', data: savedContactPerson });
      else dispatch({ type: 'UPDATE_ENTITY', entity: 'contactPersons', data: savedContactPerson });

      // Sync customer assignments
      const existingCLinks = customerContactPersons.filter((ccp) => ccp.contactPersonId === contactId);
      const existingCIds = existingCLinks.map((ccp) => ccp.customerId);
      for (const link of existingCLinks) {
        if (!selectedCustomerIds.includes(link.customerId)) {
          await repository.delete('customerContactPersons', link.id);
          dispatch({ type: 'DELETE_ENTITY', entity: 'customerContactPersons', id: link.id });
        }
      }
      for (const customerId of selectedCustomerIds) {
        if (!existingCIds.includes(customerId)) {
          const newLink: CustomerContactPerson = { id: uuidv4(), customerId, contactPersonId: contactId, isPrimary: false, createdAt: now, updatedAt: now };
          await repository.upsert<CustomerContactPerson>('customerContactPersons', newLink);
          dispatch({ type: 'ADD_ENTITY', entity: 'customerContactPersons', data: newLink });
        }
      }

      // Sync location assignments
      const existingLLinks = locationContactOverrides.filter((lco) => lco.contactPersonId === contactId);
      const existingLIds = existingLLinks.map((lco) => lco.locationId);
      for (const link of existingLLinks) {
        if (!selectedLocationIds.includes(link.locationId)) {
          await repository.delete('locationContactOverrides', link.id);
          dispatch({ type: 'DELETE_ENTITY', entity: 'locationContactOverrides', id: link.id });
        }
      }
      for (const locationId of selectedLocationIds) {
        if (!existingLIds.includes(locationId)) {
          const newLink: LocationContactOverride = { id: uuidv4(), locationId, contactPersonId: contactId, createdAt: now, updatedAt: now };
          await repository.upsert<LocationContactOverride>('locationContactOverrides', newLink);
          dispatch({ type: 'ADD_ENTITY', entity: 'locationContactOverrides', data: newLink });
        }
      }
      navigate('/contacts');
    } catch (error) { console.error('Fehler beim Speichern:', error); alert('Fehler beim Speichern des Ansprechpartners.'); }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-2xl font-bold">{isNew ? 'Ansprechpartner anlegen' : 'Ansprechpartner bearbeiten'}</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/contacts')}>Abbrechen</Button>
          <Button onClick={handleSave}>Speichern</Button>
        </div>
      </div>
      <Tabs defaultValue="stammdaten" className="w-full">
        <TabsList><TabsTrigger value="stammdaten">Stammdaten</TabsTrigger><TabsTrigger value="zuweisungen">Zuweisungen</TabsTrigger></TabsList>
        <TabsContent value="stammdaten" className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div><Label htmlFor="firstName">Vorname *</Label><Input id="firstName" value={formData.firstName || ''} onChange={(e) => setFormData({ ...formData, firstName: e.target.value })} /></div>
            <div><Label htmlFor="lastName">Nachname *</Label><Input id="lastName" value={formData.lastName || ''} onChange={(e) => setFormData({ ...formData, lastName: e.target.value })} /></div>
            <div><Label htmlFor="role">Rolle</Label><Input id="role" value={formData.role || ''} onChange={(e) => setFormData({ ...formData, role: e.target.value })} placeholder="z.B. Geschäftsführer, Techniker" /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label htmlFor="email">Email</Label><Input id="email" type="email" value={formData.email || ''} onChange={(e) => setFormData({ ...formData, email: e.target.value })} /></div>
            <div><Label htmlFor="birthday">Geburtstag</Label><Input id="birthday" type="date" value={formData.birthday || ''} onChange={(e) => setFormData({ ...formData, birthday: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div><Label htmlFor="phone1">Telefon 1</Label><Input id="phone1" value={formData.phone1 || ''} onChange={(e) => setFormData({ ...formData, phone1: e.target.value })} /></div>
            <div><Label htmlFor="phone2">Telefon 2</Label><Input id="phone2" value={formData.phone2 || ''} onChange={(e) => setFormData({ ...formData, phone2: e.target.value })} /></div>
            <div><Label htmlFor="phone3">Telefon 3</Label><Input id="phone3" value={formData.phone3 || ''} onChange={(e) => setFormData({ ...formData, phone3: e.target.value })} /></div>
          </div>
          <div><Label>Tags</Label><TagPicker selectedTagIds={formData.tagIds || []} onChange={(tagIds) => setFormData({ ...formData, tagIds })} context="CONTACTS" /></div>
          <div><Label htmlFor="personalNotes">Personal Notes <Tooltip text="Hier kannst du private Gesprächsnotizen hinterlegen (z.B. Urlaub, Interessen), um beim nächsten Kontakt anzuknüpfen." /></Label><Textarea id="personalNotes" value={formData.personalNotes || ''} onChange={(e) => setFormData({ ...formData, personalNotes: e.target.value })} rows={4} placeholder="Private Notizen für persönliche Gespräche..." /></div>
        </TabsContent>
        <TabsContent value="zuweisungen" className="space-y-6">
          <div><h3 className="text-lg font-semibold mb-3">Kunden</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto border rounded p-3">
              {customers.length === 0 ? <div className="text-gray-500 text-sm">Keine Kunden vorhanden.</div> : customers.map((customer) => (
                <div key={customer.id} className="flex items-center gap-2">
                  <Checkbox id={`customer-${customer.id}`} checked={selectedCustomerIds.includes(customer.id)} onCheckedChange={(checked) => { if (checked) setSelectedCustomerIds([...selectedCustomerIds, customer.id]); else setSelectedCustomerIds(selectedCustomerIds.filter((cid) => cid !== customer.id)); }} />
                  <label htmlFor={`customer-${customer.id}`} className="text-sm cursor-pointer">{customer.name}</label>
                </div>
              ))}
            </div>
          </div>
          <div><h3 className="text-lg font-semibold mb-3">Standorte</h3>
            <div className="mb-4"><h4 className="text-sm font-medium mb-2">Manuell zugeordnet</h4>
              <div className="space-y-2 max-h-48 overflow-y-auto border rounded p-3">
                {locations.length === 0 ? <div className="text-gray-500 text-sm">Keine Standorte vorhanden.</div> : locations.map((location) => (
                  <div key={location.id} className="flex items-center gap-2">
                    <Checkbox id={`location-${location.id}`} checked={selectedLocationIds.includes(location.id)} onCheckedChange={(checked) => { if (checked) setSelectedLocationIds([...selectedLocationIds, location.id]); else setSelectedLocationIds(selectedLocationIds.filter((lid) => lid !== location.id)); }} />
                    <label htmlFor={`location-${location.id}`} className="text-sm cursor-pointer">{location.name}</label>
                    <Badge variant="outline" className="text-xs">manuell</Badge>
                  </div>
                ))}
              </div>
            </div>
            <div><h4 className="text-sm font-medium mb-2">Geerbt über Kunden</h4>
              <div className="space-y-2 max-h-48 overflow-y-auto border rounded p-3 bg-gray-50">
                {inheritedLocationIds.length === 0 ? <div className="text-gray-500 text-sm">Keine geerbten Standorte (über Kunden-Zuordnung).</div> : inheritedLocationIds.map((locationId) => {
                  const location = locations.find((l) => l.id === locationId);
                  if (!location) return null;
                  return <div key={locationId} className="flex items-center gap-2"><span className="text-sm">{location.name}</span><Badge variant="secondary" className="text-xs">geerbt</Badge></div>;
                })}
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
