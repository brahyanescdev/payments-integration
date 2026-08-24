import { errAsync, okAsync, type ResultAsync } from 'neverthrow';

import { transactionNotFound, type DomainError } from '../../../shared/result/domain-error';
import type {
  RepositoryRegistry,
  UnitOfWork,
} from '../../../shared/unit-of-work/unit-of-work.port';
import type {
  GatewayStatus,
  PaymentGatewayPort,
} from '../../payments/domain/ports/payment-gateway.port';
import type { Transaction } from '../domain/transaction';
import type { SettleTransactionUseCase } from './settle-transaction.use-case';

/** Injection token for {@link GetTransactionUseCase}. */
export const GET_TRANSACTION_USE_CASE = Symbol('GET_TRANSACTION_USE_CASE');

/**
 * Reads a single transaction, or fails with `TransactionNotFound`.
 *
 * Backs the polling endpoint the result screen calls while a charge is still
 * `PENDING`: the projection this returns carries no card token and no customer
 * identification, only what a buyer watching their own purchase needs to see.
 *
 * A transaction still `PENDING` is also the trigger for the gateway's own
 * fallback settlement path: the webhook is the primary mechanism, but a shared
 * sandbox account's event URL is not ours to configure, so a request that
 * finds a stale `PENDING` transaction asks the gateway directly before
 * answering — the exact "status poll" the async payment flow was always meant
 * to support alongside webhooks.
 */
export class GetTransactionUseCase {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly gateway: PaymentGatewayPort,
    private readonly settleTransaction: SettleTransactionUseCase,
  ) {}

  execute(transactionId: string): ResultAsync<Transaction, DomainError> {
    return this.unitOfWork.run((repositories) =>
      repositories.transactions
        .findById(transactionId)
        .andThen((transaction) =>
          transaction === null
            ? errAsync(transactionNotFound(transactionId))
            : this.withFreshStatus(repositories, transaction),
        ),
    );
  }

  private withFreshStatus(
    repositories: RepositoryRegistry,
    transaction: Transaction,
  ): ResultAsync<Transaction, DomainError> {
    if (!transaction.isPending || transaction.gatewayTransactionId === null) {
      return okAsync(transaction);
    }

    return this.gateway
      .getTransactionStatus(transaction.gatewayTransactionId)
      .andThen((fresh) => this.settleIfTerminal(repositories, transaction, fresh))
      .orElse(() => okAsync(transaction)); // gateway unreachable: answer with what we have
  }

  private settleIfTerminal(
    repositories: RepositoryRegistry,
    transaction: Transaction,
    fresh: GatewayStatus,
  ): ResultAsync<Transaction, DomainError> {
    if (fresh.status === 'PENDING') {
      return okAsync(transaction);
    }

    return this.settleTransaction.settle(repositories, transaction, {
      status: fresh.status,
      failureReason: fresh.failureReason,
    });
  }
}
