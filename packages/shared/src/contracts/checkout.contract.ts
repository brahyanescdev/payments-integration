import { z } from 'zod';

import { amountBreakdownSchema, uuidSchema } from './common.contract';

/** Government identification types accepted in Colombia. */
export const legalIdTypeSchema = z.enum(['CC', 'CE', 'NIT', 'PP']);

export const customerInputSchema = z.object({
  email: z.string().email().max(254),
  fullName: z.string().trim().min(3).max(160),
  phone: z
    .string()
    .trim()
    .regex(/^\d{7,15}$/, 'Debe tener entre 7 y 15 dígitos'),
  legalId: z.string().trim().min(5).max(32),
  legalIdType: legalIdTypeSchema,
});

export const deliveryInputSchema = z.object({
  recipientName: z.string().trim().min(3).max(160),
  phone: z
    .string()
    .trim()
    .regex(/^\d{7,15}$/, 'Debe tener entre 7 y 15 dígitos'),
  addressLine1: z.string().trim().min(5).max(200),
  addressLine2: z.string().trim().max(200).nullable().default(null),
  city: z.string().trim().min(2).max(120),
  region: z.string().trim().min(2).max(120),
  country: z.string().trim().length(2).toUpperCase(),
  postalCode: z.string().trim().min(3).max(20),
});

/**
 * Opens a checkout: creates the customer, the delivery and a `PENDING` transaction,
 * and reserves stock.
 *
 * Note what is *absent*: no amount. The client states what it wants to buy, and the
 * server prices it. Accepting a total from the browser would make the price
 * editable by whoever opens the developer tools.
 */
export const createCheckoutSchema = z.object({
  productId: uuidSchema,
  quantity: z.number().int().positive().max(50),
  customer: customerInputSchema,
  delivery: deliveryInputSchema,
});

export type CreateCheckoutDto = z.infer<typeof createCheckoutSchema>;

export const checkoutCreatedSchema = z.object({
  transactionId: uuidSchema,
  reference: z.string().min(1).max(255),
  status: z.literal('PENDING'),
  breakdown: amountBreakdownSchema,
});

export type CheckoutCreatedDto = z.infer<typeof checkoutCreatedSchema>;

/**
 * Submits the charge for an already-open transaction.
 *
 * The card itself never appears here. The browser tokenises it directly against the
 * gateway with the public key, and only the resulting single-use token reaches this
 * API — which is what keeps the PAN out of our logs, our database and our backups.
 */
export const payCheckoutSchema = z.object({
  cardToken: z.string().min(1),
  acceptanceToken: z.string().min(1),
  acceptPersonalAuthToken: z.string().min(1),
  installments: z.number().int().positive().max(36),
  /** Display metadata returned by tokenisation; never the full number. */
  cardBrand: z.string().min(1).max(32),
  cardLastFour: z.string().regex(/^\d{4}$/),
});

export type PayCheckoutDto = z.infer<typeof payCheckoutSchema>;

/**
 * Terms the buyer must accept, proxied from the gateway.
 *
 * Served by our API rather than fetched by the browser so the public key and the
 * gateway's base URL stay configuration of one deployment instead of being baked
 * into a static bundle at build time.
 */
export const acceptanceTokensSchema = z.object({
  publicKey: z.string().min(1),
  acceptance: z.object({
    token: z.string().min(1),
    permalink: z.string().url(),
  }),
  personalDataAuthorization: z.object({
    token: z.string().min(1),
    permalink: z.string().url(),
  }),
});

export type AcceptanceTokensDto = z.infer<typeof acceptanceTokensSchema>;
