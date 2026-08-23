import { checkoutFormSchema } from './checkout-form.schema';

const validValues = {
  cardNumber: '4242424242424242',
  cardHolder: 'Ana Perez',
  expiry: '12/29',
  cvc: '123',
  customer: {
    email: 'ana@example.com',
    fullName: 'Ana Pérez',
    phone: '3001234567',
    legalId: '1020304050',
    legalIdType: 'CC' as const,
  },
  delivery: {
    recipientName: 'Ana Pérez',
    phone: '3001234567',
    addressLine1: 'Calle 100 # 15-20',
    addressLine2: '',
    city: 'Bogotá',
    region: 'Cundinamarca',
    country: 'CO',
    postalCode: '110111',
  },
};

describe('checkoutFormSchema', () => {
  it('accepts a fully valid submission', () => {
    expect(checkoutFormSchema.safeParse(validValues).success).toBe(true);
  });

  it('strips formatting from the card number before validating it', () => {
    const parsed = checkoutFormSchema.parse({ ...validValues, cardNumber: '4242 4242 4242 4242' });

    expect(parsed.cardNumber).toBe('4242424242424242');
  });

  it('rejects a card number that fails the Luhn checksum', () => {
    expect(
      checkoutFormSchema.safeParse({ ...validValues, cardNumber: '4242424242424241' }).success,
    ).toBe(false);
  });

  it('rejects an expiry already in the past', () => {
    expect(checkoutFormSchema.safeParse({ ...validValues, expiry: '01/20' }).success).toBe(false);
  });

  it('rejects a CVC of the wrong length', () => {
    expect(checkoutFormSchema.safeParse({ ...validValues, cvc: '12' }).success).toBe(false);
  });

  it('rejects a cardholder name that is too short', () => {
    expect(checkoutFormSchema.safeParse({ ...validValues, cardHolder: 'A' }).success).toBe(false);
  });

  it('reuses the shared customer and delivery rules the backend also enforces', () => {
    expect(
      checkoutFormSchema.safeParse({
        ...validValues,
        customer: { ...validValues.customer, email: 'not-an-email' },
      }).success,
    ).toBe(false);
    expect(
      checkoutFormSchema.safeParse({
        ...validValues,
        delivery: { ...validValues.delivery, country: 'COL' },
      }).success,
    ).toBe(false);
  });
});
