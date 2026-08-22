/**
 * Configuration for the end-to-end harness.
 *
 * The only module in `e2e/` that reads raw environment values. Defaults match the
 * local `docker compose` stack so `pnpm e2e` works with no setup, while CI and the
 * evidence script override them explicitly.
 */
const asInt = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const harness = {
  apiPort: asInt(process.env.E2E_API_PORT, 3000),
  webPort: asInt(process.env.E2E_WEB_PORT, 4173),
  apiPrefix: process.env.E2E_API_PREFIX ?? 'api/v1',
  databaseUrl:
    process.env.E2E_DATABASE_URL ?? 'postgresql://payments:payments@localhost:5432/payments',
  /**
   * `fake` keeps runs deterministic and offline, which is what CI uses. `http`
   * drives the real sandbox and is reserved for generating release evidence, since
   * that account is shared and its session can be terminated from elsewhere.
   */
  gatewayDriver: process.env.E2E_GATEWAY_DRIVER ?? 'fake',
  /** Set by CI so the harness reuses the already-built artefacts. */
  isCi: process.env.CI === 'true',
} as const;

export const apiBaseUrl = `http://localhost:${harness.apiPort}/${harness.apiPrefix}`;
export const webBaseUrl = `http://localhost:${harness.webPort}`;

/** Environment handed to the API process started by Playwright. */
export const apiProcessEnv: Record<string, string> = {
  NODE_ENV: 'test',
  PORT: String(harness.apiPort),
  API_GLOBAL_PREFIX: harness.apiPrefix,
  APP_VERSION: '0.0.0-e2e',
  CORS_ALLOWED_ORIGINS: webBaseUrl,
  DATABASE_URL: harness.databaseUrl,
  PAYMENT_GATEWAY_DRIVER: harness.gatewayDriver,
  PSP_BASE_URL: process.env.PSP_BASE_URL ?? 'https://psp.invalid/v1',
  PSP_PUBLIC_KEY: process.env.PSP_PUBLIC_KEY ?? '',
  PSP_PRIVATE_KEY: process.env.PSP_PRIVATE_KEY ?? '',
  PSP_INTEGRITY_SECRET: process.env.PSP_INTEGRITY_SECRET ?? '',
  PSP_EVENTS_SECRET: process.env.PSP_EVENTS_SECRET ?? '',
  PSP_TIMEOUT_MS: '10000',
  CHECKOUT_CURRENCY: 'COP',
  CHECKOUT_BASE_FEE_IN_CENTS: '300000',
  CHECKOUT_DELIVERY_FEE_IN_CENTS: '800000',
  CHECKOUT_FREE_DELIVERY_THRESHOLD_IN_CENTS: '20000000',
  CHECKOUT_MAX_INSTALLMENTS: '36',
  IDEMPOTENCY_TTL_HOURS: '24',
  CATALOG_PAGE_SIZE: '20',
  THROTTLE_TTL_SECONDS: '60',
  THROTTLE_LIMIT: '1000',
};
