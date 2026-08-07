import { useEffect, useMemo, useState } from 'react';
import { Plus, Save, Settings2, Trash2 } from 'lucide-react';
import { useAppStore } from '../context/AppStoreContext';
import { uuid } from '../lib/utils';
import type { InquiryMasterDataCategory } from '../lib/types';
import {
  SELECT_OPTION_LIST_DEFINITIONS,
  getSelectOptionListDefinition,
  getSelectOptionsForList,
  slugifySelectOptionValue,
  type SelectOption,
  type SelectOptionListKey,
  type SelectOptionMetadata,
} from '../lib/selectOptions';

const EMPTY_NEW_LABEL: Record<string, string> = {};

function normalizeSortOrder(value: string): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 100;
}

function hasDefaultActiveState(option: SelectOption): boolean {
  return option.isActive !== false;
}

export default function SelectOptionsPage() {
  const { state, dispatch, repository } = useAppStore();
  const [selectedListKey, setSelectedListKey] = useState<SelectOptionListKey>('asset.trafoKind');
  const [message, setMessage] = useState<string | null>(null);
  const [newLabels, setNewLabels] = useState<Record<string, string>>(EMPTY_NEW_LABEL);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadSelectOptions() {
      try {
        const [options, categories] = await Promise.all([
          repository.list<SelectOption>('selectOptions'),
          repository.list<InquiryMasterDataCategory>('inquiryMasterDataCategories'),
        ]);
        dispatch({ type: 'SET_ENTITIES', entity: 'selectOptions', data: options });
        dispatch({ type: 'SET_ENTITIES', entity: 'inquiryMasterDataCategories', data: categories });
      } catch (error) {
        console.error('Failed to load select options:', error);
        setMessage('Auswahllisten konnten nicht geladen werden.');
      } finally {
        setIsLoading(false);
      }
    }

    loadSelectOptions();
  }, [dispatch, repository]);

  const selectOptions = (state.selectOptions as SelectOption[]) || [];
  const selectedDefinition = getSelectOptionListDefinition(selectedListKey)!;
  const selectedOptions = useMemo(
    () => getSelectOptionsForList(selectOptions, selectedListKey, { includeInactive: true }),
    [selectOptions, selectedListKey],
  );

  const updateOption = async (option: SelectOption, patch: Partial<SelectOption>) => {
    const now = new Date().toISOString();
    const payload: SelectOption = {
      ...option,
      ...patch,
      id: option.id.startsWith('default-') ? uuid() : option.id,
      listKey: selectedListKey,
      updatedAt: now,
      createdAt: option.id.startsWith('default-') ? now : option.createdAt,
      metadata: { ...(option.metadata || {}), ...(patch.metadata || {}) },
    };
    const saved = await repository.upsert<SelectOption>('selectOptions', payload);
    const exists = selectOptions.some((item) => item.id === saved.id || (item.listKey === saved.listKey && item.value === saved.value));
    dispatch({ type: exists ? 'UPDATE_ENTITY' : 'ADD_ENTITY', entity: 'selectOptions', data: saved });
    setMessage('Gespeichert.');
  };

  const addOption = async () => {
    const label = (newLabels[selectedListKey] || '').trim();
    if (!label) {
      setMessage('Bitte zuerst einen Namen für die neue Option eingeben.');
      return;
    }

    const now = new Date().toISOString();
    const existingValues = selectedOptions.map((option) => option.value);
    const category = selectedListKey === 'inquiry.category'
      ? await repository.create<InquiryMasterDataCategory>('inquiryMasterDataCategories', {
        id: uuid(),
        name: label,
        description: null,
        active: true,
        sortOrder: selectedOptions.length > 0 ? Math.max(...selectedOptions.map((item) => item.sortOrder)) + 10 : 10,
        checklistTemplateIds: [],
        createdAt: now,
        updatedAt: now,
      })
      : null;
    if (category) {
      dispatch({ type: 'ADD_ENTITY', entity: 'inquiryMasterDataCategories', data: category });
    }
    const option: SelectOption = {
      id: uuid(),
      listKey: selectedListKey,
      value: category?.id ?? slugifySelectOptionValue(label, existingValues),
      label,
      sortOrder: category?.sortOrder ?? (selectedOptions.length > 0 ? Math.max(...selectedOptions.map((item) => item.sortOrder)) + 10 : 10),
      isActive: true,
      isSystem: false,
      metadata: {},
      createdAt: now,
      updatedAt: now,
    };

    const saved = await repository.create<SelectOption>('selectOptions', option);
    dispatch({ type: 'ADD_ENTITY', entity: 'selectOptions', data: saved });
    setNewLabels((current) => ({ ...current, [selectedListKey]: '' }));
    setMessage('Neue Option angelegt.');
  };

  const deleteOption = async (option: SelectOption) => {
    if (option.isSystem) {
      await updateOption(option, { isActive: false });
      setMessage('System-Option wurde deaktiviert.');
      return;
    }

    await repository.delete('selectOptions', option.id);
    dispatch({ type: 'DELETE_ENTITY', entity: 'selectOptions', id: option.id });
    setMessage('Option gelöscht.');
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Auswahllisten</h1>
        <p className="text-sm text-gray-600">
          Zentrale Stammdaten für fachliche Dropdowns. Systemwerte können deaktiviert oder umbenannt werden; neue Optionen werden ohne Codeänderung verfügbar.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
            <Settings2 size={16} />
            Listen
          </div>
          {SELECT_OPTION_LIST_DEFINITIONS.map((definition) => (
            <button
              key={definition.key}
              type="button"
              onClick={() => setSelectedListKey(definition.key)}
              className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${
                selectedListKey === definition.key
                  ? 'border-blue-500 bg-blue-50 text-blue-900'
                  : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">{definition.category}</div>
              <div className="font-medium">{definition.label}</div>
            </button>
          ))}
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-5 space-y-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{selectedDefinition.label}</h2>
              <p className="text-sm text-gray-600">{selectedDefinition.description}</p>
            </div>
            {message && <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{message}</p>}
          </div>

          <div className="flex flex-col gap-2 rounded-lg border border-dashed border-gray-300 p-3 sm:flex-row">
            <input
              value={newLabels[selectedListKey] || ''}
              onChange={(event) => setNewLabels((current) => ({ ...current, [selectedListKey]: event.target.value }))}
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500"
              placeholder="Neue Option, z. B. Spezialtransformator"
            />
            <button
              type="button"
              onClick={addOption}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              <Plus size={16} />
              Option hinzufügen
            </button>
          </div>

          {isLoading ? (
            <p className="text-sm text-gray-500">Lade Auswahllisten...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-3 py-2 text-left">Aktiv</th>
                    <th className="px-3 py-2 text-left">Name</th>
                    <th className="px-3 py-2 text-left">Technischer Wert</th>
                    <th className="px-3 py-2 text-left">Reihenfolge</th>
                    {selectedDefinition.metadataFields?.map((field) => (
                      <th key={String(field.key)} className="px-3 py-2 text-left">{field.label}</th>
                    ))}
                    <th className="px-3 py-2 text-right">Aktionen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {selectedOptions.map((option) => (
                    <tr key={`${option.listKey}-${option.value}`} className={!hasDefaultActiveState(option) ? 'bg-gray-50 text-gray-400' : ''}>
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={option.isActive}
                          onChange={(event) => updateOption(option, { isActive: event.target.checked })}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          value={option.label}
                          onChange={(event) => updateOption(option, { label: event.target.value })}
                          className="w-full min-w-48 rounded border border-gray-300 px-2 py-1"
                        />
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-gray-500">{option.value}</td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          value={option.sortOrder}
                          onChange={(event) => updateOption(option, { sortOrder: normalizeSortOrder(event.target.value) })}
                          className="w-24 rounded border border-gray-300 px-2 py-1"
                        />
                      </td>
                      {selectedDefinition.metadataFields?.map((field) => (
                        <td key={String(field.key)} className="px-3 py-2">
                          <label className="inline-flex items-center gap-2 text-xs text-gray-600" title={field.helpText}>
                            <input
                              type="checkbox"
                              checked={option.metadata?.[field.key] === true}
                              onChange={(event) => updateOption(option, {
                                metadata: { ...(option.metadata || {}), [field.key]: event.target.checked } as SelectOptionMetadata,
                              })}
                            />
                            Ja
                          </label>
                        </td>
                      ))}
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => deleteOption(option)}
                          className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
                          title={option.isSystem ? 'Systemwert deaktivieren' : 'Option löschen'}
                        >
                          {option.isSystem ? <Save size={14} /> : <Trash2 size={14} />}
                          {option.isSystem ? 'Deaktivieren' : 'Löschen'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
