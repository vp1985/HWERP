import { describe, expect, it } from 'vitest';
import type {
  Inquiry,
  InquiryAttachment,
  InquiryChecklistItem,
  InquiryChecklistTemplate,
  InquiryMasterDataCategory,
} from '../../src/app/lib/types';
import {
  buildChecklistRunSuggestion,
  selectChecklistTemplate,
} from './checklistTemplates';

const baseInquiry: Inquiry = {
  id: 'inq-1',
  createdAt: '2026-05-31T12:00:00.000Z',
  updatedAt: '2026-05-31T12:00:00.000Z',
  title: 'Anfrage Wartung Trafo HT-42',
  status: 'triage',
  priority: 'normal',
  source: 'email',
  sourceMessageId: '<msg-1@example.com>',
  senderName: 'Max Mustermann',
  senderEmail: 'max@example.com',
  senderPhone: null,
  customerId: null,
  locationId: null,
  assetId: null,
  relatedCalculationId: null,
  assigneeUserId: null,
  assignedByUserId: null,
  assignedAt: null,
  createdByUserId: null,
  summary: 'Trafo-Wartung mit Standort Werk 2',
  rawText: 'Bitte Wartung für Trafo HT-42 durchführen. Standort: Werk 2. Typenschild liegt als Foto bei.',
  receivedAt: '2026-05-31T10:30:00.000Z',
  lastActionAt: null,
  nextAction: null,
  needsAttention: true,
};

const categories: InquiryMasterDataCategory[] = [
  {
    id: 'cat-trafo',
    createdAt: '2026-05-31T12:00:00.000Z',
    updatedAt: '2026-05-31T12:00:00.000Z',
    name: 'Trafo-Service',
    description: 'Standardfälle für Transformatoren',
    active: true,
    sortOrder: 10,
    checklistTemplateIds: [],
  },
  {
    id: 'cat-repair',
    createdAt: '2026-05-31T12:00:00.000Z',
    updatedAt: '2026-05-31T12:00:00.000Z',
    name: 'Reparatur',
    description: null,
    active: true,
    sortOrder: 20,
    checklistTemplateIds: [],
  },
];

const templates: InquiryChecklistTemplate[] = [
  {
    id: 'tpl-repair',
    createdAt: '2026-05-31T12:00:00.000Z',
    updatedAt: '2026-05-31T12:00:00.000Z',
    categoryId: 'cat-repair',
    name: 'Reparatur allgemein',
    triggerKeywords: ['defekt', 'reparatur'],
    appliesToSources: ['email', 'manual'],
    requiredRole: 'employee',
    active: true,
    version: 1,
  },
  {
    id: 'tpl-trafo',
    createdAt: '2026-05-31T12:00:00.000Z',
    updatedAt: '2026-05-31T12:00:00.000Z',
    categoryId: 'cat-trafo',
    name: 'Trafo-Wartung',
    triggerKeywords: ['trafo', 'wartung', 'typenschild'],
    appliesToSources: ['email', 'manual'],
    requiredRole: 'employee',
    active: true,
    version: 1,
  },
];

const checklistItems: InquiryChecklistItem[] = [
  {
    id: 'item-location',
    createdAt: '2026-05-31T12:00:00.000Z',
    updatedAt: '2026-05-31T12:00:00.000Z',
    templateId: 'tpl-trafo',
    label: 'Standort geklärt',
    description: 'Standort oder Werk muss aus der Anfrage hervorgehen.',
    kind: 'required_info',
    required: true,
    aiCanComplete: true,
    evidenceHint: 'Standort',
    sortOrder: 10,
  },
  {
    id: 'item-photo',
    createdAt: '2026-05-31T12:00:00.000Z',
    updatedAt: '2026-05-31T12:00:00.000Z',
    templateId: 'tpl-trafo',
    label: 'Typenschild-Foto vorhanden',
    description: 'Foto oder Datei vom Typenschild prüfen.',
    kind: 'photo',
    required: true,
    aiCanComplete: true,
    evidenceHint: 'Typenschild',
    sortOrder: 20,
  },
  {
    id: 'item-availability',
    createdAt: '2026-05-31T12:00:00.000Z',
    updatedAt: '2026-05-31T12:00:00.000Z',
    templateId: 'tpl-trafo',
    label: 'Terminfenster geklärt',
    description: 'Gewünschtes Zeitfenster für Einsatz klären.',
    kind: 'customer_question',
    required: true,
    aiCanComplete: true,
    evidenceHint: 'Terminfenster',
    sortOrder: 30,
  },
];

const attachments: InquiryAttachment[] = [
  {
    id: 'att-1',
    createdAt: '2026-05-31T12:00:00.000Z',
    updatedAt: '2026-05-31T12:00:00.000Z',
    inquiryId: 'inq-1',
    messageId: null,
    source: 'email',
    fileName: 'typenschild-ht42.jpg',
    mimeType: 'image/jpeg',
    fileSize: 123456,
    storageProvider: 'local',
    storageUrl: '/local/inquiries/att-1',
    thumbnailUrl: null,
    uploadedByUserId: null,
  },
];

describe('inquiry checklist templates', () => {
  it('selects the best active template by inquiry source, keywords and category', () => {
    expect(selectChecklistTemplate(baseInquiry, templates, categories)).toMatchObject({
      id: 'tpl-trafo',
      categoryId: 'cat-trafo',
      name: 'Trafo-Wartung',
    });
  });

  it('ignores templates whose configured category is inactive', () => {
    const inactiveCategories = categories.map((category) => ({ ...category, active: false }));

    expect(selectChecklistTemplate(baseInquiry, templates, inactiveCategories)).toBeNull();
  });

  it('uses a manually selected inquiry category to pick the matching checklist template', () => {
    const repairInquiry: Inquiry = {
      ...baseInquiry,
      categoryId: 'cat-repair',
      title: 'Trafo defekt, Wartung und Reparatur prüfen',
      rawText: 'Trafo ist defekt, bitte Wartung und Reparatur prüfen.',
    };

    expect(selectChecklistTemplate(repairInquiry, templates, categories)).toMatchObject({
      id: 'tpl-repair',
      categoryId: 'cat-repair',
    });
  });

  it('marks required items with clear text or attachment evidence as suggested_done', () => {
    const suggestion = buildChecklistRunSuggestion(baseInquiry, templates[1], checklistItems, { attachments });

    expect(suggestion.items.filter((item) => item.status === 'suggested_done')).toEqual([
      expect.objectContaining({
        templateItemId: 'item-location',
        evidenceSource: 'mail',
        evidenceText: 'Standort',
      }),
      expect.objectContaining({
        templateItemId: 'item-photo',
        evidenceSource: 'attachment',
        evidenceText: 'typenschild-ht42.jpg',
      }),
    ]);
  });

  it('keeps uncertain required items open for clarification and drafts a customer question', () => {
    const suggestion = buildChecklistRunSuggestion(baseInquiry, templates[1], checklistItems, { attachments });

    expect(suggestion.items).toContainEqual(expect.objectContaining({
      templateItemId: 'item-availability',
      status: 'needs_clarification',
      evidenceSource: 'ai_suggestion',
      evidenceText: 'Terminfenster',
    }));
    expect(suggestion.followUpQuestions).toContain('Bitte Terminfenster klären: Gewünschtes Zeitfenster für Einsatz klären.');
    expect(suggestion.blocksOfficeHandover).toBe(true);
  });

  it('keeps checklist suggestions free of commercial fields', () => {
    const suggestion = buildChecklistRunSuggestion(baseInquiry, templates[1], checklistItems, { attachments });
    const serialized = JSON.stringify(suggestion);

    for (const forbiddenField of ['unitPrice', 'totalPrice', 'hourlyRate', 'amountCents', 'totalCents']) {
      expect(serialized).not.toContain(forbiddenField);
    }
  });
});
