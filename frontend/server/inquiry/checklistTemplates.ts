import type {
  Inquiry,
  InquiryAttachment,
  InquiryChecklistEvidenceSource,
  InquiryChecklistItem,
  InquiryChecklistRunItemStatus,
  InquiryChecklistSelectedBy,
  InquiryChecklistTemplate,
  InquiryMasterDataCategory,
} from '../../src/app/lib/types';

export interface ChecklistEvidenceInput {
  attachments?: InquiryAttachment[];
  masterDataTexts?: string[];
  manualTexts?: string[];
}

export interface ChecklistSuggestedItem {
  templateItemId: string;
  label: string;
  required: boolean;
  status: InquiryChecklistRunItemStatus;
  evidenceText: string | null;
  evidenceSource: InquiryChecklistEvidenceSource | null;
  sortOrder: number;
}

export interface ChecklistRunSuggestion {
  templateId: string;
  selectedBy: InquiryChecklistSelectedBy;
  items: ChecklistSuggestedItem[];
  followUpQuestions: string[];
  blocksOfficeHandover: boolean;
}

export function selectChecklistTemplate(
  inquiry: Inquiry,
  templates: InquiryChecklistTemplate[],
  categories: InquiryMasterDataCategory[] = [],
): InquiryChecklistTemplate | null {
  const activeCategoryIds = new Set(categories.filter((category) => category.active).map((category) => category.id));
  const categoryOrder = new Map(categories.map((category) => [category.id, category.sortOrder]));
  const selectedCategoryId = inquiry.categoryId ?? null;
  const haystack = buildInquiryHaystack(inquiry);

  const ranked = templates
    .filter((template) => template.active)
    .filter((template) => template.appliesToSources.includes(inquiry.source))
    .filter((template) => categories.length === 0 || activeCategoryIds.has(template.categoryId))
    .filter((template) => !selectedCategoryId || template.categoryId === selectedCategoryId)
    .map((template) => {
      const keywordMatches = template.triggerKeywords.filter((keyword) => includesNormalized(haystack, keyword)).length;
      return {
        template,
        score: keywordMatches * 10 + (keywordMatches > 0 ? 1 : 0),
        categorySort: categoryOrder.get(template.categoryId) ?? Number.MAX_SAFE_INTEGER,
      };
    })
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      if (left.categorySort !== right.categorySort) {
        return left.categorySort - right.categorySort;
      }
      return left.template.name.localeCompare(right.template.name, 'de');
    });

  return ranked[0]?.template ?? null;
}

export function buildChecklistRunSuggestion(
  inquiry: Inquiry,
  template: InquiryChecklistTemplate,
  items: InquiryChecklistItem[],
  evidence: ChecklistEvidenceInput = {},
): ChecklistRunSuggestion {
  const relevantItems = items
    .filter((item) => item.templateId === template.id)
    .sort((left, right) => left.sortOrder - right.sortOrder || left.label.localeCompare(right.label, 'de'));

  const suggestedItems = relevantItems.map((item): ChecklistSuggestedItem => {
    const foundEvidence = item.aiCanComplete ? findEvidenceForItem(inquiry, item, evidence) : null;

    if (foundEvidence) {
      return {
        templateItemId: item.id,
        label: item.label,
        required: item.required,
        status: 'suggested_done',
        evidenceText: foundEvidence.text,
        evidenceSource: foundEvidence.source,
        sortOrder: item.sortOrder,
      };
    }

    if (item.required) {
      return {
        templateItemId: item.id,
        label: item.label,
        required: true,
        status: 'needs_clarification',
        evidenceText: item.evidenceHint ?? item.label,
        evidenceSource: 'ai_suggestion',
        sortOrder: item.sortOrder,
      };
    }

    return {
      templateItemId: item.id,
      label: item.label,
      required: false,
      status: 'open',
      evidenceText: null,
      evidenceSource: null,
      sortOrder: item.sortOrder,
    };
  });

  const followUpQuestions = relevantItems
    .filter((item) => item.required)
    .filter((item) => suggestedItems.some((suggestedItem) => suggestedItem.templateItemId === item.id && suggestedItem.status === 'needs_clarification'))
    .map((item) => buildFollowUpQuestion(item));

  return {
    templateId: template.id,
    selectedBy: 'ai',
    items: suggestedItems,
    followUpQuestions,
    blocksOfficeHandover: suggestedItems.some((item) => item.required && item.status === 'needs_clarification'),
  };
}

function findEvidenceForItem(
  inquiry: Inquiry,
  item: InquiryChecklistItem,
  evidence: ChecklistEvidenceInput,
): { text: string; source: InquiryChecklistEvidenceSource } | null {
  const hint = normalizeTerm(item.evidenceHint ?? item.label);
  if (!hint) {
    return null;
  }

  const attachment = evidence.attachments?.find((candidate) => includesNormalized(candidate.fileName, hint));
  if ((item.kind === 'document' || item.kind === 'photo') && attachment) {
    return { text: attachment.fileName, source: 'attachment' };
  }

  const inquiryText = buildInquiryHaystack(inquiry);
  if (includesNormalized(inquiryText, hint)) {
    return { text: item.evidenceHint ?? item.label, source: 'mail' };
  }

  if (attachment) {
    return { text: attachment.fileName, source: 'attachment' };
  }

  const masterDataText = evidence.masterDataTexts?.find((candidate) => includesNormalized(candidate, hint));
  if (masterDataText) {
    return { text: masterDataText, source: 'master_data' };
  }

  const manualText = evidence.manualTexts?.find((candidate) => includesNormalized(candidate, hint));
  if (manualText) {
    return { text: manualText, source: 'manual' };
  }

  return null;
}

function buildInquiryHaystack(inquiry: Inquiry): string {
  return [inquiry.title, inquiry.summary, inquiry.rawText].filter(Boolean).join('\n');
}

function includesNormalized(value: string | null | undefined, searchTerm: string | null | undefined): boolean {
  const normalizedValue = normalizeTerm(value);
  const normalizedSearchTerm = normalizeTerm(searchTerm);
  return Boolean(normalizedSearchTerm) && normalizedValue.includes(normalizedSearchTerm);
}

function normalizeTerm(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('de')
    .trim();
}

function buildFollowUpQuestion(item: InquiryChecklistItem): string {
  const topic = item.evidenceHint ?? item.label;
  const description = item.description?.trim();
  return description ? `Bitte ${topic} klären: ${description}` : `Bitte ${topic} klären.`;
}
