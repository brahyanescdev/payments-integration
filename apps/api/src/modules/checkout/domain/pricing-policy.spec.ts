import { COP, makePricingRules } from '../../../testing/builders';
import { Money } from '../../../shared/domain/money';
import { PricingPolicy } from './pricing-policy';

describe('PricingPolicy', () => {
  it('adds the base fee and the delivery fee to the product amount', () => {
    const policy = new PricingPolicy(makePricingRules());

    const breakdown = policy.quote(COP(8_900_000), 1)._unsafeUnwrap();

    expect(breakdown.productAmount.amountInCents).toBe(8_900_000);
    expect(breakdown.baseFee.amountInCents).toBe(300_000);
    expect(breakdown.deliveryFee.amountInCents).toBe(800_000);
    expect(breakdown.total.amountInCents).toBe(10_000_000);
  });

  it('multiplies the product amount by the quantity, fees stay flat', () => {
    const policy = new PricingPolicy(makePricingRules());

    const breakdown = policy.quote(COP(1_000_000), 3)._unsafeUnwrap();

    expect(breakdown.productAmount.amountInCents).toBe(3_000_000);
    expect(breakdown.baseFee.amountInCents).toBe(300_000);
    expect(breakdown.total.amountInCents).toBe(4_100_000);
  });

  it('waives delivery once the order reaches the free-delivery threshold', () => {
    const policy = new PricingPolicy(
      makePricingRules({ freeDeliveryThresholdInCents: 20_000_000 }),
    );

    const breakdown = policy.quote(COP(20_000_000), 1)._unsafeUnwrap();

    expect(breakdown.deliveryFee.amountInCents).toBe(0);
    expect(breakdown.total.amountInCents).toBe(20_300_000);
  });

  it('still charges delivery one cent below the threshold', () => {
    const policy = new PricingPolicy(
      makePricingRules({ freeDeliveryThresholdInCents: 20_000_000 }),
    );

    const breakdown = policy.quote(COP(19_999_999), 1)._unsafeUnwrap();

    expect(breakdown.deliveryFee.amountInCents).toBe(800_000);
  });

  it('rejects a price whose currency differs from the configured one', () => {
    const policy = new PricingPolicy(makePricingRules({ currency: 'COP' }));
    const usd = Money.create(1_000, 'USD')._unsafeUnwrap();

    expect(policy.quote(usd, 1).isErr()).toBe(true);
  });

  it.each([0, -1, 1.5])('rejects the invalid quantity %p', (quantity) => {
    const policy = new PricingPolicy(makePricingRules());

    expect(policy.quote(COP(1_000), quantity).isErr()).toBe(true);
  });

  it('reads its fees from the injected rules, never from a literal', () => {
    const policy = new PricingPolicy(
      makePricingRules({ baseFeeInCents: 1, deliveryFeeInCents: 2 }),
    );

    const breakdown = policy.quote(COP(10), 1)._unsafeUnwrap();

    expect(breakdown.total.amountInCents).toBe(13);
  });
});
