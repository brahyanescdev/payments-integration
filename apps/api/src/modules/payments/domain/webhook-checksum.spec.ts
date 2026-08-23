import { createHash } from 'node:crypto';

import { computeWebhookChecksum } from './webhook-checksum';

describe('computeWebhookChecksum', () => {
  it('concatenates the property values, the timestamp and the secret, then hashes with SHA256', () => {
    const propertyValues = ['tx-123', 'APPROVED', '10000000'];
    const timestamp = 1_700_000_000;
    const eventsSecret = 'test-events-secret';

    const expected = createHash('sha256')
      .update(`tx-123APPROVED100000001700000000test-events-secret`)
      .digest('hex');

    expect(computeWebhookChecksum(propertyValues, timestamp, eventsSecret)).toBe(expected);
  });

  it('produces a 64-character lowercase hex digest', () => {
    const checksum = computeWebhookChecksum(['a', 'b'], 1, 'secret');

    expect(checksum).toMatch(/^[0-9a-f]{64}$/);
  });

  it('changes when the property order changes, since order is part of the contract', () => {
    const first = computeWebhookChecksum(['tx-123', 'APPROVED'], 1, 'secret');
    const second = computeWebhookChecksum(['APPROVED', 'tx-123'], 1, 'secret');

    expect(first).not.toBe(second);
  });

  it('changes when the events secret changes', () => {
    const first = computeWebhookChecksum(['tx-123'], 1, 'secret-a');
    const second = computeWebhookChecksum(['tx-123'], 1, 'secret-b');

    expect(first).not.toBe(second);
  });
});
