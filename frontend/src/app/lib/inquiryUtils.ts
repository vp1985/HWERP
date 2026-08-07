import type { Inquiry, InquirySource } from './types';

const SOURCE_LABELS: Record<InquirySource, string> = {
  email: 'E-Mail',
  telegram: 'Telegram',
  whatsapp: 'WhatsApp',
  web: 'Webformular',
  manual: 'Manuell',
};

export function getInquirySourceLabel(source: InquirySource): string {
  return SOURCE_LABELS[source];
}

export function getInquiryNextAction(inquiry: Inquiry): string {
  if (inquiry.nextAction?.trim()) {
    return inquiry.nextAction;
  }

  switch (inquiry.status) {
    case 'waiting_for_customer':
      return 'Kundenantwort abwarten';
    case 'ready_for_calculation':
      return 'Kalkulation vorbereiten';
    case 'calculation_draft':
      return 'Kalkulationsentwurf prüfen';
    case 'offer_draft':
      return 'Antwort-/Angebotsentwurf prüfen';
    case 'sent':
      return 'Nachfassen planen';
    case 'done':
    case 'won':
    case 'lost':
    case 'archived':
      return 'Keine Aktion';
    case 'triage':
      return 'Anfrage einstufen';
    case 'new':
    default:
      return 'Anfrage prüfen';
  }
}

export function shouldInquiryNeedAttention(inquiry: Inquiry): boolean {
  if (['waiting_for_customer', 'done', 'won', 'lost', 'archived'].includes(inquiry.status)) {
    return false;
  }

  if (inquiry.status === 'new' || inquiry.status === 'triage' || inquiry.priority === 'urgent') {
    return true;
  }

  if (!inquiry.categoryId || !inquiry.customerId || (!inquiry.assetId && !inquiry.locationId)) {
    return true;
  }

  return inquiry.switchingActionRequired !== 'yes' && inquiry.switchingActionRequired !== 'no';
}

export function hasInquiryNeedsAttention(inquiry: Inquiry): boolean {
  return shouldInquiryNeedAttention(inquiry);
}
