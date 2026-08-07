import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Search } from 'lucide-react';
import { v4 as uuid } from 'uuid';
import { useAppStore } from '../context/AppStoreContext';
import {
  Customer,
  SupplierCapability,
  SupplierCapabilityFitLevel,
  SupplierCapabilityTag,
  SupplierProductCategory,
} from '../lib/types';
import { hasSupplierRole } from './customerBusinessPartner';
import { findSupplierMatches, normalizeSupplierCapabilityInput } from './supplierMatching';

const EMPTY_CATEGORY_FORM = { name: '', aliases: '', description: '' };
const EMPTY_CAPABILITY_FORM = {
  customerId: '',
  categoryId: '',
  capabilityLabel: '',
  productTerms: '',
  materials: '',
  serviceTags: '',
  priorityRank: '100',
  fitLevel: 'passend' as SupplierCapabilityFitLevel,
  notes: '',
};
const EMPTY_MATCH_FORM = { query: '', selectedCategoryId: '', selectedServiceTags: '' };

function listFromCommaText(value: string): string[] {
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

function nowIso(): string {
  return new Date().toISOString();
}

export default function SuppliersPage() {
  const { repository } = useAppStore();
  const [suppliers, setSuppliers] = useState<Customer[]>([]);
  const [categories, setCategories] = useState<SupplierProductCategory[]>([]);
  const [capabilities, setCapabilities] = useState<SupplierCapability[]>([]);
  const [capabilityTags, setCapabilityTags] = useState<SupplierCapabilityTag[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryForm, setCategoryForm] = useState(EMPTY_CATEGORY_FORM);
  const [capabilityForm, setCapabilityForm] = useState(EMPTY_CAPABILITY_FORM);
  const [matchForm, setMatchForm] = useState(EMPTY_MATCH_FORM);
  const [isLoading, setIsLoading] = useState(true);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  async function loadData() {
    setIsLoading(true);
    try {
      const [customers, nextCategories, nextCapabilities, nextCapabilityTags] = await Promise.all([
        repository.list<Customer>('customers'),
        repository.list<SupplierProductCategory>('supplierProductCategories'),
        repository.list<SupplierCapability>('supplierCapabilities'),
        repository.list<SupplierCapabilityTag>('supplierCapabilityTags'),
      ]);
      setSuppliers(customers.filter((customer) => hasSupplierRole(customer.roles)));
      setCategories(nextCategories.sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name)));
      setCapabilities(nextCapabilities);
      setCapabilityTags(nextCapabilityTags);
    } catch (error) {
      console.error('Failed to load suppliers:', error);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [repository]);

  const filteredSuppliers = suppliers.filter((supplier) => {
    const query = searchQuery.toLowerCase();
    return (
      supplier.supplierNumber?.toLowerCase().includes(query) ||
      supplier.customerNumber?.toLowerCase().includes(query) ||
      supplier.name.toLowerCase().includes(query) ||
      supplier.contactName?.toLowerCase().includes(query) ||
      supplier.email?.toLowerCase().includes(query)
    );
  });

  const matchResults = useMemo(
    () => findSupplierMatches(
      {
        query: matchForm.query,
        selectedCategoryId: matchForm.selectedCategoryId || undefined,
        selectedServiceTags: listFromCommaText(matchForm.selectedServiceTags),
      },
      suppliers,
      categories,
      capabilities,
      capabilityTags,
    ),
    [matchForm, suppliers, categories, capabilities, capabilityTags],
  );

  const handleCreateCategory = async (event: FormEvent) => {
    event.preventDefault();
    const name = categoryForm.name.trim();
    if (!name) return;
    const timestamp = nowIso();
    const category: SupplierProductCategory = {
      id: uuid(),
      name,
      parentId: null,
      aliases: listFromCommaText(categoryForm.aliases),
      description: categoryForm.description.trim() || null,
      active: true,
      sortOrder: categories.length + 1,
      archivedAt: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const saved = await repository.upsert<SupplierProductCategory>('supplierProductCategories', category);
    setCategories((current) => [...current, saved].sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name)));
    setCategoryForm(EMPTY_CATEGORY_FORM);
    setSaveMessage('Kategorie hinzugefügt.');
  };

  const handleCreateCapability = async (event: FormEvent) => {
    event.preventDefault();
    if (!capabilityForm.customerId || !capabilityForm.categoryId || !capabilityForm.capabilityLabel.trim()) return;
    const timestamp = nowIso();
    const normalized = normalizeSupplierCapabilityInput(capabilityForm.materials, capabilityForm.productTerms, capabilityForm.serviceTags);
    const capability: SupplierCapability = {
      id: uuid(),
      customerId: capabilityForm.customerId,
      categoryId: capabilityForm.categoryId,
      capabilityLabel: capabilityForm.capabilityLabel.trim(),
      productTerms: normalized.productTerms,
      materials: normalized.materials,
      serviceTags: normalized.serviceTags,
      fitLevel: capabilityForm.fitLevel,
      priorityRank: Number.parseInt(capabilityForm.priorityRank, 10) || 100,
      notes: capabilityForm.notes.trim() || null,
      active: true,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const saved = await repository.upsert<SupplierCapability>('supplierCapabilities', capability);
    setCapabilities((current) => [...current, saved]);
    setCapabilityForm(EMPTY_CAPABILITY_FORM);
    setSaveMessage('Fähigkeit hinzugefügt.');
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold">Lieferantenverwaltung</h1>
        <p className="mt-4 text-gray-600">Laden...</p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Lieferantenverwaltung</h1>
        <p className="mt-2 text-sm text-gray-600">
          Lieferanten mit Produktkategorien, konkreten Produkten und Fähigkeiten pflegen. Mitarbeiter suchen später Produkt oder Kategorie und sehen sofort, wer liefern kann.
        </p>
      </div>

      {saveMessage && <div className="mb-4 rounded border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800">{saveMessage}</div>}

      <section className="mb-6 rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="mb-3 text-lg font-semibold">Produkt- oder Kategoriesuche</h2>
        <div className="grid gap-3 md:grid-cols-3">
          <input
            type="text"
            placeholder="z.B. OW-1200, Ölwanne aus Stahl oder Trafo"
            value={matchForm.query}
            onChange={(event) => setMatchForm((current) => ({ ...current, query: event.target.value }))}
            className="rounded border border-gray-300 px-3 py-2"
          />
          <select
            value={matchForm.selectedCategoryId}
            onChange={(event) => setMatchForm((current) => ({ ...current, selectedCategoryId: event.target.value }))}
            className="rounded border border-gray-300 px-3 py-2"
          >
            <option value="">Alle Kategorien</option>
            {categories.filter((category) => category.active).map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Chips UND: Spediteur, Kran bis 5 t"
            value={matchForm.selectedServiceTags}
            onChange={(event) => setMatchForm((current) => ({ ...current, selectedServiceTags: event.target.value }))}
            className="rounded border border-gray-300 px-3 py-2"
          />
        </div>
        <div className="mt-4 space-y-2">
          {matchResults.length === 0 ? (
            <p className="text-sm text-gray-500">Noch keine Treffer. Kategorie/Fähigkeit anlegen oder Suchkriterien lockern.</p>
          ) : matchResults.map((match) => (
            <div key={`${match.supplier.id}-${match.capability.id}`} className="rounded border border-emerald-100 bg-emerald-50 px-3 py-2">
              <Link to={`/customers/${match.supplier.id}`} className="font-semibold text-emerald-800 hover:text-emerald-950">
                {match.supplier.name}
              </Link>
              <span className="ml-2 font-mono text-xs text-emerald-700">{match.supplier.supplierNumber || 'ohne Lieferantennr.'}</span>
              <p className="text-sm text-emerald-900">{match.capability.capabilityLabel}</p>
              <p className="text-xs text-emerald-700">{match.reasons.join(' · ')}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="mb-6 grid gap-4 xl:grid-cols-2">
        <form onSubmit={handleCreateCategory} className="rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="mb-3 text-lg font-semibold">Kategorie hinzufügen</h2>
          <div className="grid gap-3">
            <input value={categoryForm.name} onChange={(event) => setCategoryForm((current) => ({ ...current, name: event.target.value }))} placeholder="z.B. Stahlwannen" className="rounded border border-gray-300 px-3 py-2" />
            <input value={categoryForm.aliases} onChange={(event) => setCategoryForm((current) => ({ ...current, aliases: event.target.value }))} placeholder="Aliase: Ölwanne Stahl, Auffangwanne Stahl" className="rounded border border-gray-300 px-3 py-2" />
            <textarea value={categoryForm.description} onChange={(event) => setCategoryForm((current) => ({ ...current, description: event.target.value }))} placeholder="Beschreibung" rows={2} className="rounded border border-gray-300 px-3 py-2" />
            <button type="submit" className="rounded bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-700">Kategorie speichern</button>
          </div>
        </form>

        <form onSubmit={handleCreateCapability} className="rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="mb-3 text-lg font-semibold">Fähigkeit hinzufügen</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <select value={capabilityForm.customerId} onChange={(event) => setCapabilityForm((current) => ({ ...current, customerId: event.target.value }))} className="rounded border border-gray-300 px-3 py-2">
              <option value="">Lieferant wählen</option>
              {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
            </select>
            <select value={capabilityForm.categoryId} onChange={(event) => setCapabilityForm((current) => ({ ...current, categoryId: event.target.value }))} className="rounded border border-gray-300 px-3 py-2">
              <option value="">Kategorie wählen</option>
              {categories.filter((category) => category.active).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
            <input value={capabilityForm.capabilityLabel} onChange={(event) => setCapabilityForm((current) => ({ ...current, capabilityLabel: event.target.value }))} placeholder="Fähigkeit: z.B. Ölwannen aus Aluminium" className="rounded border border-gray-300 px-3 py-2 md:col-span-2" />
            <input value={capabilityForm.productTerms} onChange={(event) => setCapabilityForm((current) => ({ ...current, productTerms: event.target.value }))} placeholder="Konkrete Produkte: OW-1200, Trafo 630 kVA" className="rounded border border-gray-300 px-3 py-2 md:col-span-2" />
            <input value={capabilityForm.materials} onChange={(event) => setCapabilityForm((current) => ({ ...current, materials: event.target.value }))} placeholder="Materialien: Stahl, Aluminium" className="rounded border border-gray-300 px-3 py-2" />
            <input value={capabilityForm.serviceTags} onChange={(event) => setCapabilityForm((current) => ({ ...current, serviceTags: event.target.value }))} placeholder="Chips: Spediteur, Kran bis 5 t, Flexibel" className="rounded border border-gray-300 px-3 py-2" />
            <input value={capabilityForm.priorityRank} onChange={(event) => setCapabilityForm((current) => ({ ...current, priorityRank: event.target.value }))} placeholder="Priorität" className="rounded border border-gray-300 px-3 py-2" />
            <select value={capabilityForm.fitLevel} onChange={(event) => setCapabilityForm((current) => ({ ...current, fitLevel: event.target.value as SupplierCapabilityFitLevel }))} className="rounded border border-gray-300 px-3 py-2">
              <option value="sehr_hoch">sehr hoch</option>
              <option value="hoch">hoch</option>
              <option value="passend">passend</option>
              <option value="moeglich">möglich</option>
            </select>
            <textarea value={capabilityForm.notes} onChange={(event) => setCapabilityForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Notiz" rows={2} className="rounded border border-gray-300 px-3 py-2 md:col-span-2" />
            <button type="submit" className="rounded bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-700 md:col-span-2">Fähigkeit speichern</button>
          </div>
        </form>
      </div>

      <section className="mb-6 rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="mb-3 text-lg font-semibold">Produktkategorien</h2>
        <div className="flex flex-wrap gap-2">
          {categories.length === 0 ? <p className="text-sm text-gray-500">Noch keine Kategorien.</p> : categories.map((category) => (
            <span key={category.id} className="rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-700">
              {category.name}{category.aliases.length > 0 ? ` · ${category.aliases.join(', ')}` : ''}
            </span>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="mb-4">
          <h2 className="mb-3 text-lg font-semibold">Lieferanten</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Suche nach Lieferantennr., Kundennr., Name, Kontakt oder E-Mail..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded border border-gray-300 py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        {suppliers.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-10 text-center text-gray-600">
            Noch keine Lieferanten. Öffne einen Geschäftspartner/Kunden und aktiviere die Funktion Lieferant.
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
            <table className="w-full">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Lieferantennr.</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Kundennr.</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Name</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Fähigkeiten</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Kontakt</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">E-Mail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredSuppliers.map((supplier) => {
                  const supplierCapabilities = capabilities.filter((capability) => capability.customerId === supplier.id && capability.active);
                  return (
                    <tr key={supplier.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 font-mono text-sm text-gray-700">{supplier.supplierNumber || '-'}</td>
                      <td className="px-6 py-4 font-mono text-sm text-gray-700">{supplier.customerNumber || '-'}</td>
                      <td className="px-6 py-4">
                        <Link to={`/customers/${supplier.id}`} className="font-medium text-emerald-700 hover:text-emerald-900">
                          {supplier.name}
                        </Link>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        {supplierCapabilities.length === 0 ? '-' : supplierCapabilities.map((capability) => {
                          const products = capability.productTerms?.length ? ` (${capability.productTerms.join(', ')})` : '';
                          return `${capability.capabilityLabel}${products}`;
                        }).join(', ')}
                      </td>
                      <td className="px-6 py-4 text-gray-700">{supplier.contactName || '-'}</td>
                      <td className="px-6 py-4 text-gray-700">{supplier.email || '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {filteredSuppliers.length === 0 && suppliers.length > 0 && searchQuery && (
          <div className="mt-4 text-center text-gray-600">Keine Lieferanten gefunden für "{searchQuery}"</div>
        )}
      </section>
    </div>
  );
}
