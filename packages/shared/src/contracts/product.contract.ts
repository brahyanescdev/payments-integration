import { z } from 'zod';

import { amountInCentsSchema, currencySchema, uuidSchema } from './common.contract';

/** A catalogue item as the storefront sees it. */
export const productSchema = z.object({
  id: uuidSchema,
  sku: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  priceInCents: amountInCentsSchema,
  currency: currencySchema,
  /**
   * Path relative to the SPA origin. Images are served from the same distribution
   * as the app, so they need no extra DNS lookup, no second TLS handshake and no
   * `img-src` exception in the content security policy.
   */
  imageUrl: z.string().min(1),
  stock: z.number().int().nonnegative(),
  /** Derived server-side so the storefront never re-implements the rule. */
  isAvailable: z.boolean(),
});

export type ProductDto = z.infer<typeof productSchema>;

export const productListSchema = z.object({
  items: z.array(productSchema),
  total: z.number().int().nonnegative(),
});

export type ProductListDto = z.infer<typeof productListSchema>;
