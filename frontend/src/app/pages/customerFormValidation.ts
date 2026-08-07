export type CustomerFormValidationInput = {
  name?: string;
  email?: string;
};

export type CustomerFormErrors = {
  name?: string;
  email?: string;
};

export function validateCustomerForm(input: CustomerFormValidationInput): CustomerFormErrors {
  const errors: CustomerFormErrors = {};
  const name = input.name?.trim() ?? '';
  const email = input.email?.trim() ?? '';

  if (!name) {
    errors.name = 'Name ist erforderlich';
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = 'E-Mail ist ungültig';
  }

  return errors;
}
