import { createHash } from 'node:crypto';

import { computeIntegritySignature } from './integrity-signature';

describe('computeIntegritySignature', () => {
  it('concatenates reference, amount, currency and secret with no separators, then SHA256s it', () => {
    // Re-derived independently from the same documented formula, rather than
    // pinned to a specific literal digest: a hash scraped through a
    // paraphrasing fetch is not a trustworthy source of a 64-character value,
    // and the concatenation order is the actual thing worth locking down.
    const reference = 'sk8-438k4-xmxm392-sn2';
    const amountInCents = 4_900_000;
    const currency = 'COP';
    const secret = 'prod_integrity_Z5mMke9x0k8gpErbDqwrJXMqsI6SFli6';
    const expected = createHash('sha256')
      .update(`${reference}${amountInCents}${currency}${secret}`)
      .digest('hex');

    expect(computeIntegritySignature(reference, amountInCents, currency, secret)).toBe(expected);
  });

  it('produces a 64-character lowercase hex digest', () => {
    expect(computeIntegritySignature('TX-1', 1000, 'COP', 'secret')).toMatch(/^[0-9a-f]{64}$/);
  });

  it('changes when the amount changes, so a tampered request cannot reuse a stolen signature', () => {
    const a = computeIntegritySignature('TX-1', 1000, 'COP', 'secret');
    const b = computeIntegritySignature('TX-1', 2000, 'COP', 'secret');

    expect(a).not.toBe(b);
  });

  it('changes when the reference changes', () => {
    const a = computeIntegritySignature('TX-1', 1000, 'COP', 'secret');
    const b = computeIntegritySignature('TX-2', 1000, 'COP', 'secret');

    expect(a).not.toBe(b);
  });

  it('is deterministic for the same inputs', () => {
    const a = computeIntegritySignature('TX-1', 1000, 'COP', 'secret');
    const b = computeIntegritySignature('TX-1', 1000, 'COP', 'secret');

    expect(a).toBe(b);
  });
});
