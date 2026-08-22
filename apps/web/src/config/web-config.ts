import { z } from 'zod';

const positiveInt = z.coerce.number().int().positive();

/**
 * Contract for the build-time environment exposed by Vite.
 *
 * Only `VITE_`-prefixed values reach the bundle, and none of them is a secret: the
 * PSP public key is fetched at runtime from the backend so no credential is ever
 * baked into a static asset served from CloudFront.
 */
const webEnvSchema = z.object({
  VITE_API_BASE_URL: z.string().url(),
  VITE_TRANSACTION_POLL_INTERVAL_MS: positiveInt.default(2_000),
  VITE_TRANSACTION_POLL_TIMEOUT_MS: positiveInt.default(180_000),
});

/** Validated, typed configuration consumed through {@link useConfig}. */
export interface WebConfig {
  readonly apiBaseUrl: string;
  readonly transactionPolling: {
    readonly intervalMs: number;
    readonly timeoutMs: number;
  };
}

/**
 * Validates the raw environment and projects it into {@link WebConfig}.
 *
 * @param source - Raw values, in production `import.meta.env`.
 * @throws Error naming every offending variable. A build that ships with a missing
 *   API URL would otherwise fail only once a user reached the checkout.
 */
export function loadWebConfig(source: Record<string, unknown>): WebConfig {
  const parsed = webEnvSchema.safeParse(source);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');

    throw new Error(`Invalid frontend environment configuration:\n${details}`);
  }

  const env = parsed.data;

  return {
    apiBaseUrl: env.VITE_API_BASE_URL.replace(/\/+$/, ''),
    transactionPolling: {
      intervalMs: env.VITE_TRANSACTION_POLL_INTERVAL_MS,
      timeoutMs: env.VITE_TRANSACTION_POLL_TIMEOUT_MS,
    },
  };
}
