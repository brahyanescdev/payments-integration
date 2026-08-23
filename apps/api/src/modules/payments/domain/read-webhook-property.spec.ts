import { readWebhookProperty } from './read-webhook-property';

describe('readWebhookProperty', () => {
  it('reads a nested string value by its dotted path', () => {
    const data = { transaction: { id: 'tx-1', status: 'APPROVED' } };

    expect(readWebhookProperty(data, 'transaction.status')).toBe('APPROVED');
  });

  it('stringifies a nested number, matching how the gateway hashes it', () => {
    const data = { transaction: { amount_in_cents: 100_000 } };

    expect(readWebhookProperty(data, 'transaction.amount_in_cents')).toBe('100000');
  });

  it('returns undefined for a path that does not exist', () => {
    const data = { transaction: { id: 'tx-1' } };

    expect(readWebhookProperty(data, 'transaction.missing')).toBeUndefined();
  });

  it('returns undefined rather than throwing when an intermediate segment is not an object', () => {
    const data = { transaction: 'not-an-object' };

    expect(readWebhookProperty(data, 'transaction.status')).toBeUndefined();
  });

  it('returns undefined for a value that is neither a string nor a number', () => {
    const data = { transaction: { flag: true } };

    expect(readWebhookProperty(data, 'transaction.flag')).toBeUndefined();
  });
});
