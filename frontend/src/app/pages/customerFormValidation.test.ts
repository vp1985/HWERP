import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { validateCustomerForm } from './customerFormValidation';

describe('customer form validation', () => {
  it('accepts a filled customer with a normal email', () => {
    expect(validateCustomerForm({ name: 'Testeintragskunde', email: 'test@example.com' })).toEqual({});
  });

  it('shows an app-level message for invalid emails', () => {
    expect(validateCustomerForm({ name: 'Testeintragskunde', email: 'keine-mail' })).toEqual({
      email: 'E-Mail ist ungültig',
    });
  });

  it('keeps browser-native validation from blocking the React submit handler silently', () => {
    const source = readFileSync(resolve(__dirname, 'CustomerForm.tsx'), 'utf8');
    expect(source).toContain('<form noValidate onSubmit={handleSubmit}>');
  });
});
