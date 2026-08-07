import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Check, ClipboardList, Pencil, Plus, RefreshCcw } from 'lucide-react';
import { v4 as uuid } from 'uuid';
import { useAppStore } from '../context/AppStoreContext';
import type { ChecklistTemplate, InquiryMasterDataCategory } from '../lib/types';

interface CategoryForm {
  name: string;
  description: string;
  sortOrder: string;
  active: boolean;
  checklistTemplateIds: string[];
}

const EMPTY_FORM: CategoryForm = {
  name: '',
  description: '',
  sortOrder: '100',
  active: true,
  checklistTemplateIds: [],
};

function nowIso() {
  return new Date().toISOString();
}

function normalizeCategory(category: InquiryMasterDataCategory): InquiryMasterDataCategory {
  return {
    ...category,
    checklistTemplateIds: category.checklistTemplateIds ?? [],
  };
}

function sortCategories(categories: InquiryMasterDataCategory[]) {
  return [...categories].map(normalizeCategory).sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name, 'de'));
}

function linkedChecklistNames(category: InquiryMasterDataCategory, checklistTemplates: ChecklistTemplate[]): string {
  const ids = new Set(category.checklistTemplateIds ?? []);
  const names = checklistTemplates
    .filter((template) => ids.has(template.id))
    .map((template) => template.name);
  return names.length > 0 ? names.join(', ') : '—';
}

function formFromCategory(category: InquiryMasterDataCategory): CategoryForm {
  return {
    name: category.name,
    description: category.description ?? '',
    sortOrder: String(category.sortOrder),
    active: category.active,
    checklistTemplateIds: category.checklistTemplateIds ?? [],
  };
}

export default function InquiryCategoriesPage() {
  const { repository } = useAppStore();
  const [categories, setCategories] = useState<InquiryMasterDataCategory[]>([]);
  const [checklistTemplates, setChecklistTemplates] = useState<ChecklistTemplate[]>([]);
  const [form, setForm] = useState<CategoryForm>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [saveMessage, setSaveMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const editingCategory = useMemo(
    () => categories.find((category) => category.id === editingId) ?? null,
    [categories, editingId],
  );

  const loadCategories = async () => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const [nextCategories, nextChecklistTemplates] = await Promise.all([
        repository.list<InquiryMasterDataCategory>('inquiryMasterDataCategories'),
        repository.list<ChecklistTemplate>('checklistTemplates'),
      ]);
      setCategories(sortCategories(nextCategories));
      setChecklistTemplates(nextChecklistTemplates.filter((template) => template.status === 'active'));
    } catch (error) {
      setErrorMessage(String(error));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repository]);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
  };

  const startEdit = (category: InquiryMasterDataCategory) => {
    setEditingId(category.id);
    setForm(formFromCategory(category));
    setSaveMessage('');
    setErrorMessage('');
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const name = form.name.trim();
    if (!name) {
      setErrorMessage('Name ist erforderlich.');
      return;
    }

    const timestamp = nowIso();
    const category: InquiryMasterDataCategory = {
      id: editingId ?? uuid(),
      name,
      description: form.description.trim() || null,
      active: form.active,
      sortOrder: Number.parseInt(form.sortOrder, 10) || 100,
      checklistTemplateIds: form.checklistTemplateIds,
      createdAt: editingCategory?.createdAt ?? timestamp,
      updatedAt: timestamp,
    };

    try {
      const saved = await repository.upsert<InquiryMasterDataCategory>('inquiryMasterDataCategories', category);
      setCategories((current) => sortCategories([
        ...current.filter((item) => item.id !== saved.id),
        saved,
      ]));
      resetForm();
      setSaveMessage('Kategorie gespeichert.');
      setErrorMessage('');
    } catch (error) {
      setErrorMessage(String(error));
    }
  };

  const toggleActive = async (category: InquiryMasterDataCategory) => {
    const updated: InquiryMasterDataCategory = {
      ...category,
      active: !category.active,
      updatedAt: nowIso(),
    };

    try {
      const saved = await repository.upsert<InquiryMasterDataCategory>('inquiryMasterDataCategories', updated);
      setCategories((current) => sortCategories(current.map((item) => item.id === saved.id ? saved : item)));
      setSaveMessage(saved.active ? 'Kategorie aktiviert.' : 'Kategorie deaktiviert.');
      setErrorMessage('');
    } catch (error) {
      setErrorMessage(String(error));
    }
  };

  const toggleChecklistTemplate = (templateId: string) => {
    setForm((current) => ({
      ...current,
      checklistTemplateIds: current.checklistTemplateIds.includes(templateId)
        ? current.checklistTemplateIds.filter((id) => id !== templateId)
        : [...current.checklistTemplateIds, templateId],
    }));
  };

  return (
    <div className="container max-w-6xl mx-auto py-8 px-6 space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <ClipboardList size={30} className="text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">Anfragekategorien</h1>
          </div>
          <p className="mt-2 text-sm text-gray-600">Pflege die Kategorien, die im Anfrageformular und für Checklisten verwendet werden.</p>
        </div>
        <button type="button" onClick={loadCategories} className="inline-flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm hover:bg-gray-50">
          <RefreshCcw size={16} /> Aktualisieren
        </button>
      </header>

      {saveMessage && <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700"><Check size={16} /> {saveMessage}</div>}
      {errorMessage && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</div>}

      <section className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <form onSubmit={handleSubmit} className="rounded-xl border bg-white p-4 space-y-3">
          <h2 className="text-lg font-semibold text-gray-900">{editingId ? 'Kategorie bearbeiten' : 'Neue Kategorie'}</h2>
          <label className="block text-sm font-medium text-gray-700">
            Name
            <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" placeholder="z.B. Stationswartung" required />
          </label>
          <label className="block text-sm font-medium text-gray-700">
            Beschreibung
            <textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" rows={3} placeholder="Kurzbeschreibung für Mitarbeitende" />
          </label>
          <label className="block text-sm font-medium text-gray-700">
            Reihenfolge
            <input type="number" value={form.sortOrder} onChange={(event) => setForm((current) => ({ ...current, sortOrder: event.target.value }))} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" />
          </label>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <input type="checkbox" checked={form.active} onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))} />
            Aktiv
          </label>
          <fieldset className="rounded-lg border border-gray-200 p-3">
            <legend className="px-1 text-sm font-medium text-gray-700">Checklisten</legend>
            {checklistTemplates.length === 0 ? (
              <p className="text-sm text-gray-500">Noch keine aktiven Checklisten vorhanden.</p>
            ) : (
              <div className="mt-2 space-y-2">
                {checklistTemplates.map((template) => (
                  <label key={template.id} className="flex items-start gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={form.checklistTemplateIds.includes(template.id)}
                      onChange={() => toggleChecklistTemplate(template.id)}
                      className="mt-1"
                    />
                    <span>
                      <span className="font-medium">{template.name}</span>
                      {template.description && <span className="block text-xs text-gray-500">{template.description}</span>}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </fieldset>
          <div className="flex gap-2">
            <button type="submit" className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">
              <Plus size={15} /> Speichern
            </button>
            {editingId && <button type="button" onClick={resetForm} className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50">Abbrechen</button>}
          </div>
        </form>

        <div className="rounded-xl border bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Beschreibung</th>
                <th className="px-4 py-3 font-medium">Checklisten</th>
                <th className="px-4 py-3 font-medium">Reihenfolge</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Aktion</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">Lade Kategorien...</td></tr>
              ) : categories.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">Noch keine Anfragekategorien.</td></tr>
              ) : categories.map((category) => (
                <tr key={category.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{category.name}</td>
                  <td className="px-4 py-3 text-gray-600">{category.description || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{linkedChecklistNames(category, checklistTemplates)}</td>
                  <td className="px-4 py-3 text-gray-600">{category.sortOrder}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${category.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                      {category.active ? 'Aktiv' : 'Inaktiv'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button type="button" onClick={() => startEdit(category)} className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs hover:bg-white">
                        <Pencil size={13} /> Bearbeiten
                      </button>
                      <button type="button" onClick={() => toggleActive(category)} className="rounded border px-2 py-1 text-xs hover:bg-white">
                        {category.active ? 'Deaktivieren' : 'Aktivieren'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
