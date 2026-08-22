import { Product, type ProductSnapshot } from '../modules/catalog/domain/product';
import { AmountBreakdown } from '../modules/checkout/domain/amount-breakdown';
import type { Address } from '../modules/checkout/domain/delivery';
import type { PricingRules } from '../modules/checkout/domain/pricing-policy';
import { Transaction } from '../modules/checkout/domain/transaction';
import { Money } from '../shared/domain/money';

/**
 * Builders for domain objects under test.
 *
 * Specs override only the field the case is about, so adding a required property
 * to an entity is a one-line change here instead of an edit across every suite.
 * `_unsafeUnwrap` is acceptable in this file precisely because it throws: a broken
 * fixture should fail loudly at setup rather than produce a misleading assertion.
 */
export const COP = (amountInCents: number): Money =>
  Money.create(amountInCents, 'COP')._unsafeUnwrap();

export function makeProductSnapshot(overrides: Partial<ProductSnapshot> = {}): ProductSnapshot {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    sku: 'TEE-CLASSIC-M',
    name: 'Camiseta clásica',
    description: 'Algodón peinado, corte regular.',
    price: COP(8_900_000),
    imageUrl: 'https://cdn.example.test/tee-classic.avif',
    stock: 10,
    version: 1,
    ...overrides,
  };
}

export const makeProduct = (overrides: Partial<ProductSnapshot> = {}): Product =>
  Product.rehydrate(makeProductSnapshot(overrides));

export const makePricingRules = (overrides: Partial<PricingRules> = {}): PricingRules => ({
  currency: 'COP',
  baseFeeInCents: 300_000,
  deliveryFeeInCents: 800_000,
  freeDeliveryThresholdInCents: 20_000_000,
  ...overrides,
});

export const makeBreakdown = (
  productAmountInCents = 8_900_000,
  baseFeeInCents = 300_000,
  deliveryFeeInCents = 800_000,
): AmountBreakdown =>
  AmountBreakdown.create(
    COP(productAmountInCents),
    COP(baseFeeInCents),
    COP(deliveryFeeInCents),
  )._unsafeUnwrap();

export const FIXED_NOW = new Date('2026-08-22T13:00:00.000Z');

export const makeTransaction = (
  overrides: Partial<Parameters<typeof Transaction.open>[0]> = {},
): Transaction =>
  Transaction.open({
    id: '22222222-2222-4222-8222-222222222222',
    reference: 'TX-22222222-2222-4222-8222-222222222222',
    customerId: '33333333-3333-4333-8333-333333333333',
    productId: '11111111-1111-4111-8111-111111111111',
    quantity: 1,
    breakdown: makeBreakdown(),
    now: FIXED_NOW,
    ...overrides,
  });

export const makeAddress = (overrides: Partial<Address> = {}): Address => ({
  line1: 'Calle 100 # 15-20',
  line2: 'Apto 502',
  city: 'Bogotá',
  region: 'Cundinamarca',
  country: 'CO',
  postalCode: '110111',
  ...overrides,
});
