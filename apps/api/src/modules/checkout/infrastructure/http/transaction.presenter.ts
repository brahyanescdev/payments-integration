import type { TransactionDto } from '@payments/shared';

import type { Transaction } from '../../domain/transaction';

/** Translates a transaction into its public projection — never the customer, never a card token. */
export function toTransactionDto(transaction: Transaction): TransactionDto {
  const snapshot = transaction.toSnapshot();
  const breakdown = snapshot.breakdown;

  return {
    id: snapshot.id,
    reference: snapshot.reference,
    status: snapshot.status,
    breakdown: {
      productAmountInCents: breakdown.productAmount.amountInCents,
      baseFeeInCents: breakdown.baseFee.amountInCents,
      deliveryFeeInCents: breakdown.deliveryFee.amountInCents,
      totalInCents: breakdown.total.amountInCents,
      currency: breakdown.currency,
    },
    card: snapshot.card,
    failureReason: snapshot.failureReason,
    createdAt: snapshot.createdAt.toISOString(),
    updatedAt: snapshot.updatedAt.toISOString(),
  };
}
