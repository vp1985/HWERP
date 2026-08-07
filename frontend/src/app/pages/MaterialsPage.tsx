import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { Plus, Edit2, Trash2, X, Lock } from 'lucide-react';
import { useAppStore } from '../context/AppStoreContext';
import { Material } from '../lib/types';
import { DataTable, DataTableColumn } from '../components/ui/DataTable';
import { usePriceVisibility } from '../context/PriceVisibilityContext';
import { uuid } from '../lib/utils';
import { useModalClose } from '../hooks/useModalClose';

/**
 * MaterialsPage - Liste aller Materialien/Artikel
 *
 * Features:
 * - DataTable mit Column Chooser, Reordering, Resizing
 * - Create/Edit Dialog im Stil von AssetTypesPage
 * - Auto-generierte Artikelnummern (MAT-001, MAT-002, ...)
 * - Preis-Maskierung via PriceVisibilityContext
 * - Einheiten-Dropdown
 * - Validation
 */
export default function MaterialsPage() {
  const navigate = useNavigate();
  const { state, dispatch, repository } = useAppStore();
  const { pricesVisible } = usePriceVisibility();
  const [isLoading, setIsLoading] = useState(true);

  // Dialog-State
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null); // null = create mode
  const [form, setForm] = useState<Omit<Material, 'id' | 'createdAt' | 'updatedAt'>>({
    articleNumber: '',
    name: '',
    description: null,
    unit: 'Stk',
    price: 0,
    supplier: null,
    category: null,
  });
  const [formErrors, setFormErrors] = useState<{
    articleNumber?: string;
    name?: string;
    unit?: string;
    price?: string;
  }>({});
  const [isSaving, setIsSaving] = useState(false);
  const [formSnapshot, setFormSnapshot] = useState<Omit<Material, 'id' | 'createdAt' | 'updatedAt'> | null>(null);
  const [showDialogDirtyWarning, setShowDialogDirtyWarning] = useState(false);

  // Daten laden
  useEffect(() => {
    async function loadData() {
      try {
        const materialsData = await repository.list<Material>('materials');
        dispatch({ type: 'SET_ENTITIES', entity: 'materials', data: materialsData });
      } catch (error) {
        console.error('Fehler beim Laden der Materialien:', error);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [repository, dispatch]);

  const materials = (state.materials as Material[]) || [];

  // Verfügbare Einheiten
  const availableUnits = ['Stk', 'm', 'm²', 'm³', 'kg', 'L', 'Rolle', 'Paket', 'Set'];

  // ========================================================
  // Dialog-Funktionen
  // ========================================================

  /**
   * Generiert die nächste verfügbare Artikelnummer im Format MAT-XXX
   */
  const generateNextArticleNumber = (): string => {
    const existingNumbers = materials
      .map((m) => m.articleNumber)
      .filter((n) => n.startsWith('MAT-'))
      .map((n) => parseInt(n.replace('MAT-', ''), 10))
      .filter((n) => !isNaN(n));

    const maxNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) : 0;
    const nextNumber = maxNumber + 1;
    return `MAT-${String(nextNumber).padStart(3, '0')}`;
  };

  const openCreate = () => {
    setEditingId(null);
    const snapshot = {
      articleNumber: generateNextArticleNumber(),
      name: '',
      description: null as null,
      unit: 'Stk',
      price: 0,
      supplier: null as null,
      category: null as null,
    };
    setForm(snapshot);
    setFormSnapshot(snapshot);
    setFormErrors({});
    setDialogOpen(true);
  };

  const openEdit = (material: Material) => {
    const snapshot = {
      articleNumber: material.articleNumber,
      name: material.name,
      description: material.description,
      unit: material.unit,
      price: material.price,
      supplier: material.supplier,
      category: material.category,
    };
    setEditingId(material.id);
    setForm(snapshot);
    setFormSnapshot(snapshot);
    setFormErrors({});
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

  const handleDialogBackdropClick = useModalClose(dialogOpen, handleDialogCloseAttempt);

  const validateForm = (): boolean => {
    const errors: typeof formErrors = {};

    if (!form.articleNumber.trim()) {
      errors.articleNumber = 'Artikelnummer ist erforderlich';
    } else if (!editingId && materials.some((m) => m.articleNumber === form.articleNumber)) {
      errors.articleNumber = 'Artikelnummer existiert bereits';
    }

    if (!form.name.trim()) {
      errors.name = 'Bezeichnung ist erforderlich';
    }

    if (!form.unit.trim()) {
      errors.unit = 'Einheit ist erforderlich';
    }

    if (form.price < 0) {
      errors.price = 'Preis muss positiv sein';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    setIsSaving(true);
    try {
      if (editingId) {
        // Update
        const existing = materials.find((m) => m.id === editingId);
        if (!existing) throw new Error('Material nicht gefunden');

        const updated: Material = {
          ...existing,
          ...form,
          description: form.description || null,
          supplier: form.supplier || null,
          category: form.category || null,
          updatedAt: new Date(),
        };
        await repository.update('materials', editingId, updated);
        dispatch({
          type: 'SET_ENTITIES',
          entity: 'materials',
          data: materials.map((m) => (m.id === editingId ? updated : m)),
        });
      } else {
        // Create
        const newMaterial: Material = {
          id: uuid(),
          ...form,
          description: form.description || null,
          supplier: form.supplier || null,
          category: form.category || null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        await repository.create('materials', newMaterial);
        dispatch({
          type: 'SET_ENTITIES',
          entity: 'materials',
          data: [...materials, newMaterial],
        });
      }
      closeDialog();
    } catch (err) {
      console.error('Fehler beim Speichern:', err);
      alert('Speichern fehlgeschlagen');
    } finally {
      setIsSaving(false);
    }
  };

  // ========================================================
  // DataTable
  // ========================================================

  const columns: DataTableColumn<Material>[] = [
    {
      key: 'articleNumber',
      header: 'Art.-Nr.',
      sortable: true,
      width: 120,
      render: (mat) => <span className="font-mono text-sm">{mat.articleNumber}</span>,
    },
    {
      key: 'name',
      header: 'Bezeichnung',
      sortable: true,
      width: 250,
      render: (mat) => mat.name,
    },
    {
      key: 'category',
      header: 'Kategorie',
      sortable: true,
      width: 150,
      render: (mat) =>
        mat.category || <span className="text-gray-400 italic">–</span>,
    },
    {
      key: 'unit',
      header: 'Einheit',
      sortable: true,
      width: 100,
      render: (mat) => mat.unit,
    },
    {
      key: 'price',
      header: 'Preis',
      sortable: true,
      width: 120,
      align: 'right',
      render: (mat) =>
        pricesVisible ? (
          <span className="font-mono text-sm">{mat.price.toFixed(2)} €</span>
        ) : (
          <span className="text-gray-400">•••••</span>
        ),
    },
    {
      key: 'supplier',
      header: 'Lieferant',
      sortable: true,
      width: 200,
      render: (mat) =>
        mat.supplier || <span className="text-gray-400 italic">–</span>,
    },
    {
      key: 'description',
      header: 'Beschreibung',
      sortable: false,
      width: 300,
      render: (mat) =>
        mat.description || <span className="text-gray-400 italic">–</span>,
    },
  ];

  const defaultVisibleKeys = [
    'articleNumber',
    'name',
    'category',
    'unit',
    'price',
    'supplier',
    'description',
  ];

  const handleRowClick = (material: Material) => {
    console.log('Material clicked:', material);
  };

  const handleDelete = async (material: Material) => {
    if (!confirm(`Material "${material.name}" wirklich löschen?`)) return;

    try {
      await repository.delete('materials', material.id);
      const updated = materials.filter((m) => m.id !== material.id);
      dispatch({ type: 'SET_ENTITIES', entity: 'materials', data: updated });
    } catch (error) {
      console.error('Fehler beim Löschen:', error);
      alert('Löschen fehlgeschlagen.');
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <main className="flex-1 overflow-hidden p-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 h-full flex flex-col">
          <DataTable
            title="Material"
            primaryAction={{
              label: 'Neues Material',
              onClick: openCreate,
            }}
            columns={columns}
            rows={materials}
            rowKey={(m) => m.id}
            onRowClick={handleRowClick}
            loading={isLoading}
            emptyState={{
              title: 'Keine Materialien vorhanden',
              description:
                'Legen Sie Ihr erstes Material an, um mit der Arbeit zu beginnen.',
              actionLabel: 'Material anlegen',
              onAction: openCreate,
            }}
            columnVisibility={{
              enabled: true,
              storageKey: 'datatable.materials',
              defaultVisibleKeys: defaultVisibleKeys,
              enableReordering: true,
              enableResizing: true,
            }}
            actions={(material) => (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    openEdit(material);
                  }}
                  className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                  title="Bearbeiten"
                >
                  <Edit2 size={14} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(material);
                  }}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                  title="Löschen"
                >
                  <Trash2 size={14} />
                </button>
              </>
            )}
          />
        </div>
      </main>

      {/* ================================================================ */}
      {/* Create / Edit Dialog (im Stil von AssetTypesPage)              */}
      {/* ================================================================ */}
      {dialogOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={handleDialogBackdropClick}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
            {/* Dialog Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-bold">
                {editingId ? 'Material bearbeiten' : 'Neues Material anlegen'}
              </h2>
              <button
                onClick={handleDialogCloseAttempt}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                disabled={isSaving}
              >
                <X size={20} />
              </button>
            </div>

            {/* Dialog Body */}
            <div className="px-6 py-5 space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto">
              {/* Artikelnummer */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Artikelnummer <span className="text-red-500">*</span>
                </label>
                {editingId ? (
                  <div className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-sm text-gray-500">
                    <Lock size={14} className="shrink-0" />
                    <code>{form.articleNumber}</code>
                    <span className="text-xs text-gray-400 ml-auto">
                      Artikelnummer ist dauerhaft
                    </span>
                  </div>
                ) : (
                  <>
                    <input
                      type="text"
                      value={form.articleNumber}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, articleNumber: e.target.value }))
                      }
                      className={`w-full px-3 py-2 border rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        formErrors.articleNumber
                          ? 'border-red-500'
                          : 'border-gray-300'
                      }`}
                      placeholder="z.B. MAT-021"
                      autoFocus
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      Wird automatisch vorgeschlagen (MAT-XXX Format).
                    </p>
                  </>
                )}
                {formErrors.articleNumber && (
                  <p className="text-xs text-red-600 mt-1">
                    {formErrors.articleNumber}
                  </p>
                )}
              </div>

              {/* Bezeichnung */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Bezeichnung <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    formErrors.name ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="z.B. NYM-J 3x1,5 mm² Kabel"
                />
                {formErrors.name && (
                  <p className="text-xs text-red-600 mt-1">{formErrors.name}</p>
                )}
              </div>

              {/* Beschreibung */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Beschreibung
                </label>
                <textarea
                  value={form.description || ''}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      description: e.target.value || null,
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Optional: Zusätzliche Details zum Material"
                  rows={3}
                />
              </div>

              {/* Einheit */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Einheit <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.unit}
                  onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
                  className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    formErrors.unit ? 'border-red-500' : 'border-gray-300'
                  }`}
                >
                  {availableUnits.map((unit) => (
                    <option key={unit} value={unit}>
                      {unit}
                    </option>
                  ))}
                </select>
                {formErrors.unit && (
                  <p className="text-xs text-red-600 mt-1">{formErrors.unit}</p>
                )}
              </div>

              {/* Preis */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Preis (€ / Einheit) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.price}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, price: parseFloat(e.target.value) || 0 }))
                  }
                  className={`w-full px-3 py-2 border rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    formErrors.price ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="0.00"
                />
                {formErrors.price && (
                  <p className="text-xs text-red-600 mt-1">{formErrors.price}</p>
                )}
              </div>

              {/* Lieferant */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Lieferant
                </label>
                <input
                  type="text"
                  value={form.supplier || ''}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, supplier: e.target.value || null }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="z.B. Elektro Großhandel Schmidt"
                />
              </div>

              {/* Kategorie */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Kategorie
                </label>
                <input
                  type="text"
                  value={form.category || ''}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, category: e.target.value || null }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="z.B. Elektro, Schrauben, Werkzeug"
                />
              </div>
            </div>

            {/* Dialog Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200">
              <button
                onClick={handleDialogCloseAttempt}
                disabled={isSaving}
                className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Abbrechen
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 min-w-[80px]"
              >
                {isSaving ? 'Speichert...' : 'Speichern'}
              </button>
            </div>
          </div>
        </div>
      )}

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
