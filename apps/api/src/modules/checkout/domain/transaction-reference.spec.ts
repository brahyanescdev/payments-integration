import { TransactionReference } from './transaction-reference';

const TRANSACTION_ID = '22222222-2222-4222-8222-222222222222';

describe('TransactionReference', () => {
  it('derives from the transaction id, so a retry reuses the same reference', () => {
    const first = TransactionReference.forTransaction(TRANSACTION_ID)._unsafeUnwrap();
    const retry = TransactionReference.forTransaction(TRANSACTION_ID)._unsafeUnwrap();

    expect(first.value).toBe(`TX-${TRANSACTION_ID}`);
    expect(retry.value).toBe(first.value);
  });

  it('produces different references for different transactions', () => {
    const one = TransactionReference.forTransaction(TRANSACTION_ID)._unsafeUnwrap();
    const other = TransactionReference.forTransaction(
      '33333333-3333-4333-8333-333333333333',
    )._unsafeUnwrap();

    expect(one.value).not.toBe(other.value);
  });

  it('trims surrounding whitespace', () => {
    expect(TransactionReference.create('  TX-1  ')._unsafeUnwrap().toString()).toBe('TX-1');
  });

  it.each(['', '   '])('rejects the empty reference "%s"', (raw) => {
    expect(TransactionReference.create(raw)._unsafeUnwrapErr().message).toMatch(/empty/);
  });

  it('rejects a reference beyond the gateway limit of 255 characters', () => {
    expect(TransactionReference.create('A'.repeat(256))._unsafeUnwrapErr().message).toMatch(/255/);
  });

  it('accepts exactly 255 characters', () => {
    expect(TransactionReference.create('A'.repeat(255)).isOk()).toBe(true);
  });

  it.each(['TX 1', 'TX/1', 'TX#1', 'TX,1'])('rejects the unsafe character in "%s"', (raw) => {
    expect(TransactionReference.create(raw).isErr()).toBe(true);
  });
});
