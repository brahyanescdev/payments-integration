import {
  acceptanceTokensSchema,
  createCheckoutSchema,
  deliveryInputSchema,
  payCheckoutSchema,
} from './checkout.contract';

const validCustomer = {
  email: 'ana@example.com',
  fullName: 'Ana Pérez',
  phone: '3001234567',
  legalId: '1020304050',
  legalIdType: 'CC' as const,
};

const validDelivery = {
  recipientName: 'Ana Pérez',
  phone: '3001234567',
  addressLine1: 'Calle 100 # 15-20',
  addressLine2: 'Apto 502',
  city: 'Bogotá',
  region: 'Cundinamarca',
  country: 'co',
  postalCode: '110111',
};

const validCheckout = {
  productId: '11111111-1111-4111-8111-111111111111',
  quantity: 2,
  customer: validCustomer,
  delivery: validDelivery,
};

describe('createCheckoutSchema', () => {
  it('accepts a complete checkout request', () => {
    expect(createCheckoutSchema.parse(validCheckout).quantity).toBe(2);
  });

  it('carries no amount: the price is the server’s to decide', () => {
    const parsed = createCheckoutSchema.parse({ ...validCheckout, totalInCents: 999 });

    expect(parsed).not.toHaveProperty('totalInCents');
  });

  it.each([0, -1, 1.5, 51])('rejects the quantity %p', (quantity) => {
    expect(createCheckoutSchema.safeParse({ ...validCheckout, quantity }).success).toBe(false);
  });

  it.each(['ana', 'ana@', '@example.com'])('rejects the malformed email "%s"', (email) => {
    const request = { ...validCheckout, customer: { ...validCustomer, email } };

    expect(createCheckoutSchema.safeParse(request).success).toBe(false);
  });

  it.each(['123', '30012345678901234', '300-123-4567'])('rejects the phone "%s"', (phone) => {
    const request = { ...validCheckout, customer: { ...validCustomer, phone } };

    expect(createCheckoutSchema.safeParse(request).success).toBe(false);
  });

  it('rejects a product id that is not a UUID', () => {
    expect(createCheckoutSchema.safeParse({ ...validCheckout, productId: '42' }).success).toBe(
      false,
    );
  });

  it.each(['ABC123', '1020-3040', '10203 4050'])(
    'rejects the legal id "%s": digits only',
    (legalId) => {
      const request = { ...validCheckout, customer: { ...validCustomer, legalId } };

      expect(createCheckoutSchema.safeParse(request).success).toBe(false);
    },
  );
});

describe('deliveryInputSchema', () => {
  it('normalises the country code to uppercase', () => {
    expect(deliveryInputSchema.parse(validDelivery).country).toBe('CO');
  });

  it('defaults the optional second address line to null', () => {
    const { addressLine2: _omitted, ...withoutLine2 } = validDelivery;

    expect(deliveryInputSchema.parse(withoutLine2).addressLine2).toBeNull();
  });

  it('trims surrounding whitespace', () => {
    const parsed = deliveryInputSchema.parse({ ...validDelivery, city: '  Bogotá  ' });

    expect(parsed.city).toBe('Bogotá');
  });

  it.each(['C', 'COL'])('rejects the country code "%s"', (country) => {
    expect(deliveryInputSchema.safeParse({ ...validDelivery, country }).success).toBe(false);
  });

  it.each(['abc', '110-111', '110 111'])(
    'rejects the postal code "%s": digits only',
    (postalCode) => {
      expect(deliveryInputSchema.safeParse({ ...validDelivery, postalCode }).success).toBe(false);
    },
  );
});

describe('payCheckoutSchema', () => {
  const validPayment = {
    cardToken: 'tok_test_123',
    acceptanceToken: 'eyJhbGciOi',
    acceptPersonalAuthToken: 'eyJhbGciOi',
    installments: 1,
    cardBrand: 'VISA',
    cardLastFour: '4242',
  };

  it('accepts a tokenised payment', () => {
    expect(payCheckoutSchema.parse(validPayment).installments).toBe(1);
  });

  it('has no field for the card number, by construction', () => {
    const parsed = payCheckoutSchema.parse({ ...validPayment, number: '4242424242424242' });

    expect(parsed).not.toHaveProperty('number');
    expect(Object.keys(parsed)).not.toContain('cvc');
  });

  it.each(['424', '42424', 'abcd'])('rejects the last-four value "%s"', (cardLastFour) => {
    expect(payCheckoutSchema.safeParse({ ...validPayment, cardLastFour }).success).toBe(false);
  });

  it.each([0, 37, 2.5])('rejects the installment count %p', (installments) => {
    expect(payCheckoutSchema.safeParse({ ...validPayment, installments }).success).toBe(false);
  });
});

describe('acceptanceTokensSchema', () => {
  const validTokens = {
    publicKey: 'pub_test_123',
    tokenizationUrl: 'https://psp.example.test/v1/tokens/cards',
    acceptance: { token: 'acc_token', permalink: 'https://psp.test/terms' },
    personalDataAuthorization: { token: 'priv_token', permalink: 'https://psp.test/privacy' },
  };

  it('accepts a well-formed response', () => {
    expect(acceptanceTokensSchema.parse(validTokens).publicKey).toBe('pub_test_123');
  });

  it('accepts a tokenization URL that is relative to our own API, for the fake gateway driver', () => {
    const parsed = acceptanceTokensSchema.parse({
      ...validTokens,
      tokenizationUrl: '/api/v1/checkout/dev-tokenize',
    });

    expect(parsed.tokenizationUrl).toBe('/api/v1/checkout/dev-tokenize');
  });

  it('rejects a response with no tokenization URL', () => {
    const { tokenizationUrl: _omitted, ...withoutUrl } = validTokens;

    expect(acceptanceTokensSchema.safeParse(withoutUrl).success).toBe(false);
  });

  it('rejects a response missing the acceptance token', () => {
    const { acceptance: _omitted, ...withoutAcceptance } = validTokens;

    expect(acceptanceTokensSchema.safeParse(withoutAcceptance).success).toBe(false);
  });
});
