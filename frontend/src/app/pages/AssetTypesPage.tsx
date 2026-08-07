import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  Plus,
  Search,
  Pencil,
  Power,
  PowerOff,
  X,
  AlertTriangle,
  ChevronRight,
  Lock,
} from 'lucide-react';
import {
  AssetType,
  pgAssetTypeStore,
  isValidCode,
  slugifyLabel,
  getDescendantIds,
} from '../lib/assetTypeStorage';
import { uuid } from '../lib/utils';
import { useModalClose } from '../hooks/useModalClose';

/**
 * AssetTypesPage – Admin-Modul zur Verwaltung von Asset-Typen.
 *
 * DEV: Eigenständiger LocalStorage (`hwerp.assetTypes.v1`), bewusst
 * außerhalb des Haupt-Repos. Storage-Funktionen sind als isolierte
 * Fassade angelegt → DB-Migration erfordert nur Austausch der Imports.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Sort: sortOrder ASC (nulls last), then label ASC */
function sortTypes(a: AssetType, b: AssetType): number {
  const aSort = a.sortOrder ?? Number.MAX_SAFE_INTEGER;
  const bSort = b.sortOrder ?? Number.MAX_SAFE_INTEGER;
  if (aSort !== bSort) return aSort - bSort;
  return a.label.localeCompare(b.label, 'de');
}

/**
 * Flattens the type hierarchy into a display-ready list.
 * Children appear directly below their parent, indented.
 * Sort within each level: sortOrder ASC (nulls last), then label ASC.
 */
function flattenHierarchy(types: AssetType[]): AssetType[] {
  const result: AssetType[] = [];
  const childrenOf = (parentId: string | null): AssetType[] =>
    types
      .filter((t) => (t.parentTypeId || null) === parentId)
      .sort(sortTypes);

  const walk = (parentId: string | null) => {
    for (const t of childrenOf(parentId)) {
      result.push(t);
      walk(t.id);
    }
  };

  walk(null);
  return result;
}

/** Build breadcrumb path label for a type (e.g. "Transformator › Zweiwickler") */
function getPathLabel(typeId: string, allTypes: AssetType[]): string {
  const parts: string[] = [];
  let current = allTypes.find((t) => t.id === typeId);
  while (current) {
    parts.unshift(current.label);
    current = current.parentTypeId
      ? allTypes.find((t) => t.id === current!.parentTypeId)
      : undefined;
  }
  return parts.join(' › ');
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

interface FormErrors {
  label?: string;
  code?: string;
  parentTypeId?: string;
}

interface FormState {
  label: string;
  code: string;
  short: string;
  parentTypeId: string | null;
  sortOrder: string;
  icon: string;
  isActive: boolean;
}

const EMPTY_FORM: FormState = {
  label: '',
  code: '',
  short: '',
  parentTypeId: null,
  sortOrder: '',
  icon: '',
  isActive: true,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AssetTypesPage() {
  // Data
  const [types, setTypes] = useState<AssetType[]>([]);
  const [showInactive, setShowInactive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null); // null = create mode
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [codeManuallyEdited, setCodeManuallyEdited] = useState(false);
  const [formSnapshot, setFormSnapshot] = useState<FormState | null>(null);
  const [showDialogDirtyWarning, setShowDialogDirtyWarning] = useState(false);

  // Confirm deactivate
  const [deactivateConfirmId, setDeactivateConfirmId] = useState<string | null>(null);

  // ---------- Init ----------
  useEffect(() => {
    async function init() {
      await pgAssetTypeStore.seedIfEmpty();
      const all = await pgAssetTypeStore.getAll();
      setTypes(all);
    }
    init();
  }, []);

  const reload = useCallback(async () => {
    const all = await pgAssetTypeStore.getAll();
    setTypes(all);
  }, []);

  // ---------- Derived ----------
  const filteredTypes = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const visible = types.filter((t) => {
      if (!showInactive && !t.isActive) return false;
      if (q) {
        return (
          t.label.toLowerCase().includes(q) ||
          t.code.toLowerCase().includes(q)
        );
      }
      return true;
    });
    return flattenHierarchy(visible);
  }, [types, showInactive, searchQuery]);

  // ---------- Validation ----------
  const validate = useCallback(
    (f: FormState): FormErrors => {
      const errors: FormErrors = {};

      // Label required
      if (!f.label.trim()) {
        errors.label = 'Bezeichnung ist erforderlich';
      }

      // Code required + format + unique
      if (!f.code.trim()) {
        errors.code = 'Code ist erforderlich';
      } else if (!isValidCode(f.code)) {
        errors.code =
          'Nur Kleinbuchstaben, Ziffern und Unterstrich erlaubt; muss mit Buchstabe beginnen';
      } else if (
        types.some(
          (t) =>
            t.code.toLowerCase() === f.code.toLowerCase() &&
            t.id !== (editingId ?? undefined)
        )
      ) {
        errors.code = 'Dieser Code ist bereits vergeben';
      }

      // Parent cycle check
      if (f.parentTypeId) {
        if (editingId && f.parentTypeId === editingId) {
          errors.parentTypeId = 'Ein Typ kann nicht sein eigener Parent sein';
        } else if (editingId) {
          const descendants = getDescendantIds(editingId, types);
          if (descendants.has(f.parentTypeId)) {
            errors.parentTypeId =
              'Zirkelbezug: Der gewählte Parent ist ein Nachfahre dieses Typs';
          }
        }
      }

      return errors;
    },
    [editingId, types]
  );

  // ---------- Handlers ----------

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormSnapshot(EMPTY_FORM);
    setFormErrors({});
    setCodeManuallyEdited(false);
    setDialogOpen(true);
  };

  const openEdit = (t: AssetType) => {
    const snapshot: FormState = {
      label: t.label,
      code: t.code,
      short: t.short || '',
      parentTypeId: t.parentTypeId,
      sortOrder: t.sortOrder != null ? String(t.sortOrder) : '',
      icon: t.icon || '',
      isActive: t.isActive,
    };
    setEditingId(t.id);
    setForm(snapshot);
    setFormSnapshot(snapshot);
    setFormErrors({});
    setCodeManuallyEdited(true); // in edit mode code is always "manual" (immutable)
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingId(null);
    setFormSnapshot(null);
  };

  const isDialogFormDirty = formSnapshot !== null &&
    JSON.stringify(form) !== JSON.stringify(formSnapshot);

  const handleDialogCloseAttempt = useCallback(() => {
    if (isDialogFormDirty) {
      setShowDialogDirtyWarning(true);
    } else {
      closeDialog();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDialogFormDirty]);

  const confirmDialogClose = () => {
    setShowDialogDirtyWarning(false);
    closeDialog();
  };

  const handleLabelChange = (value: string) => {
    const next = { ...form, label: value };
    // Auto-suggest code only on create and only if code wasn't manually edited
    if (!editingId && !codeManuallyEdited) {
      next.code = slugifyLabel(value);
    }
    setForm(next);
    if (formErrors.label) setFormErrors((e) => ({ ...e, label: undefined }));
  };

  const handleCodeChange = (value: string) => {
    setCodeManuallyEdited(true);
    setForm((f) => ({ ...f, code: value }));
    if (formErrors.code) setFormErrors((e) => ({ ...e, code: undefined }));
  };

  const handleParentChange = (value: string) => {
    setForm((f) => ({ ...f, parentTypeId: value || null }));
    if (formErrors.parentTypeId) setFormErrors((e) => ({ ...e, parentTypeId: undefined }));
  };

  const handleSave = async () => {
    const errors = validate(form);
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    const now = new Date().toISOString();
    const sortNum = form.sortOrder.trim()
      ? Number(form.sortOrder.trim())
      : null;

    if (editingId) {
      // Update
      const existing = types.find((t) => t.id === editingId);
      if (!existing) return;

      await pgAssetTypeStore.upsert({
        ...existing,
        label: form.label.trim(),
        short: form.short.trim() || null,
        parentTypeId: form.parentTypeId,
        sortOrder: isNaN(sortNum as number) ? null : sortNum,
        icon: form.icon.trim() || null,
        isActive: form.isActive,
        updatedAt: now,
      });
    } else {
      // Create
      const newType: AssetType = {
        id: uuid(),
        code: form.code.trim(),
        label: form.label.trim(),
        short: form.short.trim(),
        parentTypeId: form.parentTypeId,
        sortOrder: isNaN(sortNum as number) ? null : sortNum,
        icon: form.icon.trim() || null,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      };
      await pgAssetTypeStore.upsert(newType);
    }

    await reload();
    closeDialog();
  };

  const handleCloseDeactivateConfirm = useCallback(() => setDeactivateConfirmId(null), []);
  const handleDeactivateBackdropClick = useModalClose(!!deactivateConfirmId, handleCloseDeactivateConfirm);
  const handleDialogBackdropClick = useModalClose(dialogOpen, handleDialogCloseAttempt);

  const handleDeactivate = (id: string) => {
    setDeactivateConfirmId(id);
  };

  const confirmDeactivate = async () => {
    if (deactivateConfirmId) {
      await pgAssetTypeStore.deactivate(deactivateConfirmId);
      await reload();
      setDeactivateConfirmId(null);
    }
  };

  const handleReactivate = async (id: string) => {
    await pgAssetTypeStore.reactivate(id);
    await reload();
  };

  // ---------- Parent dropdown options ----------
  const parentOptions = useMemo(() => {
    // Active types only, exclude self + descendants
    let available = types.filter((t) => t.isActive);
    if (editingId) {
      const descendants = getDescendantIds(editingId, types);
      available = available.filter(
        (t) => t.id !== editingId && !descendants.has(t.id)
      );
    }
    return available.sort(sortTypes);
  }, [types, editingId]);

  // Parent label lookup
  const getParentLabel = (parentId: string | null): string => {
    if (!parentId) return '–';
    const parent = types.find((t) => t.id === parentId);
    return parent ? parent.label : '–';
  };

  // ---------- Render ----------
  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Asset-Typen</h1>
        <p className="text-sm text-gray-500 mt-1">
          Verwaltung der Typ-Hierarchie für Assets
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {/* Suche */}
        <div className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg bg-white flex-1 min-w-[200px] max-w-md">
          <Search size={16} className="text-gray-400 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Suchen nach Label oder Code…"
            className="w-full outline-none bg-transparent text-sm"
          />
        </div>

        {/* Toggle Inaktive */}
        <button
          onClick={() => setShowInactive(!showInactive)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors border ${
            showInactive
              ? 'bg-gray-200 border-gray-300 text-gray-700'
              : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
          }`}
        >
          {showInactive ? <PowerOff size={16} /> : <Power size={16} />}
          Inaktive anzeigen
        </button>

        {/* Neu */}
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
        >
          <Plus size={16} />
          Neu
        </button>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 font-medium text-gray-600">
                Label
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">
                Code
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">
                Short
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">
                Parent
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">
                Status
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">
                Sort
              </th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">
                Aktionen
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredTypes.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-8 text-center text-gray-400"
                >
                  {searchQuery
                    ? 'Keine Treffer'
                    : 'Noch keine Asset-Typen vorhanden'}
                </td>
              </tr>
            ) : (
              filteredTypes.map((t) => {
                const depth = getDepth(t.id, types);
                return (
                  <tr
                    key={t.id}
                    className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                      !t.isActive ? 'opacity-50' : ''
                    }`}
                  >
                    {/* Label with indent */}
                    <td className="px-4 py-3">
                      <div
                        className="flex items-center gap-1"
                        style={{ paddingLeft: `${depth * 20}px` }}
                      >
                        {depth > 0 && (
                          <ChevronRight
                            size={14}
                            className="text-gray-300 shrink-0"
                          />
                        )}
                        <span className={!t.isActive ? 'line-through' : ''}>
                          {t.label}
                        </span>
                      </div>
                    </td>

                    {/* Code */}
                    <td className="px-4 py-3">
                      <code className="text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-600">
                        {t.code}
                      </code>
                    </td>

                    {/* Short */}
                    <td className="px-4 py-3 text-gray-500">
                      {t.short || '–'}
                    </td>

                    {/* Parent */}
                    <td className="px-4 py-3 text-gray-500">
                      {getParentLabel(t.parentTypeId)}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          t.isActive
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {t.isActive ? 'Aktiv' : 'Inaktiv'}
                      </span>
                    </td>

                    {/* SortOrder */}
                    <td className="px-4 py-3 text-gray-500">
                      {t.sortOrder ?? '–'}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(t)}
                          className="p-1.5 rounded hover:bg-gray-200 transition-colors text-gray-500 hover:text-gray-700"
                          title="Bearbeiten"
                        >
                          <Pencil size={16} />
                        </button>
                        {t.isActive ? (
                          <button
                            onClick={() => handleDeactivate(t.id)}
                            className="p-1.5 rounded hover:bg-red-100 transition-colors text-gray-500 hover:text-red-600"
                            title="Deaktivieren"
                          >
                            <PowerOff size={16} />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleReactivate(t.id)}
                            className="p-1.5 rounded hover:bg-green-100 transition-colors text-gray-500 hover:text-green-600"
                            title="Reaktivieren"
                          >
                            <Power size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer info */}
      <p className="text-xs text-gray-400 mt-3">
        {types.filter((t) => t.isActive).length} aktiv
        {!showInactive && types.some((t) => !t.isActive) && (
          <span>
            {' · '}
            {types.filter((t) => !t.isActive).length} inaktiv (ausgeblendet)
          </span>
        )}
      </p>

      {/* ================================================================ */}
      {/* Create / Edit Dialog                                              */}
      {/* ================================================================ */}
      {dialogOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={handleDialogBackdropClick}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
            {/* Dialog Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-bold">
                {editingId ? 'Asset-Typ bearbeiten' : 'Neuen Asset-Typ anlegen'}
              </h2>
              <button
                onClick={handleDialogCloseAttempt}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Dialog Body */}
            <div className="px-6 py-5 space-y-4">
              {/* Label */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Bezeichnung <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.label}
                  onChange={(e) => handleLabelChange(e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    formErrors.label ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="z.B. Transformator – Zweiwickler"
                  autoFocus
                />
                {formErrors.label && (
                  <p className="text-xs text-red-600 mt-1">{formErrors.label}</p>
                )}
              </div>

              {/* Code */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Code <span className="text-red-500">*</span>
                </label>
                {editingId ? (
                  <div className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-sm text-gray-500">
                    <Lock size={14} className="shrink-0" />
                    <code>{form.code}</code>
                    <span className="text-xs text-gray-400 ml-auto">
                      Code ist dauerhaft
                    </span>
                  </div>
                ) : (
                  <>
                    <input
                      type="text"
                      value={form.code}
                      onChange={(e) => handleCodeChange(e.target.value)}
                      className={`w-full px-3 py-2 border rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        formErrors.code ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="z.B. trafo_2w"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      Kleinbuchstaben, Ziffern, Unterstrich. Wird automatisch
                      aus der Bezeichnung vorgeschlagen.
                    </p>
                  </>
                )}
                {formErrors.code && (
                  <p className="text-xs text-red-600 mt-1">{formErrors.code}</p>
                )}
              </div>

              {/* Short */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Short
                </label>
                <input
                  type="text"
                  value={form.short}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, short: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="z.B. Trafo 2W"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Kurzbezeichnung für kompakte Darstellung (optional).
                </p>
              </div>

              {/* Parent */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Übergeordneter Typ
                </label>
                <select
                  value={form.parentTypeId || ''}
                  onChange={(e) => handleParentChange(e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    formErrors.parentTypeId
                      ? 'border-red-500'
                      : 'border-gray-300'
                  }`}
                >
                  <option value="">Kein Parent (Root-Typ)</option>
                  {parentOptions.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {getPathLabel(opt.id, types)} ({opt.code})
                    </option>
                  ))}
                </select>
                {formErrors.parentTypeId && (
                  <p className="text-xs text-red-600 mt-1">
                    {formErrors.parentTypeId}
                  </p>
                )}
              </div>

              {/* SortOrder + Icon (nebeneinander) */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Sortierreihenfolge
                  </label>
                  <input
                    type="number"
                    value={form.sortOrder}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, sortOrder: e.target.value }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="z.B. 1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Icon
                  </label>
                  <input
                    type="text"
                    value={form.icon}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, icon: e.target.value }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="z.B. zap"
                  />
                </div>
              </div>

              {/* Active toggle (only edit mode) */}
              {editingId && (
                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() =>
                      setForm((f) => ({ ...f, isActive: !f.isActive }))
                    }
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      form.isActive ? 'bg-blue-600' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        form.isActive ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                  <span className="text-sm text-gray-700">
                    {form.isActive ? 'Aktiv' : 'Inaktiv'}
                  </span>
                </div>
              )}
            </div>

            {/* Dialog Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-lg">
              <button
                onClick={handleDialogCloseAttempt}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-100 transition-colors"
              >
                Abbrechen
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
              >
                {editingId ? 'Speichern' : 'Anlegen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* Deactivate Confirm Dialog                                         */}
      {/* ================================================================ */}
      {deactivateConfirmId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={handleDeactivateBackdropClick}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="p-2 bg-orange-100 rounded-full shrink-0">
                <AlertTriangle size={20} className="text-orange-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">
                  Typ deaktivieren?
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  Er bleibt für bestehende Assets erhalten, kann aber nicht mehr
                  für neue Assets gewählt werden.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeactivateConfirmId(null)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-100 transition-colors"
              >
                Abbrechen
              </button>
              <button
                onClick={confirmDeactivate}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition-colors"
              >
                Deaktivieren
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* Dialog Dirty Warning                                             */}
      {/* ================================================================ */}
      {showDialogDirtyWarning && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60]"
          onClick={(e) => { if (e.target === e.currentTarget) setShowDialogDirtyWarning(false); }}
        >
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">Änderungen verwerfen?</h2>
            <p className="text-gray-600 mb-6">
              Sie haben ungespeicherte Änderungen. Möchten Sie diese wirklich verwerfen?
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDialogDirtyWarning(false)}
                className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
              >
                Zurück
              </button>
              <button
                onClick={confirmDialogClose}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Änderungen verwerfen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Utility: compute hierarchy depth for indentation
// ---------------------------------------------------------------------------

function getDepth(typeId: string, allTypes: AssetType[]): number {
  let depth = 0;
  let current = allTypes.find((t) => t.id === typeId);
  while (current?.parentTypeId) {
    depth++;
    current = allTypes.find((t) => t.id === current!.parentTypeId);
    // Safety: prevent infinite loops
    if (depth > 20) break;
  }
  return depth;
}
