import { envSchema, type Env } from './env.schema';

/**
 * Application configuration, grouped by the concern that consumes it.
 *
 * Consumers receive this object rather than raw strings, so a fee is always a
 * validated integer amount of cents and a timeout is always a number of
 * milliseconds — no parsing, no defaults and no `??` fallbacks scattered around
 * the codebase.
 */
export interface AppConfig {
  readonly nodeEnv: Env['NODE_ENV'];
  readonly port: number;
  readonly globalPrefix: string;
  readonly version: string;
  readonly corsAllowedOrigins: readonly string[];
  readonly database: {
    readonly url: string;
  };
  readonly psp: {
    readonly driver: Env['PAYMENT_GATEWAY_DRIVER'];
    readonly baseUrl: string;
    readonly publicKey: string;
    readonly privateKey: string;
    readonly integritySecret: string;
    readonly eventsSecret: string;
    readonly timeoutMs: number;
  };
  readonly checkout: {
    readonly currency: string;
    readonly baseFeeInCents: number;
    readonly deliveryFeeInCents: number;
    readonly freeDeliveryThresholdInCents: number;
    readonly maxInstallments: number;
  };
  readonly reliability: {
    readonly idempotencyTtlHours: number;
    readonly catalogPageSize: number;
    readonly throttleTtlSeconds: number;
    readonly throttleLimit: number;
  };
}

/** Injection token for {@link AppConfig}. */
export const APP_CONFIG = Symbol('APP_CONFIG');

/**
 * Validates the raw environment and projects it into {@link AppConfig}.
 *
 * @param source - Raw environment values, typically `process.env`.
 * @throws Error listing every offending variable by name when validation fails.
 *   Failing loudly at boot is deliberate: a payment service that starts with a
 *   missing integrity secret would only reveal the problem mid-transaction.
 */
export function loadAppConfig(source: Record<string, unknown>): AppConfig {
  const parsed = envSchema.safeParse(source);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');

    throw new Error(`Invalid environment configuration:\n${details}`);
  }

  const env = parsed.data;

  return {
    nodeEnv: env.NODE_ENV,
    port: env.PORT,
    globalPrefix: env.API_GLOBAL_PREFIX,
    version: env.APP_VERSION,
    corsAllowedOrigins: env.CORS_ALLOWED_ORIGINS,
    database: {
      url: env.DATABASE_URL,
    },
    psp: {
      driver: env.PAYMENT_GATEWAY_DRIVER,
      baseUrl: env.PSP_BASE_URL,
      publicKey: env.PSP_PUBLIC_KEY ?? '',
      privateKey: env.PSP_PRIVATE_KEY ?? '',
      integritySecret: env.PSP_INTEGRITY_SECRET ?? '',
      eventsSecret: env.PSP_EVENTS_SECRET ?? '',
      timeoutMs: env.PSP_TIMEOUT_MS,
    },
    checkout: {
      currency: env.CHECKOUT_CURRENCY,
      baseFeeInCents: env.CHECKOUT_BASE_FEE_IN_CENTS,
      deliveryFeeInCents: env.CHECKOUT_DELIVERY_FEE_IN_CENTS,
      freeDeliveryThresholdInCents: env.CHECKOUT_FREE_DELIVERY_THRESHOLD_IN_CENTS,
      maxInstallments: env.CHECKOUT_MAX_INSTALLMENTS,
    },
    reliability: {
      idempotencyTtlHours: env.IDEMPOTENCY_TTL_HOURS,
      catalogPageSize: env.CATALOG_PAGE_SIZE,
      throttleTtlSeconds: env.THROTTLE_TTL_SECONDS,
      throttleLimit: env.THROTTLE_LIMIT,
    },
  };
}
