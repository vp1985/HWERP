import { useMemo, useState } from 'react';
import { Hash, Plus, Save, Trash2 } from 'lucide-react';
import {
  DEFAULT_NUMBER_RANGES,
  EditableNumberRangeConfig,
  NumberRangeConfig,
  buildNextNumber,
  buildNumberRangePreview,
  loadNumberRangesFromStorage,
  normalizeNumberRangeConfig,
  saveNumberRangesToStorage,
} from '../lib/numberRangeUtils';

type EditableNumberRange = EditableNumberRangeConfig;

function loadNumberRanges(): EditableNumberRange[] {
  if (typeof window === 'undefined') return DEFAULT_NUMBER_RANGES;
  return loadNumberRangesFromStorage();
}

export default function AdminNumberRangesPage() {
  const [numberRanges, setNumberRanges] = useState<EditableNumberRange[]>(loadNumberRanges);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const normalizedRanges = useMemo(
    () => numberRanges.map((range) => ({ ...range, ...normalizeNumberRangeConfig(range) })),
    [numberRanges],
  );

  const updateNumberRange = <K extends keyof NumberRangeConfig>(
    id: string,
    key: K,
    value: NumberRangeConfig[K],
  ) => {
    setSaveMessage(null);
    setNumberRanges((current) =>
      current.map((range) => (range.id === id ? { ...range, [key]: value } : range)),
    );
  };

  const addNumberRange = () => {
    setSaveMessage(null);
    setNumberRanges((current) => [
      {
        id: `number-range-${Date.now()}`,
        label: 'Neuer Nummernkreis',
        prefix: '',
        digits: 4,
        nextNumber: 1,
        suffix: '',
      },
      ...current,
    ]);
  };

  const removeNumberRange = (id: string) => {
    setSaveMessage(null);
    setNumberRanges((current) => current.filter((range) => range.id !== id));
  };

  const saveNumberRanges = () => {
    const nextRanges = normalizedRanges.length > 0 ? normalizedRanges : DEFAULT_NUMBER_RANGES;
    setNumberRanges(nextRanges);
    saveNumberRangesToStorage(nextRanges);
    setSaveMessage('✓ Nummernkreise gespeichert.');
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-blue-600">Admin</p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900">Nummernkreise</h1>
          <p className="mt-2 max-w-3xl text-sm text-gray-600">
            Nummernkreise zentral verwalten: Prefix + Anzahl fortlaufender Nummern + Suffix.
            Standardmäßig sind Serviceleistungen, Werkstattkarten und Übernahmebelege angelegt. Die Vorschau zeigt immer die nächste Nummer und die folgenden Werte.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={addNumberRange}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Plus size={16} />
            Nummernkreis hinzufügen
          </button>
          <button
            type="button"
            onClick={saveNumberRanges}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Save size={16} />
            Speichern
          </button>
        </div>
      </div>

      {saveMessage && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
          {saveMessage}
        </div>
      )}

      <div className="grid gap-4">
        <span className="sr-only">Standard-Nummernkreise: Serviceleistungen, Werkstattkarten und Übernahmebelege</span>
        {normalizedRanges.map((range) => {
          const preview = buildNumberRangePreview(range, 5);
          const nextNumber = buildNextNumber(range);

          return (
            <section key={range.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="mb-3 grid gap-2 md:grid-cols-[1fr_auto_1fr] md:items-center">
                <p className="text-sm text-gray-500">
                  Nächste Nummer <span className="ml-2 font-mono font-semibold text-gray-900">{nextNumber}</span>
                </p>
                <div className="flex items-center gap-2 justify-self-center text-center">
                  <div className="rounded-lg bg-blue-50 p-1.5 text-blue-600">
                    <Hash size={18} />
                  </div>
                  <h2 className="text-base font-semibold text-gray-900">{range.label}</h2>
                </div>
                <div className="flex justify-start md:justify-end">
                  {numberRanges.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeNumberRange(range.id)}
                      className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
                    >
                      <Trash2 size={16} />
                      Entfernen
                    </button>
                  )}
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                <label className="space-y-1 text-sm font-medium text-gray-700">
                  Bezeichnung
                  <input
                    value={range.label}
                    onChange={(event) => updateNumberRange(range.id, 'label', event.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </label>
                <label className="space-y-1 text-sm font-medium text-gray-700">
                  Prefix
                  <input
                    value={range.prefix}
                    onChange={(event) => updateNumberRange(range.id, 'prefix', event.target.value)}
                    placeholder="WK-"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </label>
                <label className="space-y-1 text-sm font-medium text-gray-700">
                  Anzahl fortlaufender Nummern
                  <input
                    type="number"
                    min={1}
                    value={range.digits}
                    onChange={(event) => updateNumberRange(range.id, 'digits', Number(event.target.value))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </label>
                <label className="space-y-1 text-sm font-medium text-gray-700">
                  Nächste laufende Nummer
                  <input
                    type="number"
                    min={1}
                    value={range.nextNumber}
                    onChange={(event) => updateNumberRange(range.id, 'nextNumber', Number(event.target.value))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </label>
                <label className="space-y-1 text-sm font-medium text-gray-700">
                  Suffix
                  <input
                    value={range.suffix}
                    onChange={(event) => updateNumberRange(range.id, 'suffix', event.target.value)}
                    placeholder="-26"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </label>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-blue-100 bg-blue-50/60 px-3 py-2">
                <span className="text-sm font-semibold text-blue-900">Vorschau</span>
                {preview.map((number, index) => (
                  <span
                    key={number}
                    className={`rounded-md px-3 py-1.5 font-mono text-sm ${
                      index === 0 ? 'bg-blue-600 text-white' : 'bg-white text-blue-700 ring-1 ring-blue-100'
                    }`}
                  >
                    {number}
                  </span>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
