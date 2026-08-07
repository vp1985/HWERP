import { useState, useEffect, useCallback } from 'react';
import { Edit2, Trash2, X, Lock } from 'lucide-react';
import { useAppStore } from '../context/AppStoreContext';
import { Service, ChecklistTemplate } from '../lib/types';
import { DataTable, DataTableColumn } from '../components/ui/DataTable';
import { usePriceVisibility } from '../context/PriceVisibilityContext';
import { uuid } from '../lib/utils';
import { useModalClose } from '../hooks/useModalClose';
import {
  DEFAULT_NUMBER_RANGES,
  EditableNumberRangeConfig,
  SERVICE_NUMBER_RANGE_ID,
  buildNextNumber,
  findNumberRangeByIdOrLabel,
  loadNumberRangesFromStorage,
  saveNumberRangesToStorage,
} from '../lib/numberRangeUtils';

type ServiceForm = Omit<Service, 'id' | 'createdAt' | 'updatedAt'>;

const DEFAULT_WORKSHOP_CATEGORY = 'TX-Standsätze';
const SERVICE_NUMBER_RANGE_LABEL = 'Serviceleistungen';
const WORKSHOP_CATEGORIES = ['TX-Standsätze', 'Allgemein', 'Prüfung', 'Werkstatt', 'Dokumentation'];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function loadEditableNumberRanges(): EditableNumberRangeConfig[] {
  if (typeof window === 'undefined') return DEFAULT_NUMBER_RANGES;
  return loadNumberRangesFromStorage();
}

function getServiceNumberRange(numberRanges: EditableNumberRangeConfig[]): EditableNumberRangeConfig {
  return findNumberRangeByIdOrLabel(numberRanges, SERVICE_NUMBER_RANGE_ID, SERVICE_NUMBER_RANGE_LABEL);
}

function parseNumberFromRange(value: string, range: EditableNumberRangeConfig): number | null {
  const pattern = new RegExp(`^${escapeRegExp(range.prefix)}(\\d+)$${range.suffix ? '' : ''}`);
  const suffixPattern = range.suffix ? new RegExp(`${escapeRegExp(range.suffix)}$`) : null;
  const valueWithoutSuffix = suffixPattern ? value.replace(suffixPattern, '') : value;
  const match = valueWithoutSuffix.match(pattern);
  if (!match) return null;

  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function nextServiceNumberFromRange(services: Service[], range: EditableNumberRangeConfig): string {
  const highestExisting = services.reduce((highest, service) => {
    const parsed = parseNumberFromRange(service.serviceNumber, range);
    return parsed === null ? highest : Math.max(highest, parsed);
  }, 0);

  return buildNextNumber({
    ...range,
    nextNumber: Math.max(range.nextNumber, highestExisting + 1),
  });
}

function normalizeServiceForm(service: Partial<Service> = {}): ServiceForm {
  return {
    serviceNumber: service.serviceNumber ?? '',
    name: service.name ?? '',
    description: service.description ?? null,
    unit: service.unit ?? 'Std',
    price: service.price ?? 0,
    category: service.category ?? null,
    active: service.active ?? true,
    availableInWorkshopCards: service.availableInWorkshopCards ?? false,
    workshopCategory: service.workshopCategory ?? service.category ?? DEFAULT_WORKSHOP_CATEGORY,
    workshopRequired: service.workshopRequired ?? true,
    workshopPhotoRequired: service.workshopPhotoRequired ?? false,
    workshopProtocolRequired: service.workshopProtocolRequired ?? false,
    workshopMeasurementsRequired: service.workshopMeasurementsRequired ?? false,
    workshopMaterialEntryEnabled: service.workshopMaterialEntryEnabled ?? false,
    sortOrder: service.sortOrder ?? 100,
    checklistTemplateIds: service.checklistTemplateIds ?? [],
  };
}

/**
 * ServicesPage - Liste aller Leistungen
 *
 * Features:
 * - Stammdaten-Untermenü für Leistungen/Services
 * - Create/Edit Dialog (analog MaterialsPage)
 * - Auto-generierte Servicenummern über Nummernkreis Serviceleistungen (SL0001, SL0002, ...)
 * - Preis-Maskierung via PriceVisibilityContext
 * - Einheiten-Dropdown (Std, Pauschal, Tag, Woche, Monat)
 * - Validation
 */
export default function ServicesPage() {
  const { state, dispatch, repository } = useAppStore();
  const { pricesVisible } = usePriceVisibility();
  const [isLoading, setIsLoading] = useState(true);
  const [checklistTemplates, setChecklistTemplates] = useState<ChecklistTemplate[]>([]);

  // Dialog-State
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null); // null = create mode
  const [form, setForm] = useState<ServiceForm>(() => normalizeServiceForm());
  const [formErrors, setFormErrors] = useState<{
    serviceNumber?: string;
    name?: string;
    unit?: string;
    price?: string;
  }>({});
  const [isSaving, setIsSaving] = useState(false);
  const [formSnapshot, setFormSnapshot] = useState<ServiceForm | null>(null);
  const [showDialogDirtyWarning, setShowDialogDirtyWarning] = useState(false);

  // Daten laden
  useEffect(() => {
    async function loadData() {
      try {
        const [servicesData, templatesData] = await Promise.all([
          repository.list<Service>('services'),
          repository.list<ChecklistTemplate>('checklistTemplates'),
        ]);
        dispatch({ type: 'SET_ENTITIES', entity: 'services', data: servicesData });
        dispatch({ type: 'SET_ENTITIES', entity: 'checklistTemplates', data: templatesData });
        setChecklistTemplates(templatesData);
      } catch (error) {
        console.error('Fehler beim Laden der Services:', error);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [repository, dispatch]);

  const services = (state.services as Service[]) || [];
  const activeChecklistTemplates = checklistTemplates.filter((template) => template.status === 'active');

  // Verfügbare Einheiten für Dienstleistungen
  const availableUnits = ['Std', 'Pauschal', 'Tag', 'Woche', 'Monat'];

  // ========================================================
  // Dialog-Funktionen
  // ========================================================

  /**
   * Generiert die nächste verfügbare Servicenummer aus dem Nummernkreis Serviceleistungen.
   */
  const generateNextServiceNumber = (): string => {
    const numberRanges = loadEditableNumberRanges();
    const serviceNumberRange = getServiceNumberRange(numberRanges);
    return nextServiceNumberFromRange(services, serviceNumberRange);
  };

  const advanceServiceNumberRange = (serviceNumber: string) => {
    if (typeof window === 'undefined') return;

    const numberRanges = loadEditableNumberRanges();
    const serviceNumberRange = getServiceNumberRange(numberRanges);
    const createdNumber = parseNumberFromRange(serviceNumber, serviceNumberRange);
    if (createdNumber === null) return;

    saveNumberRangesToStorage(
      numberRanges.map((range) =>
        range.id === serviceNumberRange.id
          ? { ...range, nextNumber: Math.max(range.nextNumber, createdNumber + 1) }
          : range,
      ),
    );
  };

  const openCreate = () => {
    setEditingId(null);
    const snapshot = normalizeServiceForm({
      serviceNumber: generateNextServiceNumber(),
      category: DEFAULT_WORKSHOP_CATEGORY,
      workshopCategory: DEFAULT_WORKSHOP_CATEGORY,
      availableInWorkshopCards: true,
      unit: 'Pauschal',
    });
    setForm(snapshot);
    setFormSnapshot(snapshot);
    setFormErrors({});
    setDialogOpen(true);
  };

  const openEdit = (service: Service) => {
    const snapshot = normalizeServiceForm(service);
    setEditingId(service.id);
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

  const toggleChecklistTemplate = (templateId: string) => {
    setForm((current) => ({
      ...current,
      checklistTemplateIds: current.checklistTemplateIds.includes(templateId)
        ? current.checklistTemplateIds.filter((id) => id !== templateId)
        : [...current.checklistTemplateIds, templateId],
    }));
  };

  const validateForm = (): boolean => {
    const errors: typeof formErrors = {};

    if (!form.serviceNumber.trim()) {
      errors.serviceNumber = 'Servicenummer ist erforderlich';
    } else if (!editingId && services.some((s) => s.serviceNumber === form.serviceNumber)) {
      errors.serviceNumber = 'Servicenummer existiert bereits';
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
        const existing = services.find((s) => s.id === editingId);
        if (!existing) throw new Error('Service nicht gefunden');

        const updated: Service = {
          ...existing,
          ...form,
          description: form.description || null,
          category: form.category || null,
          updatedAt: new Date().toISOString(),
        };
        await repository.update('services', editingId, updated);
        dispatch({
          type: 'SET_ENTITIES',
          entity: 'services',
          data: services.map((s) => (s.id === editingId ? updated : s)),
        });
      } else {
        // Create
        const newService: Service = {
          id: uuid(),
          ...form,
          description: form.description || null,
          category: form.category || null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await repository.create('services', newService);
        advanceServiceNumberRange(newService.serviceNumber);
        dispatch({
          type: 'SET_ENTITIES',
          entity: 'services',
          data: [...services, newService],
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

  const handleDelete = async (service: Service) => {
    if (!confirm(`Service "${service.name}" wirklich löschen?`)) return;

    try {
      await repository.delete('services', service.id);
      dispatch({
        type: 'SET_ENTITIES',
        entity: 'services',
        data: services.filter((s) => s.id !== service.id),
      });
    } catch (error) {
      console.error('Fehler beim Löschen:', error);
      alert('Löschen fehlgeschlagen.');
    }
  };

  // ========================================================
  // DataTable
  // ========================================================

  const columns: DataTableColumn<Service>[] = [
    {
      key: 'serviceNumber',
      header: 'Srv.-Nr.',
      sortable: true,
      width: 120,
      render: (srv) => <span className="font-mono text-sm">{srv.serviceNumber}</span>,
    },
    {
      key: 'name',
      header: 'Bezeichnung',
      sortable: true,
      width: 250,
      render: (srv) => srv.name,
    },
    {
      key: 'category',
      header: 'Kategorie',
      sortable: true,
      width: 150,
      render: (srv) =>
        srv.category || <span className="text-gray-400 italic">–</span>,
    },
    {
      key: 'active',
      header: 'Aktiv',
      sortable: true,
      width: 90,
      render: (srv) => (srv.active ?? true) ? 'Ja' : <span className="text-gray-400">Nein</span>,
    },
    {
      key: 'availableInWorkshopCards',
      header: 'Werkstattkarte',
      sortable: true,
      width: 150,
      render: (srv) => srv.availableInWorkshopCards ? 'verfügbar' : <span className="text-gray-400">–</span>,
    },
    {
      key: 'workshopCategory',
      header: 'WK-Kategorie',
      sortable: true,
      width: 150,
      render: (srv) => srv.workshopCategory || srv.category || <span className="text-gray-400 italic">–</span>,
    },
    {
      key: 'checklistTemplateIds',
      header: 'Checklisten',
      sortable: false,
      width: 120,
      render: (srv) => `${srv.checklistTemplateIds?.length ?? 0}`,
    },
    {
      key: 'unit',
      header: 'Einheit',
      sortable: true,
      width: 100,
      render: (srv) => srv.unit,
    },
    {
      key: 'price',
      header: 'Preis',
      sortable: true,
      width: 120,
      align: 'right',
      render: (srv) =>
        pricesVisible ? (
          <span className="font-mono text-sm">{srv.price.toFixed(2)} €</span>
        ) : (
          <span className="text-gray-400">•••••</span>
        ),
    },
    {
      key: 'description',
      header: 'Beschreibung',
      sortable: false,
      width: 300,
      render: (srv) =>
        srv.description || <span className="text-gray-400 italic">–</span>,
    },
  ];

  const defaultVisibleKeys = ['serviceNumber', 'name', 'category', 'active', 'availableInWorkshopCards', 'workshopCategory', 'checklistTemplateIds', 'unit', 'price'];

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <main className="flex-1 overflow-hidden p-[3px]">
        <div className="h-full flex flex-col">
          <DataTable
            density="ultraCompact"
            title="Leistungen"
            primaryAction={{
              label: 'Neue Leistung',
              onClick: openCreate,
            }}
            columns={columns}
            rows={services}
            rowKey={(s) => s.id}
            onRowClick={() => {}}
            loading={isLoading}
            emptyState={{
              title: 'Keine Leistungen vorhanden',
              description:
                'Legen Sie Ihre erste Leistung an, um sie in Kalkulationen oder Werkstattkarten zu verwenden.',
              actionLabel: 'Leistung anlegen',
              onAction: openCreate,
            }}
            columnVisibility={{
              enabled: true,
              storageKey: 'datatable.services',
              defaultVisibleKeys: defaultVisibleKeys,
              enableReordering: true,
              enableResizing: true,
            }}
            actions={(service) => (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    openEdit(service);
                  }}
                  className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                  title="Bearbeiten"
                >
                  <Edit2 size={14} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(service);
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
      {/* Create / Edit Dialog                                            */}
      {/* ================================================================ */}
      {dialogOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={handleDialogBackdropClick}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
            {/* Dialog Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-bold">
                {editingId ? 'Leistung bearbeiten' : 'Neue Leistung anlegen'}
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

              {/* Servicenummer */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Servicenummer <span className="text-red-500">*</span>
                </label>
                {editingId ? (
                  <div className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-sm text-gray-500">
                    <Lock size={14} className="shrink-0" />
                    <code>{form.serviceNumber}</code>
                    <span className="text-xs text-gray-400 ml-auto">
                      Servicenummer ist dauerhaft
                    </span>
                  </div>
                ) : (
                  <>
                    <input
                      type="text"
                      value={form.serviceNumber}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, serviceNumber: e.target.value }))
                      }
                      className={`w-full px-3 py-2 border rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        formErrors.serviceNumber ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="z.B. SL0001"
                      autoFocus
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      Wird automatisch aus dem Nummernkreis Serviceleistungen vorgeschlagen.
                    </p>
                  </>
                )}
                {formErrors.serviceNumber && (
                  <p className="text-xs text-red-600 mt-1">{formErrors.serviceNumber}</p>
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
                  placeholder="z.B. Montage Schaltschrank"
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
                    setForm((f) => ({ ...f, description: e.target.value || null }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Optional: Zusätzliche Details zum Service"
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
                  placeholder="z.B. TX-Standsätze, Allgemein, Wartung"
                />
              </div>

              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
                <p className="text-sm font-semibold text-gray-800">Werkstattkarten-Verfügbarkeit</p>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
                  />
                  Leistung aktiv
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={form.availableInWorkshopCards}
                    onChange={(e) => setForm((f) => ({ ...f, availableInWorkshopCards: e.target.checked }))}
                  />
                  In Werkstattkarten verfügbar
                </label>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Werkstattkarten-Kategorie</label>
                  <input
                    list="workshop-service-categories"
                    value={form.workshopCategory || ''}
                    onChange={(e) => setForm((f) => ({ ...f, workshopCategory: e.target.value || null, category: f.category || e.target.value || null }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    placeholder="z.B. TX-Standsätze"
                  />
                  <datalist id="workshop-service-categories">
                    {WORKSHOP_CATEGORIES.map((category) => <option key={category} value={category} />)}
                  </datalist>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm text-gray-700">
                  <label className="flex items-center gap-2"><input type="checkbox" checked={form.workshopRequired} onChange={(e) => setForm((f) => ({ ...f, workshopRequired: e.target.checked }))} /> Pflicht</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={form.workshopPhotoRequired} onChange={(e) => setForm((f) => ({ ...f, workshopPhotoRequired: e.target.checked }))} /> Foto</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={form.workshopProtocolRequired} onChange={(e) => setForm((f) => ({ ...f, workshopProtocolRequired: e.target.checked }))} /> Prüfprotokoll</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={form.workshopMeasurementsRequired} onChange={(e) => setForm((f) => ({ ...f, workshopMeasurementsRequired: e.target.checked }))} /> Messwerte</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={form.workshopMaterialEntryEnabled} onChange={(e) => setForm((f) => ({ ...f, workshopMaterialEntryEnabled: e.target.checked }))} /> Material</label>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Sortierung</label>
                  <input
                    type="number"
                    value={form.sortOrder}
                    onChange={(e) => setForm((f) => ({ ...f, sortOrder: Number.parseInt(e.target.value, 10) || 100 }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div className="rounded-lg border border-gray-200 bg-white p-3">
                  <p className="text-xs font-semibold text-gray-700">Leistungs-Checklisten</p>
                  <p className="mt-1 text-xs text-gray-500">Diese Vorlagen werden automatisch als Checklistenlauf erzeugt, wenn die Leistung verwendet wird.</p>
                  <div className="mt-2 max-h-32 space-y-1 overflow-y-auto">
                    {activeChecklistTemplates.length === 0 ? (
                      <p className="text-xs text-gray-400">Keine aktiven Checklisten-Vorlagen vorhanden.</p>
                    ) : activeChecklistTemplates.map((template) => (
                      <label key={template.id} className="flex items-center gap-2 text-xs text-gray-700">
                        <input
                          type="checkbox"
                          checked={form.checklistTemplateIds.includes(template.id)}
                          onChange={() => toggleChecklistTemplate(template.id)}
                        />
                        {template.name}
                      </label>
                    ))}
                  </div>
                </div>
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
