import { useEffect, useMemo, useState } from 'react';
import { Archive, CheckCircle2, ClipboardList, Plus, Save, Sparkles } from 'lucide-react';
import { useAppStore } from '../../../context/AppStoreContext';
import type {
  ChecklistItemAction,
  ChecklistItemActionConditionOperator,
  ChecklistItemActionType,
  ChecklistTemplate,
  ChecklistTemplateGroup,
  ChecklistTemplateItem,
  ChecklistTemplateType,
  ChecklistUsageContext,
  Material,
  Service,
} from '../../../lib/types';

const templateTypeLabels: Record<ChecklistTemplateType, string> = {
  trafo_workshop_card: 'Trafo-Werkstattkarte',
  order_preparation: 'Auftragsvorbereitung',
  packing_list: 'Rüstliste',
  calculation: 'Kalkulation',
  general: 'Sonstige',
};

const templateTypes = Object.keys(templateTypeLabels) as ChecklistTemplateType[];
const suggestionActionLabels: Record<ChecklistItemActionType, string> = {
  suggest_service: 'Leistung vorschlagen',
  suggest_material: 'Material vorschlagen',
  suggest_checklist: 'Aufgabenliste vorschlagen',
  create_task: 'Aufgabe vorschlagen',
  create_packing_item: 'Rüstlistenpunkt vorschlagen',
  add_billing_note: 'Abrechnungshinweis vorschlagen',
};
const conditionLabels: Record<ChecklistItemActionConditionOperator, string> = {
  equals: 'Antwort ist',
  not_equals: 'Antwort ist nicht',
  contains: 'Antwort enthält',
  exists: 'Antwort vorhanden',
};
const contextLabels: Record<ChecklistUsageContext, string> = {
  calculation: 'Kalkulation',
  offer: 'Angebot',
  order: 'Auftrag',
  order_preparation: 'Auftragsvorbereitung',
  packing_list: 'Rüstliste',
  workshop_card: 'Werkstattkarte',
  billing: 'Abrechnung',
  service_masterdata: 'Leistungs-Stammdaten',
};
const suggestionActions = Object.keys(suggestionActionLabels) as ChecklistItemActionType[];
const suggestionContexts = Object.keys(contextLabels) as ChecklistUsageContext[];
const defaultVisibilityGroups = ['admin', 'office', 'work_preparation', 'master'];

function newUuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function emptyTemplate(now: string): ChecklistTemplate {
  return {
    id: newUuid(),
    name: 'Neue Checkliste',
    description: null,
    templateType: 'general',
    status: 'active',
    visibilityGroupKeys: defaultVisibilityGroups,
    verificationRequired: false,
    autoApplyRules: {},
    createdBy: null,
    updatedBy: null,
    createdAt: now,
    updatedAt: now,
  };
}

function groupLabel(keys: string[]): string {
  if (keys.length === 0) return 'alle Gruppen';
  return keys.join(', ');
}

export default function ChecklistTemplatesPage() {
  const { repository, dispatch } = useAppStore();
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [groups, setGroups] = useState<ChecklistTemplateGroup[]>([]);
  const [items, setItems] = useState<ChecklistTemplateItem[]>([]);
  const [itemActions, setItemActions] = useState<ChecklistItemAction[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [ruleDrafts, setRuleDrafts] = useState<Record<string, Partial<ChecklistItemAction>>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ChecklistTemplate | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedName, setLastSavedName] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadData() {
      try {
        const [nextTemplates, nextGroups, nextItems, nextActions, nextServices, nextMaterials] = await Promise.all([
          repository.list<ChecklistTemplate>('checklistTemplates'),
          repository.list<ChecklistTemplateGroup>('checklistTemplateGroups'),
          repository.list<ChecklistTemplateItem>('checklistTemplateItems'),
          repository.list<ChecklistItemAction>('checklistItemActions'),
          repository.list<Service>('services'),
          repository.list<Material>('materials'),
        ]);
        if (!active) return;
        setTemplates(nextTemplates);
        setGroups(nextGroups);
        setItems(nextItems);
        setItemActions(nextActions);
        setServices(nextServices);
        setMaterials(nextMaterials);
        dispatch({ type: 'SET_ENTITIES', entity: 'checklistTemplates', data: nextTemplates });
        dispatch({ type: 'SET_ENTITIES', entity: 'checklistTemplateGroups', data: nextGroups });
        dispatch({ type: 'SET_ENTITIES', entity: 'checklistTemplateItems', data: nextItems });
        dispatch({ type: 'SET_ENTITIES', entity: 'checklistItemActions', data: nextActions });
        const firstActive = nextTemplates.find((template) => template.status === 'active') ?? nextTemplates[0] ?? null;
        if (firstActive) {
          setSelectedId(firstActive.id);
          setDraft(firstActive);
        }
      } finally {
        if (active) setIsLoading(false);
      }
    }

    loadData();
    return () => {
      active = false;
    };
  }, [repository, dispatch]);

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedId) ?? null,
    [templates, selectedId],
  );
  const selectedGroups = useMemo(
    () => groups.filter((group) => group.templateId === selectedId).sort((left, right) => left.sortOrder - right.sortOrder),
    [groups, selectedId],
  );
  const selectedItems = useMemo(
    () => items.filter((item) => item.templateId === selectedId).sort((left, right) => left.sortOrder - right.sortOrder),
    [items, selectedId],
  );

  const selectTemplate = (template: ChecklistTemplate) => {
    setSelectedId(template.id);
    setDraft(template);
    setLastSavedName(null);
  };

  const startNewTemplate = () => {
    const template = emptyTemplate(new Date().toISOString());
    setSelectedId(template.id);
    setDraft(template);
    setLastSavedName(null);
  };

  const saveDraft = async () => {
    if (!draft || !draft.name.trim()) return;
    setIsSaving(true);
    const now = new Date().toISOString();
    const templateToSave: ChecklistTemplate = {
      ...draft,
      name: draft.name.trim(),
      description: draft.description?.trim() || null,
      updatedAt: now,
    };

    const saved = await repository.upsert<ChecklistTemplate>('checklistTemplates', templateToSave);
    const nextTemplates = templates.some((template) => template.id === saved.id)
      ? templates.map((template) => (template.id === saved.id ? saved : template))
      : [saved, ...templates];
    setTemplates(nextTemplates);
    dispatch({ type: 'SET_ENTITIES', entity: 'checklistTemplates', data: nextTemplates });
    setDraft(saved);
    setSelectedId(saved.id);
    setLastSavedName(saved.name);
    setIsSaving(false);
  };

  const updateRuleDraft = (itemId: string, patch: Partial<ChecklistItemAction>) => {
    setRuleDrafts((current) => ({
      ...current,
      [itemId]: {
        conditionOperator: 'equals',
        conditionValue: 'yes',
        actionType: 'suggest_service',
        targetType: 'service',
        targetContext: 'calculation',
        targetId: null,
        payload: {},
        ...current[itemId],
        ...patch,
      },
    }));
  };

  const targetOptionsFor = (actionType: ChecklistItemActionType) => {
    if (actionType === 'suggest_material' || actionType === 'create_packing_item') {
      return materials.map((material) => ({ value: material.id, label: material.name }));
    }
    if (actionType === 'suggest_checklist') {
      return templates.filter((template) => template.status === 'active').map((template) => ({ value: template.id, label: template.name }));
    }
    if (actionType === 'suggest_service') {
      return services.filter((service) => service.active).map((service) => ({ value: service.id, label: service.name }));
    }
    return [];
  };

  const saveSuggestionRule = async (item: ChecklistTemplateItem) => {
    const now = new Date().toISOString();
    const draftRule = ruleDrafts[item.id] ?? {};
    const actionType = draftRule.actionType ?? 'suggest_service';
    const options = targetOptionsFor(actionType);
    const targetId = draftRule.targetId ?? options[0]?.value ?? null;
    const rule: ChecklistItemAction = {
      id: newUuid(),
      templateItemId: item.id,
      conditionOperator: draftRule.conditionOperator ?? 'equals',
      conditionValue: draftRule.conditionOperator === 'exists' ? null : (draftRule.conditionValue ?? 'yes'),
      actionType,
      targetType: actionType === 'suggest_material' || actionType === 'create_packing_item' ? 'material' : actionType === 'suggest_checklist' ? 'free' : 'service',
      targetId,
      targetContext: draftRule.targetContext ?? 'calculation',
      triggerMode: 'suggest',
      payload: { label: (draftRule.payload as { label?: string } | undefined)?.label ?? '' },
      active: true,
      sortOrder: itemActions.filter((action) => action.templateItemId === item.id).length * 10 + 10,
      createdAt: now,
      updatedAt: now,
    };
    const saved = await repository.upsert<ChecklistItemAction>('checklistItemActions', rule);
    const nextActions = [...itemActions, saved];
    setItemActions(nextActions);
    dispatch({ type: 'SET_ENTITIES', entity: 'checklistItemActions', data: nextActions });
    setRuleDrafts((current) => ({ ...current, [item.id]: {} }));
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-gray-900">Checklisten</h1>
        <p className="mt-2 text-sm text-gray-600">Laden...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-blue-600">Stammdaten</p>
          <h1 className="text-2xl font-bold text-gray-900">Checklisten</h1>
          <p className="mt-1 text-sm text-gray-600">
            Vorlagen für Werkstattkarten, Auftragsvorbereitung und Rüstlisten. Konkrete Läufe werden später als Snapshot daraus erzeugt.
          </p>
        </div>
        <button
          type="button"
          onClick={startNewTemplate}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          <Plus size={16} />
          Vorlage anlegen
        </button>
      </div>

      {lastSavedName && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
          ✓ Vorlage „{lastSavedName}“ gespeichert.
        </div>
      )}

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-800"><ClipboardList size={18} /> Vorlagen</div>
          <p className="mt-2 text-2xl font-bold text-gray-900">{templates.length}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-800"><CheckCircle2 size={18} /> Aktiv</div>
          <p className="mt-2 text-2xl font-bold text-gray-900">{templates.filter((template) => template.status === 'active').length}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-800"><Archive size={18} /> Archiviert</div>
          <p className="mt-2 text-2xl font-bold text-gray-900">{templates.filter((template) => template.status === 'archived').length}</p>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(280px,420px)_1fr]">
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-5 py-4">
            <h2 className="font-semibold text-gray-900">Vorlagenübersicht</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {templates.length === 0 ? (
              <p className="px-5 py-6 text-sm text-gray-500">Noch keine Checklisten-Vorlagen angelegt.</p>
            ) : (
              templates.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => selectTemplate(template)}
                  className={`w-full px-5 py-4 text-left hover:bg-gray-50 ${template.id === selectedId ? 'bg-blue-50' : ''}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-gray-900">{template.name}</p>
                      <p className="mt-1 text-xs text-gray-500">{templateTypeLabels[template.templateType]}</p>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-xs font-medium ${template.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                      {template.status === 'active' ? 'aktiv' : 'archiviert'}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-5 py-4">
            <h2 className="font-semibold text-gray-900">Vorlage bearbeiten</h2>
          </div>
          {!draft ? (
            <p className="px-5 py-6 text-sm text-gray-500">Vorlage auswählen oder neu anlegen.</p>
          ) : (
            <div className="space-y-5 p-5">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-1 text-sm font-medium text-gray-700">
                  Name
                  <input
                    value={draft.name}
                    onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </label>
                <label className="space-y-1 text-sm font-medium text-gray-700">
                  Typ
                  <select
                    value={draft.templateType}
                    onChange={(event) => setDraft({ ...draft, templateType: event.target.value as ChecklistTemplateType })}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  >
                    {templateTypes.map((type) => (
                      <option key={type} value={type}>{templateTypeLabels[type]}</option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1 text-sm font-medium text-gray-700">
                  Status
                  <select
                    value={draft.status}
                    onChange={(event) => setDraft({ ...draft, status: event.target.value as ChecklistTemplate['status'] })}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="active">aktiv</option>
                    <option value="archived">archiviert</option>
                  </select>
                </label>
                <label className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700">
                  <input
                    type="checkbox"
                    checked={draft.verificationRequired}
                    onChange={(event) => setDraft({ ...draft, verificationRequired: event.target.checked })}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600"
                  />
                  Freigabe/Prüfung erforderlich
                </label>
              </div>

              <label className="block space-y-1 text-sm font-medium text-gray-700">
                Beschreibung
                <textarea
                  value={draft.description ?? ''}
                  onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border border-gray-200 p-4">
                  <h3 className="text-sm font-semibold text-gray-900">Sichtbarkeit</h3>
                  <p className="mt-1 text-sm text-gray-600">{groupLabel(draft.visibilityGroupKeys)}</p>
                  <p className="mt-2 text-xs text-gray-500">Büro-only und Meister-/Arbeitsvorbereitungs-Listen werden über Gruppen gesteuert.</p>
                </div>
                <div className="rounded-lg border border-gray-200 p-4">
                  <h3 className="text-sm font-semibold text-gray-900">Konkrete Läufe</h3>
                  <p className="mt-1 text-sm text-gray-600">Werden als Snapshot der Vorlage erzeugt; spätere Vorlagenänderungen überschreiben alte Läufe nicht.</p>
                </div>
              </div>

              {selectedTemplate && selectedTemplate.id === draft.id && (
                <div className="rounded-lg border border-gray-200">
                  <div className="border-b border-gray-100 px-4 py-3">
                    <h3 className="text-sm font-semibold text-gray-900">Gruppen und Punkte</h3>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {selectedGroups.length === 0 ? (
                      <p className="px-4 py-4 text-sm text-gray-500">Noch keine Gruppen in dieser Vorlage.</p>
                    ) : (
                      selectedGroups.map((group) => {
                        const groupItems = selectedItems.filter((item) => item.groupId === group.id);
                        return (
                          <div key={group.id} className="space-y-3 px-4 py-3">
                            <div>
                              <p className="font-medium text-gray-900">{group.title}</p>
                              <p className="mt-1 text-xs text-gray-500">{groupItems.length} Punkte · {groupLabel(group.visibilityGroupKeys)}</p>
                            </div>
                            {groupItems.length > 0 && (
                              <div className="space-y-3">
                                {groupItems.map((item) => {
                                  const draftRule = ruleDrafts[item.id] ?? {};
                                  const actionType = draftRule.actionType ?? 'suggest_service';
                                  const targetOptions = targetOptionsFor(actionType);
                                  const existingRules = itemActions
                                    .filter((action) => action.templateItemId === item.id && action.triggerMode === 'suggest' && action.active)
                                    .sort((left, right) => left.sortOrder - right.sortOrder);
                                  return (
                                    <div key={item.id} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                                      <div className="flex flex-wrap items-start justify-between gap-2">
                                        <div>
                                          <p className="text-sm font-semibold text-gray-900">{item.title}</p>
                                          <p className="text-xs text-gray-500">Folgevorschläge, keine automatische Erzeugung.</p>
                                        </div>
                                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700">
                                          <Sparkles size={12} /> {existingRules.length} Vorschläge
                                        </span>
                                      </div>

                                      {existingRules.length > 0 && (
                                        <ul className="mt-2 space-y-1 text-xs text-gray-700">
                                          {existingRules.map((rule) => (
                                            <li key={rule.id} className="rounded border border-blue-100 bg-white px-2 py-1">
                                              Wenn {conditionLabels[rule.conditionOperator]} {rule.conditionValue ?? 'vorhanden'} → {suggestionActionLabels[rule.actionType]} ({contextLabels[rule.targetContext]})
                                            </li>
                                          ))}
                                        </ul>
                                      )}

                                      <div className="mt-3 grid gap-2 lg:grid-cols-[1fr_0.8fr_1.2fr_1fr_auto]">
                                        <select
                                          value={draftRule.conditionOperator ?? 'equals'}
                                          onChange={(event) => updateRuleDraft(item.id, { conditionOperator: event.target.value as ChecklistItemActionConditionOperator })}
                                          className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs"
                                        >
                                          {Object.entries(conditionLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                                        </select>
                                        <input
                                          value={draftRule.conditionValue ?? 'Ja'}
                                          onChange={(event) => updateRuleDraft(item.id, { conditionValue: event.target.value })}
                                          placeholder="Ja"
                                          className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs"
                                        />
                                        <select
                                          value={actionType}
                                          onChange={(event) => updateRuleDraft(item.id, { actionType: event.target.value as ChecklistItemActionType, targetId: null })}
                                          className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs"
                                        >
                                          {suggestionActions.map((action) => <option key={action} value={action}>{suggestionActionLabels[action]}</option>)}
                                        </select>
                                        <select
                                          value={draftRule.targetId ?? targetOptions[0]?.value ?? ''}
                                          onChange={(event) => updateRuleDraft(item.id, { targetId: event.target.value || null })}
                                          className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs"
                                        >
                                          <option value="">Freitext/noch offen</option>
                                          {targetOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                                        </select>
                                        <button
                                          type="button"
                                          onClick={() => saveSuggestionRule(item)}
                                          className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                                        >
                                          Vorschlag speichern
                                        </button>
                                      </div>
                                      <select
                                        value={draftRule.targetContext ?? 'calculation'}
                                        onChange={(event) => updateRuleDraft(item.id, { targetContext: event.target.value as ChecklistUsageContext })}
                                        className="mt-2 rounded-lg border border-gray-300 px-2 py-1.5 text-xs"
                                      >
                                        {suggestionContexts.map((context) => <option key={context} value={context}>{contextLabels[context]}</option>)}
                                      </select>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={saveDraft}
                  disabled={isSaving || !draft.name.trim()}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                >
                  <Save size={16} />
                  {isSaving ? 'Speichern...' : 'Speichern'}
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
