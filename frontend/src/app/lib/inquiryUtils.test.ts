import { describe, expect, it } from 'vitest';
import { getInquirySourceLabel, getInquiryNextAction, hasInquiryNeedsAttention, shouldInquiryNeedAttention } from './inquiryUtils';
import type { Inquiry } from './types';

const baseInquiry: Inquiry = {
  id: 'inq-1',
  title: 'Wartungsanfrage Trafo HT-42',
  status: 'new',
  priority: 'normal',
  source: 'email',
  sourceMessageId: '<mail-1@example.test>',
  senderName: 'Max Mustermann',
  senderEmail: 'max@example.test',
  senderPhone: null,
  customerId: null,
  locationId: null,
  assetId: null,
  relatedCalculationId: null,
  assigneeUserId: null,
  assignedByUserId: null,
  assignedAt: null,
  createdByUserId: null,
  summary: null,
  rawText: 'Bitte Angebot für Wartung erstellen.',
  receivedAt: '2026-05-22T10:00:00.000Z',
  lastActionAt: null,
  nextAction: null,
  needsAttention: false,
  createdAt: '2026-05-22T10:00:00.000Z',
  updatedAt: '2026-05-22T10:00:00.000Z',
};

describe('inquiry helpers', () => {
  it('markiert neue Mail-Anfragen ohne nächste Aktion als Handlungsbedarf', () => {
    expect(hasInquiryNeedsAttention(baseInquiry)).toBe(true);
  });

  it('setzt fachlich abgeschlossene Status nicht auf Handlungsbedarf', () => {
    for (const status of ['waiting_for_customer', 'done', 'lost', 'archived'] as const) {
      expect(shouldInquiryNeedAttention({ ...baseInquiry, status })).toBe(false);
    }
  });

  it('berechnet Handlungsbedarf aus Status und ungeklärten Pflichtpunkten statt nur aus dem alten Flag', () => {
    expect(shouldInquiryNeedAttention({
      ...baseInquiry,
      status: 'ready_for_calculation',
      needsAttention: true,
      categoryId: 'cat-1',
      customerId: 'customer-1',
      assetId: 'asset-1',
      switchingActionRequired: 'no',
    })).toBe(false);
    expect(shouldInquiryNeedAttention({
      ...baseInquiry,
      status: 'ready_for_calculation',
      categoryId: null,
      customerId: 'customer-1',
      assetId: 'asset-1',
      switchingActionRequired: 'no',
    })).toBe(true);
  });

  it('setzt bei waiting_for_customer die nächste Aktion auf Kundenantwort abwarten', () => {
    const inquiry: Inquiry = {
      ...baseInquiry,
      status: 'waiting_for_customer',
      nextAction: null,
    };

    expect(getInquiryNextAction(inquiry)).toBe('Kundenantwort abwarten');
    expect(hasInquiryNeedsAttention(inquiry)).toBe(false);
  });

  it('zeigt E-Mail als primären Anfragekanal an', () => {
    expect(getInquirySourceLabel('email')).toBe('E-Mail');
  });
});
