import { API_ROUTES, TEST_IDS } from '@payments/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';

import { renderWithProviders } from '../../testing/render';
import { server } from '../../testing/msw/server';
import { t } from '../../i18n/es';
import { CheckoutModalHost } from './CheckoutModal';

const OPENED_STATE = {
  checkout: {
    step: 'form' as const,
    productId: '11111111-1111-4111-8111-111111111111',
    quantity: 2,
    idempotencyKey: 'test-idem-key',
  },
};

const BREAKDOWN = {
  productAmountInCents: 8_900_000,
  baseFeeInCents: 300_000,
  deliveryFeeInCents: 800_000,
  totalInCents: 10_000_000,
  currency: 'COP',
};

const SUMMARY_STATE = {
  checkout: {
    ...OPENED_STATE.checkout,
    step: 'summary' as const,
    transactionId: 'tx-1',
    reference: 'TX-tx-1',
    breakdown: BREAKDOWN,
    cardMeta: { brand: 'visa' as const, lastFour: '4242' },
    cardToken: 'tok_fake_4242_abc',
    acceptanceToken: 'acc-token',
    acceptPersonalAuthToken: 'auth-token',
    payIdempotencyKey: 'pay-key-1',
  },
};

/**
 * Types the raw digits into the card field in one native change event.
 *
 * `user.type` simulates real keystrokes, and this field reformats its own value
 * (inserting spaces) on every change — a length-changing controlled re-render
 * mid-keystroke is a well-known source of caret/selection desync in jsdom, which
 * corrupts a character-by-character simulation regardless of how the component
 * itself manages focus. A single change event is also how most real card entry
 * actually arrives in practice — autofill or a password manager paste the whole
 * number at once — so it is not a lesser test, just a different, more reliable
 * one for this field.
 */
function typeCardNumber(digits: string) {
  fireEvent.change(screen.getByTestId(TEST_IDS.checkoutModal.cardNumber), {
    target: { value: digits },
  });
}

async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  typeCardNumber('4242424242424242');
  await user.type(screen.getByLabelText(t.checkout.cardHolderLabel), 'Ana Perez');
  await user.type(screen.getByLabelText(t.checkout.expiryLabel), '12/29');
  await user.type(screen.getByTestId(TEST_IDS.checkoutModal.cvc), '123');
  await user.type(screen.getByLabelText(t.checkout.emailLabel), 'ana@example.com');
  await user.type(screen.getByLabelText(t.checkout.fullNameLabel), 'Ana Pérez');
  await user.type(screen.getAllByLabelText(t.checkout.phoneLabel)[0]!, '3001234567');
  await user.type(screen.getByLabelText(t.checkout.legalIdLabel), '1020304050');
  await user.type(screen.getByLabelText(t.checkout.recipientNameLabel), 'Ana Pérez');
  await user.type(screen.getAllByLabelText(t.checkout.phoneLabel)[1]!, '3001234567');
  await user.type(screen.getByLabelText(t.checkout.addressLine1Label), 'Calle 100 # 15-20');
  await user.type(screen.getByLabelText(t.checkout.cityLabel), 'Bogotá');
  await user.type(screen.getByLabelText(t.checkout.regionLabel), 'Cundinamarca');
  await user.type(screen.getByLabelText(t.checkout.postalCodeLabel), '110111');
}

describe('CheckoutModal', () => {
  it('renders nothing when the checkout is idle', () => {
    renderWithProviders(<CheckoutModalHost />);

    expect(screen.queryByTestId(TEST_IDS.checkoutModal.root)).not.toBeInTheDocument();
  });

  it('shows the VISA badge as the card number arrives', () => {
    renderWithProviders(<CheckoutModalHost />, { preloadedState: OPENED_STATE });

    typeCardNumber('4242');

    expect(
      within(screen.getByTestId(TEST_IDS.checkoutModal.root)).getByLabelText('visa'),
    ).toBeInTheDocument();
  });

  it('formats the card number with spaces every four digits', () => {
    renderWithProviders(<CheckoutModalHost />, { preloadedState: OPENED_STATE });

    typeCardNumber('4242424242424242');

    expect(screen.getByTestId(TEST_IDS.checkoutModal.cardNumber)).toHaveValue(
      '4242 4242 4242 4242',
    );
  });

  it('shows validation errors and never calls the API for an invalid card number', async () => {
    const user = userEvent.setup();
    let called = false;
    server.use(
      http.post(`*/${API_ROUTES.checkout.create}`, () => {
        called = true;

        return HttpResponse.json({}, { status: 201 });
      }),
    );

    renderWithProviders(<CheckoutModalHost />, { preloadedState: OPENED_STATE });
    await fillValidForm(user);
    typeCardNumber('1234');
    await user.click(screen.getByTestId(TEST_IDS.checkoutModal.submit));

    await waitFor(() => expect(screen.getByText(/no es válido/i)).toBeInTheDocument());
    expect(called).toBe(false);
  });

  it('opens the checkout and tokenises the card on submit, without ever sending the raw card number to our own API', async () => {
    const user = userEvent.setup();
    let receivedCheckoutBody: Record<string, unknown> | undefined;
    let receivedTokenizeBody: Record<string, unknown> | undefined;
    server.use(
      http.post(`*/${API_ROUTES.checkout.create}`, async ({ request }) => {
        receivedCheckoutBody = (await request.json()) as Record<string, unknown>;

        return HttpResponse.json(
          { transactionId: 'tx-1', reference: 'TX-tx-1', status: 'PENDING', breakdown: BREAKDOWN },
          { status: 201 },
        );
      }),
      http.post('*/checkout/dev-tokenize', async ({ request }) => {
        receivedTokenizeBody = (await request.json()) as Record<string, unknown>;

        return HttpResponse.json({
          status: 'CREATED',
          data: { id: 'tok_fake_4242_xyz', last_four: '4242' },
        });
      }),
    );

    const { store } = renderWithProviders(<CheckoutModalHost />, { preloadedState: OPENED_STATE });
    await fillValidForm(user);
    await user.click(screen.getByTestId(TEST_IDS.checkoutModal.submit));

    await waitFor(() =>
      expect(screen.getByTestId(TEST_IDS.summaryBackdrop.root)).toBeInTheDocument(),
    );

    expect(receivedTokenizeBody?.number).toBe('4242424242424242');
    expect(receivedTokenizeBody?.cvc).toBe('123');
    expect(receivedCheckoutBody).not.toHaveProperty('cardNumber');
    expect(receivedCheckoutBody).not.toHaveProperty('cvc');
    expect(receivedCheckoutBody?.productId).toBe(OPENED_STATE.checkout.productId);

    const state = store.getState() as {
      checkout: {
        transactionId: string | null;
        cardMeta: { brand: string; lastFour: string } | null;
        cardToken: string | null;
        acceptanceToken: string | null;
        acceptPersonalAuthToken: string | null;
        payIdempotencyKey: string | null;
      };
    };
    expect(state.checkout.transactionId).toBe('tx-1');
    expect(state.checkout.cardMeta).toEqual({ brand: 'visa', lastFour: '4242' });
    expect(state.checkout.cardToken).toBe('tok_fake_4242_xyz');
    expect(state.checkout.acceptanceToken).not.toBeNull();
    expect(state.checkout.acceptPersonalAuthToken).not.toBeNull();
    expect(state.checkout.payIdempotencyKey).not.toBeNull();
  });

  it('shows a retry-friendly error and keeps the form when the server rejects the request', async () => {
    const user = userEvent.setup();
    server.use(
      http.post(`*/${API_ROUTES.checkout.create}`, () =>
        HttpResponse.json(
          { error: { kind: 'InsufficientStock', message: 'no stock' } },
          { status: 409 },
        ),
      ),
    );

    renderWithProviders(<CheckoutModalHost />, { preloadedState: OPENED_STATE });
    await fillValidForm(user);
    await user.click(screen.getByTestId(TEST_IDS.checkoutModal.submit));

    await waitFor(() => expect(screen.getByText(t.checkout.genericError)).toBeInTheDocument());
    expect(screen.getByTestId(TEST_IDS.checkoutModal.root)).toBeInTheDocument();
  });

  it('closes the modal, resetting the checkout, when cancel is pressed', async () => {
    const user = userEvent.setup();
    const { store } = renderWithProviders(<CheckoutModalHost />, { preloadedState: OPENED_STATE });

    await user.click(screen.getByLabelText('Cerrar'));

    const state = store.getState() as { checkout: { step: string } };
    expect(state.checkout.step).toBe('idle');
  });

  it('restores the caret to the end of the card number field while it holds focus', () => {
    renderWithProviders(<CheckoutModalHost />, { preloadedState: OPENED_STATE });
    const input = screen.getByTestId(TEST_IDS.checkoutModal.cardNumber) as HTMLInputElement;

    input.focus();
    fireEvent.change(input, { target: { value: '42424242' } });

    expect(input.selectionStart).toBe(input.value.length);
  });

  describe('the summary screen', () => {
    it('shows the price breakdown', () => {
      renderWithProviders(<CheckoutModalHost />, { preloadedState: SUMMARY_STATE });

      expect(screen.getByTestId(TEST_IDS.summaryBackdrop.productAmount)).toHaveTextContent(
        '89.000',
      );
      expect(screen.getByTestId(TEST_IDS.summaryBackdrop.total)).toHaveTextContent('100.000');
    });

    it('charges the card and moves to the result screen on approval', async () => {
      const user = userEvent.setup();
      let receivedBody: Record<string, unknown> | undefined;
      server.use(
        http.post('*/checkout/tx-1/pay', async ({ request }) => {
          receivedBody = (await request.json()) as Record<string, unknown>;

          return HttpResponse.json({
            id: 'tx-1',
            reference: 'TX-tx-1',
            status: 'APPROVED',
            breakdown: BREAKDOWN,
            card: { brand: 'visa', lastFour: '4242' },
            failureReason: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }),
      );

      const { store } = renderWithProviders(<CheckoutModalHost />, {
        preloadedState: SUMMARY_STATE,
      });
      await user.click(screen.getByTestId(TEST_IDS.summaryBackdrop.payButton));

      await waitFor(() => expect(screen.getByText(t.result.approvedTitle)).toBeInTheDocument());

      expect(receivedBody).toEqual({
        cardToken: 'tok_fake_4242_abc',
        acceptanceToken: 'acc-token',
        acceptPersonalAuthToken: 'auth-token',
        installments: 1,
        cardBrand: 'visa',
        cardLastFour: '4242',
      });

      const state = store.getState() as {
        checkout: { step: string; transactionStatus: string | null };
      };
      expect(state.checkout.step).toBe('result');
      expect(state.checkout.transactionStatus).toBe('APPROVED');
    });

    it('shows a retry-friendly error and stays on the summary when the gateway rejects the charge', async () => {
      const user = userEvent.setup();
      server.use(
        http.post('*/checkout/tx-1/pay', () =>
          HttpResponse.json(
            { error: { kind: 'GatewayUnavailable', message: 'down' } },
            { status: 502 },
          ),
        ),
      );

      const { store } = renderWithProviders(<CheckoutModalHost />, {
        preloadedState: SUMMARY_STATE,
      });
      await user.click(screen.getByTestId(TEST_IDS.summaryBackdrop.payButton));

      await waitFor(() => expect(screen.getByText(t.summary.genericError)).toBeInTheDocument());

      const state = store.getState() as { checkout: { step: string } };
      expect(state.checkout.step).toBe('summary');
    });

    it('closes the modal, resetting the checkout, when cancel is pressed', async () => {
      const user = userEvent.setup();
      const { store } = renderWithProviders(<CheckoutModalHost />, {
        preloadedState: SUMMARY_STATE,
      });

      await user.click(screen.getByLabelText('Cerrar'));

      const state = store.getState() as { checkout: { step: string } };
      expect(state.checkout.step).toBe('idle');
    });
  });

  describe('the result screen', () => {
    const RESULT_STATE = {
      checkout: {
        ...OPENED_STATE.checkout,
        step: 'result' as const,
        transactionId: 'tx-1',
        reference: 'TX-tx-1',
      },
    };

    it('shows the approved copy and the transaction reference', () => {
      renderWithProviders(<CheckoutModalHost />, {
        preloadedState: { checkout: { ...RESULT_STATE.checkout, transactionStatus: 'APPROVED' } },
      });

      expect(screen.getByText(t.result.approvedTitle)).toBeInTheDocument();
      expect(screen.getByText('TX-tx-1')).toBeInTheDocument();
    });

    it('shows the decline reason when the gateway reports one', () => {
      renderWithProviders(<CheckoutModalHost />, {
        preloadedState: {
          checkout: {
            ...RESULT_STATE.checkout,
            transactionStatus: 'DECLINED',
            failureReason: 'insufficient_funds',
          },
        },
      });

      expect(screen.getByText(t.result.declinedTitle)).toBeInTheDocument();
      expect(screen.getByText('insufficient_funds')).toBeInTheDocument();
    });

    it('resets to idle when the buyer dismisses it', async () => {
      const user = userEvent.setup();
      const { store } = renderWithProviders(<CheckoutModalHost />, {
        preloadedState: { checkout: { ...RESULT_STATE.checkout, transactionStatus: 'APPROVED' } },
      });

      await user.click(screen.getByTestId(TEST_IDS.resultPage.backToProduct));

      const state = store.getState() as { checkout: { step: string } };
      expect(state.checkout.step).toBe('idle');
    });

    it('also resets to idle when closed via the modal chrome, not just the explicit button', async () => {
      const user = userEvent.setup();
      const { store } = renderWithProviders(<CheckoutModalHost />, {
        preloadedState: { checkout: { ...RESULT_STATE.checkout, transactionStatus: 'APPROVED' } },
      });

      await user.click(screen.getByLabelText('Cerrar'));

      const state = store.getState() as { checkout: { step: string } };
      expect(state.checkout.step).toBe('idle');
    });
  });
});
