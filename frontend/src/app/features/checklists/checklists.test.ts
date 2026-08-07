import { describe, expect, it } from 'vitest';
import {
  applyChecklistRunItemUpdate,
  canCreateChecklistRunFromTemplate,
  createChecklistRunFromTemplate,
  resolveChecklistRunItems,
  getChecklistRunCompletion,
  getChecklistTemplatesForSource,
  getChecklistTemplatesForService,
  getChecklistTemplatesForServicePackage,
  resolveChecklistItemActions,
  resolveChecklistItemSuggestions,
} from './checklists';
import type {
  ChecklistTemplate,
  ChecklistTemplateGroup,
  ChecklistItemAction,
  ChecklistTemplateItem,
  ChecklistTemplateLink,
  Service,
  ServicePackage,
  ServicePackageItem,
} from '../../lib/types';

const now = '2026-06-03T20:00:00.000Z';
let idCounter = 0;
const nextId = () => `id-${++idCounter}`;

function baseTemplate(overrides: Partial<ChecklistTemplate> = {}): ChecklistTemplate {
  return {
    id: 'tpl-trafo',
    name: 'Trafo-Werkstattkarte',
    description: 'Standard Trafo Checkliste',
    templateType: 'trafo_workshop_card',
    status: 'active',
    visibilityGroupKeys: ['admin', 'office', 'work_preparation', 'master'],
    verificationRequired: false,
    autoApplyRules: { serviceIds: ['service-1'] },
    createdBy: 'admin-1',
    updatedBy: 'admin-1',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

const groups: ChecklistTemplateGroup[] = [
  {
    id: 'group-pruefung',
    templateId: 'tpl-trafo',
    title: 'Prüfung',
    sortOrder: 10,
    visibilityGroupKeys: ['work_preparation', 'master'],
    createdAt: now,
    updatedAt: now,
  },
];

const items: ChecklistTemplateItem[] = [
  {
    id: 'item-eingang',
    templateId: 'tpl-trafo',
    groupId: 'group-pruefung',
    title: 'Eingangsprüfung',
    description: 'Trafo Eingang prüfen',
    sortOrder: 10,
    required: true,
    quantity: null,
    unit: null,
    photoRequired: false,
    documentRequired: true,
    noteMode: 'optional',
    measurementMode: 'required',
    employeeCodeRequired: true,
    signatureRequired: true,
    timeRequired: true,
    materialEntryEnabled: false,
    responseType: 'multiple_choice',
    choiceOptions: ['Ja', 'Nein', 'Nicht zutreffend'],
    visibilityGroupKeys: ['work_preparation', 'master'],
    dependsOnItemIds: [],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'item-hv',
    templateId: 'tpl-trafo',
    groupId: 'group-pruefung',
    title: 'Hochspannungsprüfung',
    description: null,
    sortOrder: 20,
    required: true,
    quantity: null,
    unit: null,
    photoRequired: false,
    documentRequired: true,
    noteMode: 'optional',
    measurementMode: 'required',
    employeeCodeRequired: true,
    signatureRequired: true,
    timeRequired: true,
    materialEntryEnabled: false,
    responseType: 'check',
    choiceOptions: [],
    visibilityGroupKeys: ['master'],
    dependsOnItemIds: ['item-eingang'],
    createdAt: now,
    updatedAt: now,
  },
];

describe('checklist domain', () => {
  it('allows creating runs only from active templates', () => {
    expect(canCreateChecklistRunFromTemplate(baseTemplate())).toBe(true);
    expect(canCreateChecklistRunFromTemplate(baseTemplate({ status: 'archived' }))).toBe(false);
  });

  it('creates a concrete run as a template snapshot without price fields', () => {
    idCounter = 0;
    const { run, runItems } = createChecklistRunFromTemplate({
      template: baseTemplate(),
      groups,
      items,
      links: [{ targetType: 'workshop_card', targetId: 'wk-1' }],
      now,
      idFactory: nextId,
    });

    expect(run.templateId).toBe('tpl-trafo');
    expect(run.title).toBe('Trafo-Werkstattkarte');
    expect(run.runType).toBe('trafo_workshop_card');
    expect(run.status).toBe('open');
    expect(run.qrCodeToken).toMatch(/^checklist-/);
    expect(run.templateSnapshot).toEqual({ template: baseTemplate(), groups, items });
    expect(runItems).toHaveLength(2);
    expect(runItems[0]).toMatchObject({
      runId: run.id,
      templateItemId: 'item-eingang',
      groupTitleSnapshot: 'Prüfung',
      title: 'Eingangsprüfung',
      status: 'open',
      required: true,
      responseType: 'multiple_choice',
      choiceOptions: ['Ja', 'Nein', 'Nicht zutreffend'],
      selectedChoice: null,
    });
    const serialized = JSON.stringify({ run, runItems });
    expect(serialized).not.toMatch(/price|amount|cost|margin/i);
  });

  it('blocks dependent items until all prerequisites are done or not applicable', () => {
    const { runItems } = createChecklistRunFromTemplate({
      template: baseTemplate(),
      groups,
      items,
      links: [],
      now,
      idFactory: nextId,
    });

    const initiallyResolved = resolveChecklistRunItems(runItems);
    expect(initiallyResolved.find((item) => item.templateItemId === 'item-hv')).toMatchObject({
      status: 'blocked',
      blockedReason: 'Gesperrt: Eingangsprüfung fehlt',
    });

    const withPrerequisiteDone = initiallyResolved.map((item) =>
      item.templateItemId === 'item-eingang' ? { ...item, status: 'done' as const } : item,
    );
    expect(resolveChecklistRunItems(withPrerequisiteDone).find((item) => item.templateItemId === 'item-hv')).toMatchObject({
      status: 'open',
      blockedReason: null,
    });
  });

  it('requires every required item to be done or not applicable before finish', () => {
    const { runItems } = createChecklistRunFromTemplate({
      template: baseTemplate(),
      groups,
      items,
      links: [],
      now,
      idFactory: nextId,
    });

    expect(getChecklistRunCompletion(runItems)).toEqual({ canFinish: false, openRequiredCount: 2 });
    const finished = runItems.map((item) =>
      item.templateItemId === 'item-eingang'
        ? { ...item, status: 'done' as const }
        : { ...item, status: 'not_applicable' as const },
    );
    expect(getChecklistRunCompletion(finished)).toEqual({ canFinish: true, openRequiredCount: 0 });
  });

  it('updates a concrete run item with not-applicable status, note and selected choice', () => {
    const { runItems } = createChecklistRunFromTemplate({
      template: baseTemplate(),
      groups,
      items,
      links: [],
      now,
      idFactory: nextId,
    });

    const updated = applyChecklistRunItemUpdate(runItems[0], {
      status: 'not_applicable',
      note: 'Beim Kunden nicht benötigt, geprüft durch Vale.',
      selectedChoice: 'Nicht zutreffend',
      now: '2026-06-03T21:00:00.000Z',
      userId: 'vale',
    });

    expect(updated).toMatchObject({
      status: 'not_applicable',
      note: 'Beim Kunden nicht benötigt, geprüft durch Vale.',
      selectedChoice: 'Nicht zutreffend',
      completedAt: '2026-06-03T21:00:00.000Z',
      completedBy: 'vale',
    });
  });

  it('keeps inquiry follow-up items open when the point needs clarification', () => {
    const { runItems } = createChecklistRunFromTemplate({
      template: baseTemplate(),
      groups,
      items,
      links: [],
      now,
      idFactory: nextId,
    });

    const updated = applyChecklistRunItemUpdate(runItems[0], {
      status: 'needs_clarification',
      note: 'Kunde muss Typenschildfoto nachreichen.',
      now: '2026-06-03T21:05:00.000Z',
      userId: 'vale',
    });

    expect(updated).toMatchObject({
      status: 'needs_clarification',
      note: 'Kunde muss Typenschildfoto nachreichen.',
      completedAt: null,
      completedBy: null,
    });
    expect(getChecklistRunCompletion([updated])).toEqual({ canFinish: false, openRequiredCount: 1 });
  });

  it('selects active checklist templates linked directly to a Leistung', () => {
    const service = {
      id: 'service-1',
      checklistTemplateIds: ['tpl-direct', 'tpl-archived'],
    } as Service;
    const templates = [
      baseTemplate({ id: 'tpl-direct', name: 'Direkte Leistungs-Checkliste' }),
      baseTemplate({ id: 'tpl-rule', name: 'Regel Leistungs-Checkliste', autoApplyRules: { serviceIds: ['service-1'] } }),
      baseTemplate({ id: 'tpl-other', name: 'Andere Leistung', autoApplyRules: { serviceIds: ['service-2'] } }),
      baseTemplate({ id: 'tpl-archived', name: 'Alt', status: 'archived' }),
    ];

    expect(getChecklistTemplatesForService(service, templates).map((template) => template.id)).toEqual([
      'tpl-direct',
      'tpl-rule',
    ]);
  });

  it('combines package-level and contained service checklists without duplicates', () => {
    const pkg = {
      id: 'package-1',
      checklistTemplateIds: ['tpl-package', 'tpl-shared'],
    } as ServicePackage;
    const packageItems = [
      { type: 'service', serviceId: 'service-1' },
      { type: 'material', materialId: 'material-1' },
    ] as ServicePackageItem[];
    const services = [
      { id: 'service-1', checklistTemplateIds: ['tpl-service', 'tpl-shared'] },
    ] as Service[];
    const templates = [
      baseTemplate({ id: 'tpl-package', name: 'Paket-Freigabe' }),
      baseTemplate({ id: 'tpl-service', name: 'Leistungspunkt' }),
      baseTemplate({ id: 'tpl-shared', name: 'Gemeinsam' }),
      baseTemplate({ id: 'tpl-archived', name: 'Archiviert', status: 'archived', autoApplyRules: { servicePackageIds: ['package-1'] } }),
    ];

    expect(getChecklistTemplatesForServicePackage(pkg, packageItems, services, templates).map((template) => template.id)).toEqual([
      'tpl-package',
      'tpl-shared',
      'tpl-service',
    ]);
  });

  it('selects active checklist templates through external rules for a Leistung and context', () => {
    const templates = [
      baseTemplate({ id: 'tpl-direct', name: 'Direkte Regel' }),
      baseTemplate({ id: 'tpl-other', name: 'Andere Leistung' }),
      baseTemplate({ id: 'tpl-archived', name: 'Archiviert', status: 'archived' }),
    ];
    const links = [
      { id: 'link-1', templateId: 'tpl-direct', sourceType: 'service', sourceId: 'service-1', contexts: ['calculation', 'packing_list'], triggerMode: 'suggest', active: true, sortOrder: 10, createdAt: now, updatedAt: now },
      { id: 'link-2', templateId: 'tpl-other', sourceType: 'service', sourceId: 'service-2', contexts: ['calculation'], triggerMode: 'suggest', active: true, sortOrder: 20, createdAt: now, updatedAt: now },
      { id: 'link-3', templateId: 'tpl-archived', sourceType: 'service', sourceId: 'service-1', contexts: ['calculation'], triggerMode: 'suggest', active: true, sortOrder: 30, createdAt: now, updatedAt: now },
    ] as ChecklistTemplateLink[];

    expect(getChecklistTemplatesForSource('service', 'service-1', templates, links, 'calculation').map((template) => template.id)).toEqual([
      'tpl-direct',
    ]);
    expect(getChecklistTemplatesForSource('service', 'service-1', templates, links, 'billing')).toEqual([]);
  });

  it('resolves yes/no answers into service, material and packing-list follow-up actions', () => {
    const actions = [
      { id: 'action-service', templateItemId: 'item-vorruecken', conditionOperator: 'equals', conditionValue: 'yes', actionType: 'suggest_service', targetType: 'service', targetId: 'service-vorruecken', targetContext: 'calculation', triggerMode: 'suggest', payload: {}, active: true, sortOrder: 10, createdAt: now, updatedAt: now },
      { id: 'action-material', templateItemId: 'item-vorruecken', conditionOperator: 'equals', conditionValue: 'yes', actionType: 'suggest_material', targetType: 'material', targetId: 'material-dichtung', targetContext: 'calculation', triggerMode: 'suggest', payload: {}, active: true, sortOrder: 20, createdAt: now, updatedAt: now },
      { id: 'action-pack', templateItemId: 'item-vorruecken', conditionOperator: 'equals', conditionValue: 'yes', actionType: 'create_packing_item', targetType: 'material', targetId: 'material-hydraulikstempel', targetContext: 'packing_list', triggerMode: 'auto_create', payload: { label: 'Hydraulikstempel einpacken' }, active: true, sortOrder: 30, createdAt: now, updatedAt: now },
    ] as ChecklistItemAction[];

    expect(resolveChecklistItemActions('item-vorruecken', 'Ja', actions, 'calculation').map((entry) => entry.action.id)).toEqual([
      'action-service',
      'action-material',
    ]);
    expect(resolveChecklistItemActions('item-vorruecken', 'yes', actions, 'packing_list').map((entry) => entry.action.id)).toEqual([
      'action-pack',
    ]);
    expect(resolveChecklistItemActions('item-vorruecken', 'Nein', actions, 'calculation')).toEqual([]);
  });

  it('shows only suggestion-mode checklist actions in the operator UI', () => {
    const actions = [
      { id: 'action-suggest', templateItemId: 'item-oil', conditionOperator: 'equals', conditionValue: 'yes', actionType: 'suggest_material', targetType: 'material', targetId: 'material-oil', targetContext: 'packing_list', triggerMode: 'suggest', payload: {}, active: true, sortOrder: 10, createdAt: now, updatedAt: now },
      { id: 'action-auto', templateItemId: 'item-oil', conditionOperator: 'equals', conditionValue: 'yes', actionType: 'create_packing_item', targetType: 'material', targetId: 'material-pump', targetContext: 'packing_list', triggerMode: 'auto_create', payload: {}, active: true, sortOrder: 20, createdAt: now, updatedAt: now },
    ] as ChecklistItemAction[];

    expect(resolveChecklistItemSuggestions('item-oil', 'Ja', actions, 'packing_list').map((entry) => entry.action.id)).toEqual([
      'action-suggest',
    ]);
  });

});
