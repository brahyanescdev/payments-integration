import type { CheckoutCreatedDto } from '@payments/shared';

import type { Transaction } from '../../domain/transaction';

/** Translates the newly opened transaction into the wire contract. */
export function toCheckoutCreatedDto(transaction: Transaction): CheckoutCreatedDto {
  const breakdown = transaction.breakdown;

  return {
    transactionId: transaction.id,
    reference: transaction.reference,
    status: 'PENDING',
    breakdown: {
      productAmountInCents: breakdown.productAmount.amountInCents,
      baseFeeInCents: breakdown.baseFee.amountInCents,
      deliveryFeeInCents: breakdown.deliveryFee.amountInCents,
      totalInCents: breakdown.total.amountInCents,
      currency: breakdown.currency,
    },
  };
}
