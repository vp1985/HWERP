export const WORKSHOP_CARD_NUMBER_CIRCLE_KEY = 'workshop_cards';
export const TRANSFER_RECEIPT_NUMBER_CIRCLE_KEY = 'transfer_receipts';
export const INQUIRY_NUMBER_CIRCLE_KEY = 'inquiries';

export interface NumberCircle {
  key: string;
  label: string;
  prefix: string;
  formatTemplate: string;
  padding: number;
  nextValue: number;
  resetYearly: boolean;
  lastYear: number | null;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
  preview?: string;
  maxUsedNumber?: number | null;
}

export type NumberCircleForm = Pick<
  NumberCircle,
  'key' | 'label' | 'prefix' | 'formatTemplate' | 'padding' | 'nextValue' | 'resetYearly' | 'lastYear' | 'isActive'
>;

export async function listNumberCircles(): Promise<NumberCircle[]> {
  const response = await fetch('/api/number-circles');
  if (!response.ok) throw new Error(await errorMessage(response));
  return response.json();
}

export async function saveNumberCircle(circle: NumberCircleForm): Promise<NumberCircle> {
  const response = await fetch('/api/number-circles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(circle),
  });
  if (!response.ok) throw new Error(await errorMessage(response));
  return response.json();
}

export async function reserveNumberCircle(key: string, quantity = 1): Promise<{ number: string; numbers: string[] }> {
  const response = await fetch(`/api/number-circles/${encodeURIComponent(key)}/next`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ quantity }),
  });
  if (!response.ok) throw new Error(await errorMessage(response));
  return response.json();
}

export async function returnNumberCircle(key: string, number: string): Promise<{ returned: boolean; number: string }> {
  const response = await fetch(`/api/number-circles/${encodeURIComponent(key)}/return`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ number }),
  });
  if (!response.ok) throw new Error(await errorMessage(response));
  return response.json();
}

async function errorMessage(response: Response): Promise<string> {
  try {
    const body = await response.json() as { error?: string };
    return body.error ?? response.statusText;
  } catch {
    return response.statusText;
  }
}

export function validateNumberCircleForm(circle: NumberCircleForm): string[] {
  const errors: string[] = [];

  if (!circle.key.trim()) {
    errors.push('Key ist erforderlich.');
  } else if (!/^[a-z][a-z0-9_]*$/.test(circle.key.trim())) {
    errors.push('Key darf nur Kleinbuchstaben, Ziffern und Unterstriche enthalten.');
  }

  if (!circle.label.trim()) errors.push('Bezeichnung ist erforderlich.');
  if (!circle.formatTemplate.trim()) errors.push('Format-Template ist erforderlich.');
  if (!circle.formatTemplate.includes('{NUMBER}')) errors.push('Format-Template muss {NUMBER} enthalten.');
  if (!Number.isInteger(circle.padding) || circle.padding < 1 || circle.padding > 20) errors.push('Padding muss zwischen 1 und 20 liegen.');
  if (!Number.isInteger(circle.nextValue) || circle.nextValue < 1) errors.push('Nächster Wert muss mindestens 1 sein.');

  const tokens = `${circle.prefix} ${circle.formatTemplate}`.match(/\{[^}]+\}/g) ?? [];
  const allowed = new Set(['{PREFIX}', '{NUMBER}', '{YYYY}']);
  for (const token of tokens) {
    if (!allowed.has(token)) errors.push(`Unbekannter Platzhalter ${token}.`);
  }

  return errors;
}

export function previewNumberCircle(circle: Pick<NumberCircleForm, 'prefix' | 'formatTemplate' | 'padding' | 'nextValue'>, date = new Date()): string {
  const year = String(date.getFullYear());
  const number = String(circle.nextValue || 1).padStart(Math.max(1, circle.padding || 1), '0');
  const prefix = circle.prefix.replaceAll('{YYYY}', year);

  return circle.formatTemplate
    .replaceAll('{YYYY}', year)
    .replaceAll('{PREFIX}', prefix)
    .replaceAll('{NUMBER}', number);
}
