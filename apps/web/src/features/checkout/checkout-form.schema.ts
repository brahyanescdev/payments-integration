import { customerInputSchema, deliveryInputSchema } from '@payments/shared';
import { z } from 'zod';

import { isValidCardNumber, isValidCvc, isValidExpiry, onlyDigits } from './card';

/**
 * Card fields, validated entirely on the client.
 *
 * These never reach our backend as raw values: `createCheckoutSchema` (the
 * actual request body) has no card fields at all. Real tokenisation against the
 * gateway's public key is the next vertical slice's concern; this stage collects
 * and validates what that step will need.
 */
export const cardInputSchema = z.object({
  cardNumber: z
    .string()
    .transform(onlyDigits)
    .refine(isValidCardNumber, { message: 'El número de tarjeta no es válido.' }),
  cardHolder: z.string().trim().min(3, 'Escribe el nombre tal como aparece en la tarjeta.'),
  expiry: z
    .string()
    .refine(isValidExpiry, { message: 'La fecha debe tener el formato MM/AA y no estar vencida.' }),
  cvc: z.string(),
});

/**
 * The whole Screen 2 form: card, buyer and delivery in one submission.
 *
 * `customerInputSchema`/`deliveryInputSchema` are imported straight from the
 * shared package — the same rules the backend enforces on `POST /checkout`, so a
 * value that passes here is guaranteed to pass there too.
 */
export const checkoutFormSchema = cardInputSchema
  .extend({
    customer: customerInputSchema,
    delivery: deliveryInputSchema,
  })
  .refine((value) => isValidCvc(value.cvc, 'unknown'), {
    message: 'El código de seguridad debe tener 3 o 4 dígitos.',
    path: ['cvc'],
  });

export type CheckoutFormValues = z.input<typeof checkoutFormSchema>;
