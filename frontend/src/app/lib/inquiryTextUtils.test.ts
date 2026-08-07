import { describe, expect, it } from 'vitest';
import { redactInquiryPriceText } from './inquiryTextUtils';

describe('inquiry text display guards', () => {
  it('keeps normal technical inquiry text unchanged', () => {
    expect(redactInquiryPriceText('Trafo HT-42 prüfen, 4 Std, Fotos vorhanden')).toBe('Trafo HT-42 prüfen, 4 Std, Fotos vorhanden');
  });

  it('redacts monetary fragments from imported inquiry communication', () => {
    expect(redactInquiryPriceText('Budget 1.250 \u20ac und Preis bitte nennen')).toBe('Budget [Betrag entfernt] und [Betragsbezug entfernt] bitte nennen');
    expect(redactInquiryPriceText('totalPrice=1200 amountCents=120000')).toBe('[Betragsbezug entfernt]=1200 [Betragsbezug entfernt]=120000');
  });
});
