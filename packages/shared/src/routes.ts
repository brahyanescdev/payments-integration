/**
 * Single source of truth for every API path.
 *
 * The backend mounts its controllers from these values, the frontend builds its
 * requests from them, and the Playwright specs assert against them. One definition
 * means a renamed route breaks the build instead of silently breaking a caller at
 * runtime.
 *
 * Paths are relative to the configured global prefix (`API_GLOBAL_PREFIX`), which is
 * deployment configuration rather than part of the contract.
 */
export const API_ROUTES = {
  health: 'health',
  products: {
    list: 'products',
    detail: (productId: string) => `products/${productId}`,
  },
  checkout: {
    create: 'checkout',
    acceptanceTokens: 'checkout/acceptance-tokens',
    pay: (transactionId: string) => `checkout/${transactionId}/pay`,
  },
  transactions: {
    detail: (transactionId: string) => `transactions/${transactionId}`,
  },
  webhooks: {
    payments: 'webhooks/payments',
  },
} as const;

/**
 * Header carrying the client-generated idempotency key on mutating requests.
 * Shared so the interceptor, the HTTP client and the tests cannot drift apart.
 */
export const IDEMPOTENCY_KEY_HEADER = 'idempotency-key';
