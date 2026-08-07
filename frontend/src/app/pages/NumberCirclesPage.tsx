import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, Hash, Pencil, Plus, RefreshCcw, Save, X } from 'lucide-react';
import {
  listNumberCircles,
  previewNumberCircle,
  saveNumberCircle,
  validateNumberCircleForm,
} from '../lib/numberCircles';
import type { NumberCircle, NumberCircleForm } from '../lib/numberCircles';
import { useModalClose } from '../hooks/useModalClose';

const CURRENT_YEAR = new Date().getFullYear();

const EMPTY_FORM: NumberCircleForm = {
  key: '',
  label: '',
  prefix: '',
  formatTemplate: '{PREFIX}-{NUMBER}',
  padding: 6,
  nextValue: 1,
  resetYearly: false,
  lastYear: CURRENT_YEAR,
  isActive: true,
};

function formFromCircle(circle: NumberCircle): NumberCircleForm {
  return {
    key: circle.key,
    label: circle.label,
    prefix: circle.prefix,
    formatTemplate: circle.formatTemplate,
    padding: circle.padding,
    nextValue: circle.nextValue,
    resetYearly: circle.resetYearly,
    lastYear: circle.lastYear ?? CURRENT_YEAR,
    isActive: circle.isActive,
  };
}

export default function NumberCirclesPage() {
  const [circles, setCircles] = useState<NumberCircle[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<NumberCircleForm>(EMPTY_FORM);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [savedMessage, setSavedMessage] = useState('');

  const editingCircle = useMemo(
    () => (editingKey ? circles.find((circle) => circle.key === editingKey) ?? null : null),
    [circles, editingKey]
  );

  const validationErrors = useMemo(() => validateNumberCircleForm(form), [form]);
  const preview = useMemo(() => {
    try {
      return previewNumberCircle(form);
    } catch {
      return 'Keine Vorschau möglich';
    }
  }, [form]);

  const maxUsedNumber = editingCircle?.maxUsedNumber ?? null;
  const showsLowerThanKnownWarning = maxUsedNumber !== null && form.nextValue <= maxUsedNumber;

  const load = async () => {
    setIsLoading(true);
    setError('');
    try {
      const next = await listNumberCircles();
      setCircles(next);
    } catch (loadError) {
      setError(String(loadError));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startCreate = () => {
    setEditingKey(null);
    setForm(EMPTY_FORM);
    setError('');
    setFormError('');
    setSavedMessage('');
    setDialogOpen(true);
  };

  const startEdit = (circle: NumberCircle) => {
    setEditingKey(circle.key);
    setForm(formFromCircle(circle));
    setError('');
    setFormError('');
    setSavedMessage('');
    setDialogOpen(true);
  };

  const closeDialog = useCallback(() => {
    if (isSaving) return;
    setDialogOpen(false);
    setEditingKey(null);
    setForm(EMPTY_FORM);
    setFormError('');
  }, [isSaving]);

  const handleDialogBackdropClick = useModalClose(dialogOpen, closeDialog);

  const updateForm = <K extends keyof NumberCircleForm>(key: K, value: NumberCircleForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setFormError('');
    setSavedMessage('');
  };

  const handleSave = async () => {
    setFormError('');
    setSavedMessage('');
    const errors = validateNumberCircleForm(form);
    if (errors.length > 0) {
      setFormError(errors.join(' '));
      return;
    }

    setIsSaving(true);
    try {
      await saveNumberCircle({ ...form, key: form.key.trim(), label: form.label.trim() });
      const next = await listNumberCircles();
      setCircles(next);
      setDialogOpen(false);
      setEditingKey(null);
      setForm(EMPTY_FORM);
      setSavedMessage('Gespeichert.');
    } catch (saveError) {
      setFormError(String(saveError));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nummernkreise</h1>
          <p className="text-sm text-gray-500 mt-1">Konfiguration für Kalkulationen und Serviceberichte</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border bg-white text-sm hover:bg-gray-50"
          >
            <RefreshCcw size={16} />
            Aktualisieren
          </button>
          <button
            onClick={startCreate}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700"
          >
            <Plus size={16} />
            Neu
          </button>
        </div>
      </div>

      {error && (
        <div className="flex gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {savedMessage && (
        <div className="flex gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          <Check size={16} className="shrink-0 mt-0.5" />
          <span>{savedMessage}</span>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[880px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-left">
                <th className="px-4 py-3 font-medium text-gray-600">Kreis</th>
                <th className="px-4 py-3 font-medium text-gray-600">Vorschau</th>
                <th className="px-4 py-3 font-medium text-gray-600">Nächster Wert</th>
                <th className="px-4 py-3 font-medium text-gray-600">Jahresreset</th>
                <th className="px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="px-4 py-3 font-medium text-gray-600 text-right">Aktion</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Lade Nummernkreise...</td></tr>
              ) : circles.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Keine Nummernkreise vorhanden</td></tr>
              ) : circles.map((circle) => (
                <tr key={circle.key} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{circle.label}</div>
                    <code className="text-xs text-gray-500">{circle.key}</code>
                  </td>
                  <td className="px-4 py-3 font-mono text-gray-700">{circle.preview}</td>
                  <td className="px-4 py-3 text-gray-700">{circle.nextValue}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${circle.resetYearly ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                      {circle.resetYearly ? 'Ja' : 'Nein'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${circle.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                      {circle.isActive ? 'Aktiv' : 'Inaktiv'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => startEdit(circle)}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded border text-xs hover:bg-white"
                    >
                      <Pencil size={13} />
                      Bearbeiten
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {dialogOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6"
          onClick={handleDialogBackdropClick}
        >
          <div className="flex max-h-full w-full max-w-2xl flex-col overflow-hidden rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-6 py-4">
              <div className="flex items-center gap-2">
                <Hash size={18} className="text-gray-400" />
                <h2 className="text-lg font-semibold text-gray-900">
                  {editingKey ? 'Nummernkreis bearbeiten' : 'Nummernkreis anlegen'}
                </h2>
              </div>
              <button
                onClick={closeDialog}
                disabled={isSaving}
                className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50"
                aria-label="Dialog schließen"
              >
                <X size={20} />
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
              <div className="rounded-lg border bg-gray-50 px-4 py-4">
                <p className="text-xs text-gray-500 mb-1">Live-Vorschau</p>
                <p className="font-mono text-xl text-gray-900 break-all">{preview}</p>
              </div>

              {showsLowerThanKnownWarning && (
                <div className="flex gap-2 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs text-orange-800">
                  <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                  <span>Der nächste Wert liegt nicht über bereits bekannten Nummern. Speichern ist bewusst möglich.</span>
                </div>
              )}

              <label className="block text-sm">
                <span className="text-gray-700">Bezeichnung</span>
                <input
                  value={form.label}
                  onChange={(event) => updateForm('label', event.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </label>

              <label className="block text-sm">
                <span className="text-gray-700">Key</span>
                <input
                  value={form.key}
                  disabled={!!editingKey}
                  onChange={(event) => updateForm('key', event.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100 disabled:text-gray-500"
                  autoFocus={!editingKey}
                />
              </label>

              <label className="block text-sm">
                <span className="text-gray-700">Prefix</span>
                <input
                  value={form.prefix}
                  onChange={(event) => updateForm('prefix', event.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono"
                  placeholder="LS-{YYYY}"
                />
              </label>

              <label className="block text-sm">
                <span className="text-gray-700">Format-Template</span>
                <input
                  value={form.formatTemplate}
                  onChange={(event) => updateForm('formatTemplate', event.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono"
                  placeholder="{PREFIX}-{NUMBER}"
                />
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="text-gray-700">Stellenanzahl</span>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={form.padding}
                    onChange={(event) => updateForm('padding', Number(event.target.value))}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-gray-700">Nächster Wert</span>
                  <input
                    type="number"
                    min={1}
                    value={form.nextValue}
                    onChange={(event) => updateForm('nextValue', Number(event.target.value))}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.resetYearly}
                    onChange={(event) => updateForm('resetYearly', event.target.checked)}
                  />
                  <span>Zum Jahreswechsel zurücksetzen</span>
                </label>
                <label className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(event) => updateForm('isActive', event.target.checked)}
                  />
                  <span>Aktiv</span>
                </label>
              </div>
            </div>

            <div className="border-t border-gray-200 px-6 py-4">
              <div className="flex flex-wrap items-center justify-end gap-3">
                <button
                  onClick={closeDialog}
                  disabled={isSaving}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Abbrechen
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving || validationErrors.length > 0}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  <Save size={16} />
                  {isSaving ? 'Speichert...' : 'Speichern'}
                </button>
              </div>

              {(validationErrors.length > 0 || formError) && (
                <div className="mt-3 space-y-1 text-xs text-gray-500">
                  {validationErrors.map((validationError) => <p key={validationError}>{validationError}</p>)}
                  {formError && <p className="text-red-600">{formError}</p>}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
