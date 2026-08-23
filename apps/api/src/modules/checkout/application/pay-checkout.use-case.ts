import { errAsync, okAsync, type Result, type ResultAsync } from 'neverthrow';

import type { Clock } from '../../../shared/clock/clock.port';
import {
  type DomainError,
  transactionNotFound,
  transactionNotPending,
} from '../../../shared/result/domain-error';
import type {
  RepositoryRegistry,
  UnitOfWork,
} from '../../../shared/unit-of-work/unit-of-work.port';
import type {
  ChargeResult,
  PaymentGatewayPort,
} from '../../payments/domain/ports/payment-gateway.port';
import type { CardFingerprint, Transaction } from '../domain/transaction';
import type { SettleTransactionUseCase } from './settle-transaction.use-case';

/** Injection token for {@link PayCheckoutUseCase}. */
export const PAY_CHECKOUT_USE_CASE = Symbol('PAY_CHECKOUT_USE_CASE');

export interface PayCheckoutInput {
  readonly cardToken: string;
  readonly acceptanceToken: string;
  readonly acceptPersonalAuthToken: string;
  readonly installments: number;
  readonly cardBrand: string;
  readonly cardLastFour: string;
}

/**
 * Submits the charge for an already-open transaction.
 *
 * Card data never passes through here: the browser tokenised it directly against
 * the gateway with the public key in the previous screen, so this only ever
 * forwards a single-use token, never a PAN. Whatever the gateway reports
 * synchronously is applied immediately through {@link SettleTransactionUseCase} —
 * a transaction that stays `PENDING` is left exactly as reserved, for the
 * webhook to resolve later.
 */
export class PayCheckoutUseCase {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly gateway: PaymentGatewayPort,
    private readonly settleTransaction: SettleTransactionUseCase,
    private readonly clock: Clock,
  ) {}

  execute(transactionId: string, input: PayCheckoutInput): ResultAsync<Transaction, DomainError> {
    return this.unitOfWork.run((repositories) =>
      this.loadPendingTransaction(repositories, transactionId)
        .andThen((transaction) => this.attachCard(transaction, input))
        .andThen((transaction) => this.chargeAndLink(repositories, transaction, input)),
    );
  }

  private loadPendingTransaction(
    repositories: RepositoryRegistry,
    transactionId: string,
  ): ResultAsync<Transaction, DomainError> {
    return repositories.transactions.findById(transactionId).andThen((transaction) => {
      if (transaction === null) {
        return errAsync(transactionNotFound(transactionId));
      }

      if (!transaction.isPending) {
        return errAsync(transactionNotPending(transaction.id, transaction.status));
      }

      return okAsync(transaction);
    });
  }

  /** Synchronous, unlike its neighbours: `Transaction.attachCard` mutates in memory. */
  private attachCard(
    transaction: Transaction,
    input: PayCheckoutInput,
  ): Result<Transaction, DomainError> {
    const card: CardFingerprint = { brand: input.cardBrand, lastFour: input.cardLastFour };

    return transaction.attachCard(card, this.clock.now()).map(() => transaction);
  }

  private chargeAndLink(
    repositories: RepositoryRegistry,
    transaction: Transaction,
    input: PayCheckoutInput,
  ): ResultAsync<Transaction, DomainError> {
    return repositories.customers
      .findById(transaction.customerId)
      .andThen((customer) => {
        if (customer === null) {
          return errAsync(transactionNotFound(transaction.id));
        }

        return this.gateway.chargeCard({
          reference: transaction.reference,
          amountInCents: transaction.breakdown.total.amountInCents,
          currency: transaction.breakdown.currency,
          customerEmail: customer.email.value,
          cardToken: input.cardToken,
          acceptanceToken: input.acceptanceToken,
          acceptPersonalAuthToken: input.acceptPersonalAuthToken,
          installments: input.installments,
        });
      })
      .andThen((chargeResult) => this.linkAndApply(repositories, transaction, chargeResult));
  }

  private linkAndApply(
    repositories: RepositoryRegistry,
    transaction: Transaction,
    chargeResult: ChargeResult,
  ): ResultAsync<Transaction, DomainError> {
    return transaction
      .linkToGateway(chargeResult.gatewayTransactionId, this.clock.now())
      .asyncAndThen(() => repositories.transactions.save(transaction))
      .andThen(() => {
        if (chargeResult.status === 'PENDING') {
          return okAsync(transaction);
        }

        return this.settleTransaction.settle(repositories, transaction, {
          status: chargeResult.status,
          failureReason: chargeResult.failureReason,
        });
      });
  }
}
