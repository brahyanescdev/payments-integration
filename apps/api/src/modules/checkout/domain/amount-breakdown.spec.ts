import { COP, makeBreakdown } from '../../../testing/builders';
import { Money } from '../../../shared/domain/money';
import { AmountBreakdown } from './amount-breakdown';

describe('AmountBreakdown', () => {
  it('derives the total from its parts rather than accepting one', () => {
    const breakdown = AmountBreakdown.create(COP(1_000), COP(200), COP(50))._unsafeUnwrap();

    expect(breakdown.total.amountInCents).toBe(1_250);
    expect(breakdown.currency).toBe('COP');
  });

  it('fails when the parts are not in the same currency', () => {
    const usd = Money.create(200, 'USD')._unsafeUnwrap();

    expect(AmountBreakdown.create(COP(1_000), usd, COP(50)).isErr()).toBe(true);
  });

  it('compares by its parts, which is how a re-quote is checked against the stored one', () => {
    expect(makeBreakdown(1_000, 200, 50).equals(makeBreakdown(1_000, 200, 50))).toBe(true);
    expect(makeBreakdown(1_000, 200, 50).equals(makeBreakdown(1_000, 200, 0))).toBe(false);
  });
});
