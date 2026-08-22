import { z } from 'zod';

/**
 * Shared primitives of the API contract.
 *
 * Defined once and reused by both sides: the backend derives its DTOs from these
 * schemas and the frontend validates its forms with them, so a change to a rule is
 * a compile error on both sides rather than a runtime surprise on one.
 */

export const uuidSchema = z.string().uuid();

/**
 * Every amount crosses the wire as an integer number of cents.
 *
 * Never as a decimal: JSON numbers are IEEE-754 doubles, and a price that survives
 * serialisation as `189000.00000000001` is a support ticket waiting to happen. The
 * gateway itself takes `amount_in_cents`, so cents are also the native unit.
 */
export const amountInCentsSchema = z.number().int().nonnegative();

/** ISO-4217 alphabetic code. */
export const currencySchema = z
  .string()
  .length(3)
  .regex(/^[A-Z]{3}$/);

/** Itemised total, recomputed server-side and never accepted from the client. */
export const amountBreakdownSchema = z.object({
  productAmountInCents: amountInCentsSchema,
  baseFeeInCents: amountInCentsSchema,
  deliveryFeeInCents: amountInCentsSchema,
  totalInCents: amountInCentsSchema,
  currency: currencySchema,
});

export type AmountBreakdownDto = z.infer<typeof amountBreakdownSchema>;

/**
 * Uniform error envelope.
 *
 * `kind` mirrors the domain error union, so the frontend can branch on a stable
 * discriminator instead of pattern-matching prose that may be reworded.
 */
export const apiErrorSchema = z.object({
  error: z.object({
    kind: z.string().min(1),
    message: z.string().min(1),
    details: z.unknown().optional(),
  }),
});

export type ApiErrorDto = z.infer<typeof apiErrorSchema>;
