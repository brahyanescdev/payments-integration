import type { GatewayModeDto, TransactionDto } from '@payments/shared';

import type { PspDriver } from '../../../../config/app.config';
import type { Transaction } from '../../domain/transaction';

/** The driver name is an internal detail; the DTO reports what it means for the buyer instead. */
function toGatewayMode(driver: PspDriver): GatewayModeDto {
  return driver === 'fake' ? 'fake' : 'sandbox';
}

/** Translates a transaction into its public projection — never the customer, never a card token. */
export function toTransactionDto(
  transaction: Transaction,
  gatewayDriver: PspDriver,
): TransactionDto {
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
    gatewayMode: toGatewayMode(gatewayDriver),
    createdAt: snapshot.createdAt.toISOString(),
    updatedAt: snapshot.updatedAt.toISOString(),
  };
}
