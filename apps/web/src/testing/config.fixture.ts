import type { WebConfig } from '../config/web-config';

/** Valid frontend configuration for specs; override only what the case exercises. */
export function makeWebConfig(overrides: Partial<WebConfig> = {}): WebConfig {
  return {
    apiBaseUrl: 'http://localhost:3000/api/v1',
    transactionPolling: { intervalMs: 2_000, timeoutMs: 180_000 },
    ...overrides,
  };
}

/** Raw `import.meta.env`-shaped values, for exercising the validator itself. */
export function makeWebEnv(overrides: Record<string, string | undefined> = {}) {
  return {
    VITE_API_BASE_URL: 'http://localhost:3000/api/v1',
    VITE_TRANSACTION_POLL_INTERVAL_MS: '2000',
    VITE_TRANSACTION_POLL_TIMEOUT_MS: '180000',
    ...overrides,
  };
}
