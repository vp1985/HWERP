import type {
  ChecklistItemAction,
  ChecklistRun,
  ChecklistRunItem,
  ChecklistRunLink,
  ChecklistTemplate,
  ChecklistTemplateGroup,
  ChecklistTemplateItem,
  ChecklistTemplateLink,
  ChecklistUsageContext,
  ResolvedChecklistItemAction,
  Service,
  ServicePackage,
  ServicePackageItem,
} from '../../lib/types';

export interface CreateChecklistRunInput {
  template: ChecklistTemplate;
  groups: ChecklistTemplateGroup[];
  items: ChecklistTemplateItem[];
  links: Array<Pick<ChecklistRunLink, 'targetType' | 'targetId'>>;
  now: string;
  idFactory: () => string;
}

export interface CreateChecklistRunResult {
  run: ChecklistRun;
  links: ChecklistRunLink[];
  runItems: ChecklistRunItem[];
}

export function canCreateChecklistRunFromTemplate(template: ChecklistTemplate): boolean {
  return template.status === 'active';
}

function makeQrCodeToken(runId: string, title: string): string {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'checkliste';
  return `checklist-${slug}-${runId}`;
}

export function createChecklistRunFromTemplate(input: CreateChecklistRunInput): CreateChecklistRunResult {
  const { template, groups, items, links, now, idFactory } = input;
  if (!canCreateChecklistRunFromTemplate(template)) {
    throw new Error('Archivierte Checklisten-Vorlagen können nicht neu verwendet werden.');
  }

  const runId = idFactory();
  const groupTitleById = new Map(groups.map((group) => [group.id, group.title]));
  const run: ChecklistRun = {
    id: runId,
    templateId: template.id,
    templateSnapshot: { template, groups, items },
    title: template.name,
    runType: template.templateType,
    status: 'open',
    verificationRequired: template.verificationRequired,
    verifiedBy: null,
    verifiedAt: null,
    qrCodeToken: makeQrCodeToken(runId, template.name),
    createdBy: null,
    createdAt: now,
    updatedAt: now,
  };

  const runLinks: ChecklistRunLink[] = links.map((link) => ({
    id: idFactory(),
    runId,
    targetType: link.targetType,
    targetId: link.targetId,
    createdAt: now,
    updatedAt: now,
  }));

  const runItems: ChecklistRunItem[] = items
    .slice()
    .sort((left, right) => left.sortOrder - right.sortOrder || left.title.localeCompare(right.title))
    .map((item) => ({
      id: idFactory(),
      runId,
      templateItemId: item.id,
      groupTitleSnapshot: item.groupId ? groupTitleById.get(item.groupId) ?? null : null,
      title: item.title,
      description: item.description,
      sortOrder: item.sortOrder,
      required: item.required,
      status: 'open',
      quantity: item.quantity,
      unit: item.unit,
      note: null,
      measurementValue: null,
      employeeCode: null,
      signatureName: null,
      startedAt: null,
      finishedAt: null,
      completedAt: null,
      completedBy: null,
      blockedReason: null,
      responseType: item.responseType ?? 'check',
      choiceOptions: item.choiceOptions ?? [],
      selectedChoice: null,
      dependsOnTemplateItemIds: item.dependsOnItemIds,
      createdAt: now,
      updatedAt: now,
    }));

  return { run, links: runLinks, runItems: resolveChecklistRunItems(runItems) };
}

function prerequisiteIsSatisfied(item: ChecklistRunItem | undefined): boolean {
  return item?.status === 'done' || item?.status === 'not_applicable';
}

export function resolveChecklistRunItems(items: ChecklistRunItem[]): ChecklistRunItem[] {
  const byTemplateItemId = new Map(items.map((item) => [item.templateItemId, item]));
  return items.map((item) => {
    const missingPrerequisite = item.dependsOnTemplateItemIds
      .map((dependencyId) => byTemplateItemId.get(dependencyId))
      .find((dependency) => !prerequisiteIsSatisfied(dependency));

    if (missingPrerequisite) {
      return {
        ...item,
        status: 'blocked',
        blockedReason: `Gesperrt: ${missingPrerequisite.title} fehlt`,
      };
    }

    return {
      ...item,
      status: item.status === 'blocked' ? 'open' : item.status,
      blockedReason: null,
    };
  });
}

export function getChecklistRunCompletion(items: ChecklistRunItem[]): { canFinish: boolean; openRequiredCount: number } {
  const openRequiredCount = items.filter((item) =>
    item.required && item.status !== 'done' && item.status !== 'not_applicable',
  ).length;
  return { canFinish: openRequiredCount === 0, openRequiredCount };
}

export interface ChecklistRunItemUpdateInput {
  status: ChecklistRunItem['status'];
  note?: string | null;
  selectedChoice?: string | null;
  measurementValue?: string | null;
  now: string;
  userId: string | null;
}

export function applyChecklistRunItemUpdate(item: ChecklistRunItem, input: ChecklistRunItemUpdateInput): ChecklistRunItem {
  const isCompletedStatus = input.status === 'done' || input.status === 'not_applicable';
  return {
    ...item,
    status: input.status,
    note: input.note ?? item.note,
    selectedChoice: input.selectedChoice ?? item.selectedChoice ?? null,
    measurementValue: input.measurementValue ?? item.measurementValue,
    completedAt: isCompletedStatus ? input.now : null,
    completedBy: isCompletedStatus ? input.userId : null,
    updatedAt: input.now,
  };
}

function arrayRule(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
}

function templateAppliesToId(template: ChecklistTemplate, ruleKey: string, id: string): boolean {
  return arrayRule(template.autoApplyRules?.[ruleKey]).includes(id);
}

function pushUniqueTemplate(result: ChecklistTemplate[], seen: Set<string>, template: ChecklistTemplate): void {
  if (template.status !== 'active' || seen.has(template.id)) return;
  seen.add(template.id);
  result.push(template);
}

function linkMatchesContext(link: Pick<ChecklistTemplateLink, 'contexts'>, context?: ChecklistUsageContext): boolean {
  return !context || link.contexts.length === 0 || link.contexts.includes(context);
}

export function getChecklistTemplatesForSource(
  sourceType: ChecklistTemplateLink['sourceType'],
  sourceId: string,
  templates: ChecklistTemplate[],
  links: ChecklistTemplateLink[],
  context?: ChecklistUsageContext,
): ChecklistTemplate[] {
  const result: ChecklistTemplate[] = [];
  const seen = new Set<string>();
  const templateById = new Map(templates.map((template) => [template.id, template]));

  links
    .filter((link) =>
      link.active &&
      link.sourceType === sourceType &&
      link.sourceId === sourceId &&
      linkMatchesContext(link, context)
    )
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .forEach((link) => {
      const template = templateById.get(link.templateId);
      if (template) pushUniqueTemplate(result, seen, template);
    });

  return result;
}

export function getChecklistTemplatesForService(
  service: Pick<Service, 'id' | 'checklistTemplateIds'>,
  templates: ChecklistTemplate[],
  links: ChecklistTemplateLink[] = [],
  context?: ChecklistUsageContext,
): ChecklistTemplate[] {
  const result: ChecklistTemplate[] = [];
  const seen = new Set<string>();
  const directIds = new Set(service.checklistTemplateIds ?? []);

  for (const template of templates) {
    if (directIds.has(template.id)) {
      pushUniqueTemplate(result, seen, template);
    }
  }

  for (const template of templates) {
    if (templateAppliesToId(template, 'serviceIds', service.id)) {
      pushUniqueTemplate(result, seen, template);
    }
  }

  for (const template of getChecklistTemplatesForSource('service', service.id, templates, links, context)) {
    pushUniqueTemplate(result, seen, template);
  }

  return result;
}

export function getChecklistTemplatesForServicePackage(
  pkg: Pick<ServicePackage, 'id' | 'checklistTemplateIds'>,
  packageItems: Pick<ServicePackageItem, 'type' | 'serviceId'>[],
  services: Array<Pick<Service, 'id' | 'checklistTemplateIds'>>,
  templates: ChecklistTemplate[],
  links: ChecklistTemplateLink[] = [],
  context?: ChecklistUsageContext,
): ChecklistTemplate[] {
  const result: ChecklistTemplate[] = [];
  const seen = new Set<string>();
  const directIds = new Set(pkg.checklistTemplateIds ?? []);

  for (const template of templates) {
    if (directIds.has(template.id) || templateAppliesToId(template, 'servicePackageIds', pkg.id)) {
      pushUniqueTemplate(result, seen, template);
    }
  }

  for (const template of getChecklistTemplatesForSource('service_package', pkg.id, templates, links, context)) {
    pushUniqueTemplate(result, seen, template);
  }

  const serviceIds = new Set(
    packageItems
      .filter((item) => item.type === 'service' && item.serviceId)
      .map((item) => item.serviceId as string),
  );
  for (const service of services.filter((entry) => serviceIds.has(entry.id))) {
    for (const template of getChecklistTemplatesForService(service, templates, links, context)) {
      pushUniqueTemplate(result, seen, template);
    }
  }

  return result;
}

function normalizeChecklistAnswer(value: unknown): string {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (['ja', 'yes', 'true', 'done', 'checked'].includes(normalized)) return 'yes';
  if (['nein', 'no', 'false'].includes(normalized)) return 'no';
  return normalized;
}

function conditionMatches(action: ChecklistItemAction, value: unknown): boolean {
  const normalizedValue = normalizeChecklistAnswer(value);
  const normalizedCondition = normalizeChecklistAnswer(action.conditionValue);

  switch (action.conditionOperator) {
    case 'exists':
      return normalizedValue.length > 0;
    case 'not_equals':
      return normalizedValue !== normalizedCondition;
    case 'contains':
      return normalizedValue.includes(normalizedCondition);
    case 'equals':
    default:
      return normalizedValue === normalizedCondition;
  }
}

export function resolveChecklistItemActions(
  templateItemId: string,
  answerValue: unknown,
  actions: ChecklistItemAction[],
  context?: ChecklistUsageContext,
): ResolvedChecklistItemAction[] {
  return actions
    .filter((action) =>
      action.active &&
      action.templateItemId === templateItemId &&
      (!context || action.targetContext === context) &&
      conditionMatches(action, answerValue)
    )
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((action) => ({
      action,
      reason: `${action.actionType}:${action.targetContext}`,
    }));
}

export function resolveChecklistItemSuggestions(
  templateItemId: string,
  answerValue: unknown,
  actions: ChecklistItemAction[],
  context?: ChecklistUsageContext,
): ResolvedChecklistItemAction[] {
  return resolveChecklistItemActions(templateItemId, answerValue, actions, context)
    .filter((entry) => entry.action.triggerMode === 'suggest');
}
