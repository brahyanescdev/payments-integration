import { API_ROUTES, IDEMPOTENCY_KEY_HEADER } from '@payments/shared';
import { configureStore } from '@reduxjs/toolkit';
import { http, HttpResponse } from 'msw';

import { server } from '../../testing/msw/server';
import { createCheckoutApi } from './checkoutApi';

const REQUEST = {
  productId: '11111111-1111-4111-8111-111111111111',
  quantity: 1,
  customer: {
    email: 'ana@example.com',
    fullName: 'Ana Pérez',
    phone: '3001234567',
    legalId: '1020304050',
    legalIdType: 'CC' as const,
  },
  delivery: {
    recipientName: 'Ana Pérez',
    phone: '3001234567',
    addressLine1: 'Calle 100 # 15-20',
    addressLine2: null,
    city: 'Bogotá',
    region: 'Cundinamarca',
    country: 'CO',
    postalCode: '110111',
  },
};

function makeStore() {
  const checkoutApi = createCheckoutApi('http://api.example.test');
  const store = configureStore({
    reducer: { [checkoutApi.reducerPath]: checkoutApi.reducer },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(checkoutApi.middleware),
  });

  return { checkoutApi, store };
}

describe('createCheckoutApi', () => {
  it('sends the idempotency key as a request header', async () => {
    let receivedHeader: string | null = null;
    server.use(
      http.post(`*/${API_ROUTES.checkout.create}`, ({ request }) => {
        receivedHeader = request.headers.get(IDEMPOTENCY_KEY_HEADER);

        return HttpResponse.json(
          {
            transactionId: 'tx-1',
            reference: 'TX-1',
            status: 'PENDING',
            breakdown: {
              productAmountInCents: 1,
              baseFeeInCents: 1,
              deliveryFeeInCents: 1,
              totalInCents: 3,
              currency: 'COP',
            },
          },
          { status: 201 },
        );
      }),
    );

    const { checkoutApi, store } = makeStore();
    await store.dispatch(
      checkoutApi.endpoints.createCheckout.initiate({ body: REQUEST, idempotencyKey: 'idem-1' }),
    );

    expect(receivedHeader).toBe('idem-1');
  });

  it('surfaces a 409 conflict as an error result rather than throwing', async () => {
    server.use(
      http.post(`*/${API_ROUTES.checkout.create}`, () =>
        HttpResponse.json(
          { error: { kind: 'InsufficientStock', message: 'no stock' } },
          { status: 409 },
        ),
      ),
    );

    const { checkoutApi, store } = makeStore();
    const result = await store.dispatch(
      checkoutApi.endpoints.createCheckout.initiate({ body: REQUEST, idempotencyKey: 'idem-2' }),
    );

    expect(result.error).toBeDefined();
  });
});
