import {
  API_ROUTES,
  IDEMPOTENCY_KEY_HEADER,
  type AcceptanceTokensDto,
  type CheckoutCreatedDto,
  type CreateCheckoutDto,
  type PayCheckoutDto,
  type TransactionDto,
} from '@payments/shared';
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

/**
 * Builds the checkout API slice for a given backend origin.
 *
 * A factory for the same reason as `createCatalogApi`: it keeps this module free
 * of `import.meta.env`, so it can be imported directly from Jest.
 */
export function createCheckoutApi(baseUrl: string) {
  return createApi({
    reducerPath: 'checkoutApi',
    baseQuery: fetchBaseQuery({ baseUrl }),
    endpoints: (builder) => ({
      createCheckout: builder.mutation<
        CheckoutCreatedDto,
        { body: CreateCheckoutDto; idempotencyKey: string }
      >({
        query: ({ body, idempotencyKey }) => ({
          url: API_ROUTES.checkout.create,
          method: 'POST',
          body,
          headers: { [IDEMPOTENCY_KEY_HEADER]: idempotencyKey },
        }),
      }),
      getAcceptanceTokens: builder.query<AcceptanceTokensDto, void>({
        query: () => API_ROUTES.checkout.acceptanceTokens,
      }),
      payCheckout: builder.mutation<
        TransactionDto,
        { transactionId: string; body: PayCheckoutDto; idempotencyKey: string }
      >({
        query: ({ transactionId, body, idempotencyKey }) => ({
          url: API_ROUTES.checkout.pay(transactionId),
          method: 'POST',
          body,
          headers: { [IDEMPOTENCY_KEY_HEADER]: idempotencyKey },
        }),
      }),
      getTransaction: builder.query<TransactionDto, string>({
        query: (transactionId) => API_ROUTES.transactions.detail(transactionId),
      }),
    }),
  });
}

export type CheckoutApi = ReturnType<typeof createCheckoutApi>;
