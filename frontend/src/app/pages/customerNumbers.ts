import {
  previewNumberCircle,
  reserveNumberCircle,
  type NumberCircle,
} from '../lib/numberCircles';

export const CUSTOMER_NUMBER_CIRCLE_KEY = 'customers';
const CUSTOMER_NUMBER_CIRCLE_LABEL = 'Kundennummer';

export function findCustomerNumberCircle(circles: NumberCircle[]): NumberCircle | undefined {
  return circles.find((circle) => circle.key === CUSTOMER_NUMBER_CIRCLE_KEY)
    ?? circles.find((circle) => circle.label.trim().toLowerCase() === CUSTOMER_NUMBER_CIRCLE_LABEL.toLowerCase());
}

export function buildNextCustomerNumber(circles: NumberCircle[]): string {
  const circle = findCustomerNumberCircle(circles);
  return circle ? previewNumberCircle(circle) : 'Wird beim Speichern reserviert';
}

export async function reserveNextCustomerNumber(): Promise<string> {
  const reserved = await reserveNumberCircle(CUSTOMER_NUMBER_CIRCLE_KEY);
  return reserved.number;
}
