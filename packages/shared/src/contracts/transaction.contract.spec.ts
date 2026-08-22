import { amountBreakdownSchema, apiErrorSchema } from './common.contract';
import { productSchema } from './product.contract';
import { isFinalStatus, transactionSchema } from './transaction.contract';

describe('amountBreakdownSchema', () => {
  const breakdown = {
    productAmountInCents: 8_900_000,
    baseFeeInCents: 300_000,
    deliveryFeeInCents: 800_000,
    totalInCents: 10_000_000,
    currency: 'COP',
  };

  it('accepts integer cents', () => {
    expect(amountBreakdownSchema.parse(breakdown).totalInCents).toBe(10_000_000);
  });

  it('rejects a fractional amount, which is how rounding drift enters a receipt', () => {
    expect(amountBreakdownSchema.safeParse({ ...breakdown, totalInCents: 100.5 }).success).toBe(
      false,
    );
  });

  it.each(['cop', 'COPS', 'C'])('rejects the currency "%s"', (currency) => {
    expect(amountBreakdownSchema.safeParse({ ...breakdown, currency }).success).toBe(false);
  });
});

describe('transactionSchema', () => {
  const transaction = {
    id: '22222222-2222-4222-8222-222222222222',
    reference: 'TX-22222222-2222-4222-8222-222222222222',
    status: 'APPROVED',
    breakdown: {
      productAmountInCents: 8_900_000,
      baseFeeInCents: 300_000,
      deliveryFeeInCents: 800_000,
      totalInCents: 10_000_000,
      currency: 'COP',
    },
    card: { brand: 'VISA', lastFour: '4242' },
    failureReason: null,
    createdAt: '2026-08-22T13:00:00.000Z',
    updatedAt: '2026-08-22T13:05:00.000Z',
  };

  it('accepts a settled transaction', () => {
    expect(transactionSchema.parse(transaction).status).toBe('APPROVED');
  });

  it('allows a transaction with no card yet', () => {
    expect(transactionSchema.parse({ ...transaction, card: null }).card).toBeNull();
  });

  it('rejects a status the gateway never reports', () => {
    expect(transactionSchema.safeParse({ ...transaction, status: 'REFUNDED' }).success).toBe(false);
  });

  it('exposes no gateway credential or card token in its shape', () => {
    const parsed = transactionSchema.parse({
      ...transaction,
      cardToken: 'tok_secret',
      gatewayPrivateKey: 'prv_secret',
    });

    expect(Object.keys(parsed)).not.toContain('cardToken');
    expect(Object.keys(parsed)).not.toContain('gatewayPrivateKey');
  });
});

describe('isFinalStatus', () => {
  it.each(['APPROVED', 'DECLINED', 'VOIDED', 'ERROR'] as const)('treats %s as final', (status) => {
    expect(isFinalStatus(status)).toBe(true);
  });

  it('treats PENDING as still in flight, which is what stops the polling loop', () => {
    expect(isFinalStatus('PENDING')).toBe(false);
  });
});

describe('productSchema', () => {
  const product = {
    id: '11111111-1111-4111-8111-111111111111',
    sku: 'TEE-ESENCIAL-ORG',
    name: 'Camiseta Orgánica Esencial',
    description: 'Algodón orgánico peinado.',
    priceInCents: 8_900_000,
    currency: 'COP',
    imageUrl: '/images/tee-esencial.svg',
    stock: 12,
    isAvailable: true,
  };

  it('accepts a catalogue item', () => {
    expect(productSchema.parse(product).sku).toBe('TEE-ESENCIAL-ORG');
  });

  it('rejects negative stock', () => {
    expect(productSchema.safeParse({ ...product, stock: -1 }).success).toBe(false);
  });
});

describe('apiErrorSchema', () => {
  it('carries a stable discriminator the frontend can branch on', () => {
    const parsed = apiErrorSchema.parse({
      error: { kind: 'InsufficientStock', message: 'No hay unidades suficientes.' },
    });

    expect(parsed.error.kind).toBe('InsufficientStock');
  });

  it('rejects an envelope without a kind', () => {
    expect(apiErrorSchema.safeParse({ error: { message: 'boom' } }).success).toBe(false);
  });
});
