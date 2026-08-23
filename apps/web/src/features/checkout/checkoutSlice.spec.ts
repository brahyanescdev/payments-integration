import checkoutReducer, {
  checkoutClosed,
  checkoutFailed,
  checkoutOpened,
  checkoutSucceeded,
  type CheckoutState,
} from './checkoutSlice';

const INITIAL: CheckoutState = checkoutReducer(undefined, { type: '@@INIT' });

const BREAKDOWN = {
  productAmountInCents: 8_900_000,
  baseFeeInCents: 300_000,
  deliveryFeeInCents: 800_000,
  totalInCents: 10_000_000,
  currency: 'COP',
};

describe('checkoutSlice', () => {
  it('starts idle with no product selected', () => {
    expect(INITIAL.step).toBe('idle');
    expect(INITIAL.productId).toBeNull();
  });

  it('opening a checkout moves to the form step and stores the idempotency key', () => {
    const state = checkoutReducer(
      INITIAL,
      checkoutOpened({ productId: 'p1', quantity: 2, idempotencyKey: 'key-1' }),
    );

    expect(state.step).toBe('form');
    expect(state.productId).toBe('p1');
    expect(state.quantity).toBe(2);
    expect(state.idempotencyKey).toBe('key-1');
  });

  it('opening a checkout clears any result left over from a previous attempt', () => {
    const priorAttempt = checkoutReducer(
      checkoutReducer(
        INITIAL,
        checkoutOpened({ productId: 'p1', quantity: 1, idempotencyKey: 'k1' }),
      ),
      checkoutSucceeded({
        transactionId: 'tx-1',
        reference: 'TX-1',
        breakdown: BREAKDOWN,
        cardMeta: { brand: 'visa', lastFour: '4242' },
      }),
    );

    const reopened = checkoutReducer(
      priorAttempt,
      checkoutOpened({ productId: 'p2', quantity: 1, idempotencyKey: 'k2' }),
    );

    expect(reopened.transactionId).toBeNull();
    expect(reopened.cardMeta).toBeNull();
    expect(reopened.productId).toBe('p2');
  });

  it('a successful checkout stores the transaction, reference and card metadata — never the full card', () => {
    const opened = checkoutReducer(
      INITIAL,
      checkoutOpened({ productId: 'p1', quantity: 1, idempotencyKey: 'k1' }),
    );

    const state = checkoutReducer(
      opened,
      checkoutSucceeded({
        transactionId: 'tx-1',
        reference: 'TX-1',
        breakdown: BREAKDOWN,
        cardMeta: { brand: 'visa', lastFour: '4242' },
      }),
    );

    expect(state.step).toBe('awaiting-payment');
    expect(state.transactionId).toBe('tx-1');
    expect(state.cardMeta).toEqual({ brand: 'visa', lastFour: '4242' });
    expect(Object.keys(state)).not.toContain('cardNumber');
  });

  it('a failure keeps the form open and surfaces the error message', () => {
    const opened = checkoutReducer(
      INITIAL,
      checkoutOpened({ productId: 'p1', quantity: 1, idempotencyKey: 'k1' }),
    );

    const state = checkoutReducer(opened, checkoutFailed('No hay unidades suficientes.'));

    expect(state.step).toBe('form');
    expect(state.errorMessage).toBe('No hay unidades suficientes.');
  });

  it('closing resets everything back to idle', () => {
    const opened = checkoutReducer(
      INITIAL,
      checkoutOpened({ productId: 'p1', quantity: 1, idempotencyKey: 'k1' }),
    );

    expect(checkoutReducer(opened, checkoutClosed())).toEqual(INITIAL);
  });
});
