import { errAsync, okAsync, type ResultAsync } from 'neverthrow';

import { transactionNotFound, type DomainError } from '../../../shared/result/domain-error';
import type { UnitOfWork } from '../../../shared/unit-of-work/unit-of-work.port';
import type { Transaction } from '../domain/transaction';

/** Injection token for {@link GetTransactionUseCase}. */
export const GET_TRANSACTION_USE_CASE = Symbol('GET_TRANSACTION_USE_CASE');

/**
 * Reads a single transaction, or fails with `TransactionNotFound`.
 *
 * Backs the polling endpoint the result screen calls while a charge is still
 * `PENDING`: the projection this returns carries no card token and no customer
 * identification, only what a buyer watching their own purchase needs to see.
 */
export class GetTransactionUseCase {
  constructor(private readonly unitOfWork: UnitOfWork) {}

  execute(transactionId: string): ResultAsync<Transaction, DomainError> {
    return this.unitOfWork.run((repositories) =>
      repositories.transactions
        .findById(transactionId)
        .andThen((transaction) =>
          transaction === null
            ? errAsync(transactionNotFound(transactionId))
            : okAsync(transaction),
        ),
    );
  }
}
