import { z } from 'zod';

/** Parses `a, b,c` into `['a', 'b', 'c']`, dropping empty entries. */
const commaSeparatedOrigins = z
  .string()
  .transform((value) =>
    value
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  )
  .pipe(z.array(z.string().url()).min(1));

/** Money is handled in integer cents end to end; floats never enter the system. */
const centsAmount = z.coerce.number().int().nonnegative();

const positiveInt = z.coerce.number().int().positive();

/**
 * Contract for the process environment.
 *
 * Every runtime knob the application reads is declared here exactly once. Nothing
 * downstream touches `process.env`, which is what keeps configuration out of the
 * business code and makes a misconfigured deployment fail at boot rather than
 * halfway through a payment.
 */
export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: positiveInt.default(3000),
    API_GLOBAL_PREFIX: z.string().min(1).default('api/v1'),
    APP_VERSION: z.string().min(1).default('0.0.0-dev'),
    CORS_ALLOWED_ORIGINS: commaSeparatedOrigins,

    DATABASE_URL: z.string().url(),

    // `fake` keeps CI deterministic; `http` talks to the real sandbox.
    PAYMENT_GATEWAY_DRIVER: z.enum(['http', 'fake']).default('fake'),
    PSP_BASE_URL: z.string().url(),
    PSP_PUBLIC_KEY: z.string().optional(),
    PSP_PRIVATE_KEY: z.string().optional(),
    PSP_INTEGRITY_SECRET: z.string().optional(),
    PSP_EVENTS_SECRET: z.string().optional(),
    PSP_TIMEOUT_MS: positiveInt.default(10_000),

    CHECKOUT_CURRENCY: z.string().length(3),
    CHECKOUT_BASE_FEE_IN_CENTS: centsAmount,
    CHECKOUT_DELIVERY_FEE_IN_CENTS: centsAmount,
    CHECKOUT_FREE_DELIVERY_THRESHOLD_IN_CENTS: centsAmount,
    CHECKOUT_MAX_INSTALLMENTS: positiveInt,

    IDEMPOTENCY_TTL_HOURS: positiveInt,
    CATALOG_PAGE_SIZE: positiveInt,
    THROTTLE_TTL_SECONDS: positiveInt,
    THROTTLE_LIMIT: positiveInt,
  })
  .superRefine((env, ctx) => {
    // Credentials are only meaningful for the real gateway. Demanding them when the
    // fake adapter is in use would force CI to carry secrets it never sends anywhere.
    if (env.PAYMENT_GATEWAY_DRIVER !== 'http') return;

    const required = [
      'PSP_PUBLIC_KEY',
      'PSP_PRIVATE_KEY',
      'PSP_INTEGRITY_SECRET',
      'PSP_EVENTS_SECRET',
    ] as const;

    for (const key of required) {
      if (!env[key]) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: `is required when PAYMENT_GATEWAY_DRIVER is "http"`,
        });
      }
    }
  });

export type Env = z.infer<typeof envSchema>;
