import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useAppStore } from '../context/AppStoreContext';
import {
  ContactPerson,
  CustomerContactPerson,
  LocationContactOverride,
  AssetContactOverride,
  LocationCustomer,
} from '../lib/types';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '../components/ui/alert-dialog';

export default function ContactPersonsPage() {
  const { state, dispatch, repository } = useAppStore();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [contactToDelete, setContactToDelete] = useState<ContactPerson | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const contactPersons = state.contactPersons as ContactPerson[];
  const customerContactPersons = state.customerContactPersons as CustomerContactPerson[];
  const locationContactOverrides = state.locationContactOverrides as LocationContactOverride[];
  const assetContactOverrides = state.assetContactOverrides as AssetContactOverride[];
  const locationCustomers = state.locationCustomers as LocationCustomer[];

  const filteredContacts = useMemo(() => {
    if (!searchTerm.trim()) return contactPersons;
    const term = searchTerm.toLowerCase();
    return contactPersons.filter((cp) => {
      const fullName = `${cp.lastName}, ${cp.firstName}`.toLowerCase();
      const email = (cp.email || '').toLowerCase();
      const phone = (cp.phone1 || '').toLowerCase();
      return fullName.includes(term) || email.includes(term) || phone.includes(term);
    });
  }, [contactPersons, searchTerm]);

  const getContactStats = (contactId: string) => {
    const customerCount = customerContactPersons.filter((ccp) => ccp.contactPersonId === contactId).length;
    const manualLocationCount = locationContactOverrides.filter((lco) => lco.contactPersonId === contactId).length;
    const customerIds = customerContactPersons.filter((ccp) => ccp.contactPersonId === contactId).map((ccp) => ccp.customerId);
    const inheritedLocationCount = locationCustomers.filter((lc) => customerIds.includes(lc.customerId)).length;
    return { customerCount, manualLocationCount, inheritedLocationCount };
  };

  const handleDeleteClick = (contact: ContactPerson) => { setContactToDelete(contact); setDeleteError(null); setDeleteDialogOpen(true); };

  const handleDeleteConfirm = async () => {
    if (!contactToDelete) return;
    const hasLinks = customerContactPersons.some((ccp) => ccp.contactPersonId === contactToDelete.id)
      || locationContactOverrides.some((lco) => lco.contactPersonId === contactToDelete.id)
      || assetContactOverrides.some((aco) => aco.contactPersonId === contactToDelete.id);
    if (hasLinks) { setDeleteError('Dieser Ansprechpartner ist noch zugeordnet (Kunde/Standort/Asset). Bitte zuerst die Zuordnungen entfernen.'); return; }
    try {
      await repository.delete('contactPersons', contactToDelete.id);
      dispatch({ type: 'DELETE_ENTITY', entity: 'contactPersons', id: contactToDelete.id });
      setDeleteDialogOpen(false); setContactToDelete(null);
    } catch (error) { setDeleteError('Fehler beim Löschen des Ansprechpartners.'); }
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Ansprechpartner</h1>
        <Link to="/contacts/new"><Button><Plus className="mr-2 h-4 w-4" />Neuer Ansprechpartner</Button></Link>
      </div>
      <div className="mb-4"><Input type="text" placeholder="Suche nach Name, Email oder Telefon..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="max-w-md" /></div>
      {filteredContacts.length === 0 ? (
        <div className="text-center py-12 text-gray-500">{searchTerm ? 'Keine Ansprechpartner gefunden.' : 'Noch keine Ansprechpartner vorhanden.'}</div>
      ) : (
        <Table>
          <TableHeader><TableRow>
            <TableHead>Name</TableHead><TableHead>Rolle</TableHead><TableHead>Email</TableHead>
            <TableHead>Telefon</TableHead><TableHead>Zugeordnet zu</TableHead><TableHead className="text-right">Aktionen</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {filteredContacts.map((contact) => {
              const stats = getContactStats(contact.id);
              return (
                <TableRow key={contact.id}>
                  <TableCell className="font-medium">{contact.lastName}, {contact.firstName}</TableCell>
                  <TableCell>{contact.role || '-'}</TableCell>
                  <TableCell>{contact.email || '-'}</TableCell>
                  <TableCell>{contact.phone1 || '-'}</TableCell>
                  <TableCell className="text-sm text-gray-600">
                    {stats.customerCount > 0 && <span className="mr-3">Kunden: {stats.customerCount}</span>}
                    {stats.manualLocationCount > 0 && <span className="mr-3">Standorte (m): {stats.manualLocationCount}</span>}
                    {stats.inheritedLocationCount > 0 && <span>Standorte (g): {stats.inheritedLocationCount}</span>}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => navigate(`/contacts/${contact.id}`)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteClick(contact)}><Trash2 className="h-4 w-4 text-red-600" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ansprechpartner löschen</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteError ? <div className="text-red-600 font-medium">{deleteError}</div> : <>Möchten Sie den Ansprechpartner &quot;{contactToDelete?.firstName} {contactToDelete?.lastName}&quot; wirklich löschen?</>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteError(null)}>Abbrechen</AlertDialogCancel>
            {!deleteError && <AlertDialogAction onClick={handleDeleteConfirm}>Löschen</AlertDialogAction>}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
