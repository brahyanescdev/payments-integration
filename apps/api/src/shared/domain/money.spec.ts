import { Money } from './money';

/** Unwraps a Result known to be Ok; keeps the arrange steps readable. */
const cop = (cents: number): Money => Money.create(cents, 'COP')._unsafeUnwrap();

describe('Money', () => {
  describe('create', () => {
    it('accepts a non-negative integer amount with an ISO-4217 code', () => {
      const money = Money.create(150_000, 'COP')._unsafeUnwrap();

      expect(money.amountInCents).toBe(150_000);
      expect(money.currency).toBe('COP');
    });

    it('rejects fractional cents, which is how rounding bugs enter a ledger', () => {
      const result = Money.create(10.5, 'COP');

      expect(result._unsafeUnwrapErr().kind).toBe('Validation');
    });

    it('rejects negative amounts', () => {
      expect(Money.create(-1, 'COP')._unsafeUnwrapErr().kind).toBe('Validation');
    });

    it.each(['co', 'COPS', 'cop', ''])('rejects the malformed currency code "%s"', (currency) => {
      expect(Money.create(100, currency).isErr()).toBe(true);
    });

    it('builds a zero amount', () => {
      expect(Money.zero('COP')._unsafeUnwrap().amountInCents).toBe(0);
    });
  });

  describe('add', () => {
    it('sums amounts of the same currency', () => {
      expect(cop(1_000).add(cop(250))._unsafeUnwrap().amountInCents).toBe(1_250);
    });

    it('refuses to mix currencies rather than silently producing a wrong total', () => {
      const usd = Money.create(100, 'USD')._unsafeUnwrap();

      expect(cop(1_000).add(usd)._unsafeUnwrapErr().message).toMatch(/USD/);
    });
  });

  describe('multiply', () => {
    it('scales by an item quantity', () => {
      expect(cop(2_500).multiply(3)._unsafeUnwrap().amountInCents).toBe(7_500);
    });

    it('yields zero for a factor of zero', () => {
      expect(cop(2_500).multiply(0)._unsafeUnwrap().amountInCents).toBe(0);
    });

    it.each([-1, 1.5])('rejects the invalid factor %p', (factor) => {
      expect(cop(2_500).multiply(factor).isErr()).toBe(true);
    });
  });

  describe('comparison', () => {
    it('compares amounts within a currency', () => {
      expect(cop(1_000).isGreaterThanOrEqualTo(cop(1_000))).toBe(true);
      expect(cop(999).isGreaterThanOrEqualTo(cop(1_000))).toBe(false);
    });

    it('never reports two different currencies as comparable or equal', () => {
      const usd = Money.create(1_000, 'USD')._unsafeUnwrap();

      expect(cop(1_000).isGreaterThanOrEqualTo(usd)).toBe(false);
      expect(cop(1_000).equals(usd)).toBe(false);
    });

    it('treats identical amount and currency as equal', () => {
      expect(cop(1_000).equals(cop(1_000))).toBe(true);
    });
  });

  it('renders amount and currency for logs', () => {
    expect(cop(1_000).toString()).toBe('1000 COP');
  });
});
