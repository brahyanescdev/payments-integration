import { okAsync } from 'neverthrow';

import { FakeUnitOfWork } from '../../../testing/fakes';
import { makeTransaction } from '../../../testing/builders';
import type { RepositoryRegistry } from '../../../shared/unit-of-work/unit-of-work.port';
import { GetTransactionUseCase } from './get-transaction.use-case';

describe('GetTransactionUseCase', () => {
  it('returns the transaction when it exists', async () => {
    const transaction = makeTransaction({ id: 'tx-1' });
    const repositories = {
      transactions: { findById: (id: string) => okAsync(id === 'tx-1' ? transaction : null) },
    } as unknown as RepositoryRegistry;

    const result = await new GetTransactionUseCase(new FakeUnitOfWork(repositories)).execute(
      'tx-1',
    );

    expect(result._unsafeUnwrap()).toBe(transaction);
  });

  it('fails with TransactionNotFound for an unknown id', async () => {
    const repositories = {
      transactions: { findById: () => okAsync(null) },
    } as unknown as RepositoryRegistry;

    const result = await new GetTransactionUseCase(new FakeUnitOfWork(repositories)).execute(
      'missing',
    );

    expect(result._unsafeUnwrapErr().kind).toBe('TransactionNotFound');
  });
});
