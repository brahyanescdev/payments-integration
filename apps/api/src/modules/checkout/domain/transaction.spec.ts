import { FIXED_NOW, makeTransaction } from '../../../testing/builders';
import { Transaction } from './transaction';

const LATER = new Date('2026-08-22T13:05:00.000Z');

describe('Transaction', () => {
  it('opens in PENDING with no gateway identity yet', () => {
    const transaction = makeTransaction();

    expect(transaction.status).toBe('PENDING');
    expect(transaction.isPending).toBe(true);
    expect(transaction.isFinal).toBe(false);
    expect(transaction.gatewayTransactionId).toBeNull();
    expect(transaction.card).toBeNull();
  });

  describe('while pending', () => {
    it('records the card fingerprint without the card itself', () => {
      const transaction = makeTransaction();

      expect(transaction.attachCard({ brand: 'VISA', lastFour: '4242' }, LATER).isOk()).toBe(true);
      expect(transaction.card).toEqual({ brand: 'VISA', lastFour: '4242' });
    });

    it('links the gateway identifier once the charge is submitted', () => {
      const transaction = makeTransaction();

      expect(transaction.linkToGateway('gw_123', LATER).isOk()).toBe(true);
      expect(transaction.gatewayTransactionId).toBe('gw_123');
    });

    it.each(['APPROVED', 'DECLINED', 'VOIDED', 'ERROR'] as const)('settles as %s', (status) => {
      const transaction = makeTransaction();

      expect(transaction.settle(status, LATER, 'reason').isOk()).toBe(true);
      expect(transaction.status).toBe(status);
      expect(transaction.isFinal).toBe(true);
    });

    it('keeps no failure reason on an approved payment', () => {
      const transaction = makeTransaction();

      transaction.settle('APPROVED', LATER, 'ignored');

      expect(transaction.failureReason).toBeNull();
    });

    it('keeps the gateway explanation on a declined payment', () => {
      const transaction = makeTransaction();

      transaction.settle('DECLINED', LATER, 'INSUFFICIENT_FUNDS');

      expect(transaction.failureReason).toBe('INSUFFICIENT_FUNDS');
    });
  });

  describe('once settled', () => {
    it('refuses a second settlement, which is what makes a duplicate webhook safe', () => {
      const transaction = makeTransaction();
      transaction.settle('APPROVED', LATER);

      const error = transaction.settle('DECLINED', LATER, 'late event')._unsafeUnwrapErr();

      expect(error.kind).toBe('TransactionNotPending');
      expect(transaction.status).toBe('APPROVED');
      expect(transaction.failureReason).toBeNull();
    });

    it('refuses to attach a card or relink the gateway', () => {
      const transaction = makeTransaction();
      transaction.settle('DECLINED', LATER, 'nope');

      expect(transaction.attachCard({ brand: 'VISA', lastFour: '1111' }, LATER).isErr()).toBe(true);
      expect(transaction.linkToGateway('gw_other', LATER).isErr()).toBe(true);
      expect(transaction.gatewayTransactionId).toBeNull();
    });
  });

  describe('snapshots', () => {
    it('advances updatedAt on a transition but never createdAt', () => {
      const transaction = makeTransaction();
      transaction.settle('APPROVED', LATER);

      const snapshot = transaction.toSnapshot();

      expect(snapshot.createdAt).toEqual(FIXED_NOW);
      expect(snapshot.updatedAt).toEqual(LATER);
    });

    it('round-trips through rehydrate, preserving the settled state', () => {
      const original = makeTransaction();
      original.attachCard({ brand: 'MASTERCARD', lastFour: '5454' }, LATER);
      original.settle('APPROVED', LATER);

      const restored = Transaction.rehydrate(original.toSnapshot());

      expect(restored.status).toBe('APPROVED');
      expect(restored.card).toEqual({ brand: 'MASTERCARD', lastFour: '5454' });
      expect(restored.settle('DECLINED', LATER).isErr()).toBe(true);
    });
  });
});
