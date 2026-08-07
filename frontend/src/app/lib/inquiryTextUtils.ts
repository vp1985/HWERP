export function redactInquirySensitiveAmountText(value: string | null | undefined): string {
  if (!value) {
    return '';
  }

  return value
    .replace(/\b(price|prices|totalPrice|hourlyRate|unitPrice|amountCents|totalCents|Preis|Preise|Betrag|Beträge|Summe|Summen)\b/g, '[Betragsbezug entfernt]')
    .replace(/\b\d{1,3}(?:[.\s]\d{3})*(?:,\d{2})?\s*(?:\u20ac|EUR)/gi, '[Betrag entfernt]')
    .replace(/\b\d+(?:[,.]\d{2})?\s*(?:\u20ac|EUR)/gi, '[Betrag entfernt]');
}

export const redactInquiryPriceText = redactInquirySensitiveAmountText;
