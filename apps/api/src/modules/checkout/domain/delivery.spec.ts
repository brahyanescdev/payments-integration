import { FIXED_NOW, makeAddress } from '../../../testing/builders';
import { Delivery } from './delivery';

const open = (overrides: Partial<Parameters<typeof Delivery.open>[0]> = {}) =>
  Delivery.open({
    id: '44444444-4444-4444-8444-444444444444',
    transactionId: '22222222-2222-4222-8222-222222222222',
    recipientName: 'Ana Pérez',
    phone: '3001234567',
    address: makeAddress(),
    now: FIXED_NOW,
    ...overrides,
  });

describe('Delivery', () => {
  it('opens as PENDING while the payment is in flight', () => {
    expect(open()._unsafeUnwrap().status).toBe('PENDING');
  });

  it('trims the recipient name and phone', () => {
    const delivery = open({
      recipientName: '  Ana Pérez  ',
      phone: ' 3001234567 ',
    })._unsafeUnwrap();

    expect(delivery.recipientName).toBe('Ana Pérez');
    expect(delivery.phone).toBe('3001234567');
  });

  it.each([
    ['recipientName', { recipientName: '   ' }],
    ['address.line1', { address: makeAddress({ line1: '' }) }],
    ['address.city', { address: makeAddress({ city: '  ' }) }],
  ])('refuses to open without %s', (_field, overrides) => {
    expect(open(overrides).isErr()).toBe(true);
  });

  describe('transitions', () => {
    it('assigns the goods once the payment is approved', () => {
      const delivery = open()._unsafeUnwrap();

      expect(delivery.assign().isOk()).toBe(true);
      expect(delivery.status).toBe('ASSIGNED');
    });

    it('cancels after a failed payment', () => {
      const delivery = open()._unsafeUnwrap();

      expect(delivery.cancel().isOk()).toBe(true);
      expect(delivery.status).toBe('CANCELLED');
    });

    it('never transitions twice, mirroring the transaction rule', () => {
      const delivery = open()._unsafeUnwrap();
      delivery.assign();

      expect(delivery.cancel().isErr()).toBe(true);
      expect(delivery.assign().isErr()).toBe(true);
      expect(delivery.status).toBe('ASSIGNED');
    });
  });

  it('round-trips through a snapshot', () => {
    const delivery = open()._unsafeUnwrap();
    delivery.assign();

    const restored = Delivery.rehydrate(delivery.toSnapshot());

    expect(restored.status).toBe('ASSIGNED');
    expect(restored.address.city).toBe('Bogotá');
    expect(restored.createdAt).toEqual(FIXED_NOW);
  });
});
