import { formatMoney } from './money';

describe('formatMoney', () => {
  it('converts cents to the major unit before formatting', () => {
    const formatted = formatMoney(8_900_000, 'COP');

    expect(formatted.replace(/\D/g, '')).toBe('89000');
  });

  it('renders zero as a valid amount, not as an empty or missing value', () => {
    expect(formatMoney(0, 'COP').replace(/\D/g, '')).toBe('0');
  });

  it('drops fractional digits, since COP has no meaningful cents in retail display', () => {
    expect(formatMoney(150, 'COP')).not.toMatch(/[.,]\d+$/);
  });

  it('carries the given currency rather than a hardcoded one', () => {
    expect(formatMoney(1_000_00, 'USD')).not.toBe(formatMoney(1_000_00, 'COP'));
  });
});
