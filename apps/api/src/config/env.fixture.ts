/**
 * Builder for a complete, valid environment.
 *
 * Specs override only the variable under test, so a new required variable is added
 * in one place instead of across every configuration test.
 */
export function makeEnv(overrides: Record<string, string | undefined> = {}) {
  return {
    NODE_ENV: 'test',
    PORT: '3000',
    API_GLOBAL_PREFIX: 'api/v1',
    APP_VERSION: '1.2.3',
    CORS_ALLOWED_ORIGINS: 'http://localhost:5173',
    DATABASE_URL: 'postgresql://payments:payments@localhost:5432/payments',
    PAYMENT_GATEWAY_DRIVER: 'fake',
    PSP_BASE_URL: 'https://psp.example.test/v1',
    PSP_TIMEOUT_MS: '10000',
    CHECKOUT_CURRENCY: 'COP',
    CHECKOUT_BASE_FEE_IN_CENTS: '300000',
    CHECKOUT_DELIVERY_FEE_IN_CENTS: '800000',
    CHECKOUT_FREE_DELIVERY_THRESHOLD_IN_CENTS: '20000000',
    CHECKOUT_MAX_INSTALLMENTS: '36',
    IDEMPOTENCY_TTL_HOURS: '24',
    CATALOG_PAGE_SIZE: '20',
    THROTTLE_TTL_SECONDS: '60',
    THROTTLE_LIMIT: '30',
    ...overrides,
  };
}
