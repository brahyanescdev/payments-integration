import checkoutReducer, {
  checkoutClosed,
  checkoutFailed,
  checkoutOpened,
  checkoutSucceeded,
  paymentSucceeded,
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

function opened(state = INITIAL) {
  return checkoutReducer(
    state,
    checkoutOpened({ productId: 'p1', quantity: 1, idempotencyKey: 'k1' }),
  );
}

function succeeded(state = opened()) {
  return checkoutReducer(
    state,
    checkoutSucceeded({
      transactionId: 'tx-1',
      reference: 'TX-1',
      breakdown: BREAKDOWN,
      cardMeta: { brand: 'visa', lastFour: '4242' },
      cardToken: 'tok_fake_4242_abc',
      acceptanceToken: 'acc-token',
      acceptPersonalAuthToken: 'auth-token',
      payIdempotencyKey: 'pay-key-1',
    }),
  );
}

describe('checkoutSlice', () => {
  it('starts idle with no product selected', () => {
    expect(INITIAL.step).toBe('idle');
    expect(INITIAL.productId).toBeNull();
  });

  it('opening a checkout moves to the form step and stores the idempotency key', () => {
    const state = opened();

    expect(state.step).toBe('form');
    expect(state.productId).toBe('p1');
    expect(state.quantity).toBe(1);
    expect(state.idempotencyKey).toBe('k1');
  });

  it('opening a checkout clears any result left over from a previous attempt', () => {
    const priorAttempt = succeeded();

    const reopened = checkoutReducer(
      priorAttempt,
      checkoutOpened({ productId: 'p2', quantity: 1, idempotencyKey: 'k2' }),
    );

    expect(reopened.transactionId).toBeNull();
    expect(reopened.cardMeta).toBeNull();
    expect(reopened.cardToken).toBeNull();
    expect(reopened.payIdempotencyKey).toBeNull();
    expect(reopened.productId).toBe('p2');
  });

  it('a successful checkout stores the transaction, the tokens and the card metadata — never the full card', () => {
    const state = succeeded();

    expect(state.step).toBe('summary');
    expect(state.transactionId).toBe('tx-1');
    expect(state.cardMeta).toEqual({ brand: 'visa', lastFour: '4242' });
    expect(state.cardToken).toBe('tok_fake_4242_abc');
    expect(state.acceptanceToken).toBe('acc-token');
    expect(state.acceptPersonalAuthToken).toBe('auth-token');
    expect(state.payIdempotencyKey).toBe('pay-key-1');
    expect(Object.keys(state)).not.toContain('cardNumber');
  });

  it('a failure keeps the step and surfaces the error message', () => {
    const state = checkoutReducer(opened(), checkoutFailed('No hay unidades suficientes.'));

    expect(state.step).toBe('form');
    expect(state.errorMessage).toBe('No hay unidades suficientes.');
  });

  it('a failed payment keeps the summary step and surfaces the error message', () => {
    const state = checkoutReducer(succeeded(), checkoutFailed('La tarjeta fue rechazada.'));

    expect(state.step).toBe('summary');
    expect(state.errorMessage).toBe('La tarjeta fue rechazada.');
  });

  it('a resolved payment moves to the result step with the gateway status', () => {
    const state = checkoutReducer(
      succeeded(),
      paymentSucceeded({ status: 'APPROVED', failureReason: null }),
    );

    expect(state.step).toBe('result');
    expect(state.transactionStatus).toBe('APPROVED');
    expect(state.failureReason).toBeNull();
  });

  it('a declined payment records its failure reason', () => {
    const state = checkoutReducer(
      succeeded(),
      paymentSucceeded({ status: 'DECLINED', failureReason: 'insufficient_funds' }),
    );

    expect(state.transactionStatus).toBe('DECLINED');
    expect(state.failureReason).toBe('insufficient_funds');
  });

  it('closing resets everything back to idle', () => {
    expect(checkoutReducer(opened(), checkoutClosed())).toEqual(INITIAL);
  });
});
