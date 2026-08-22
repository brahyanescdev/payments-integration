import { z } from 'zod';

import { amountBreakdownSchema, uuidSchema } from './common.contract';

export const transactionStatusSchema = z.enum([
  'PENDING',
  'APPROVED',
  'DECLINED',
  'VOIDED',
  'ERROR',
]);

export type TransactionStatusDto = z.infer<typeof transactionStatusSchema>;

/** Statuses from which a transaction never changes again. */
export const FINAL_TRANSACTION_STATUSES = ['APPROVED', 'DECLINED', 'VOIDED', 'ERROR'] as const;

export const isFinalStatus = (status: TransactionStatusDto): boolean =>
  (FINAL_TRANSACTION_STATUSES as readonly string[]).includes(status);

/**
 * Public projection of a transaction, safe to poll from the browser.
 *
 * Carries no card token, no gateway credential and no customer identification —
 * only what the result screen needs to render.
 */
export const transactionSchema = z.object({
  id: uuidSchema,
  reference: z.string().min(1),
  status: transactionStatusSchema,
  breakdown: amountBreakdownSchema,
  card: z
    .object({
      brand: z.string().min(1),
      lastFour: z.string().regex(/^\d{4}$/),
    })
    .nullable(),
  failureReason: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type TransactionDto = z.infer<typeof transactionSchema>;
