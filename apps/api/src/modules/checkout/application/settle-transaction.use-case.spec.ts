import { FakeUnitOfWork, InMemoryProductRepository } from '../../../testing/fakes';
import { FixedClock } from '../../../shared/clock/clock.port';
import { SequentialIdGenerator } from '../../../shared/id/id-generator.port';
import { makeProduct, makeTransaction } from '../../../testing/builders';
import type { RepositoryRegistry } from '../../../shared/unit-of-work/unit-of-work.port';
import type { StockMovement } from '../domain/stock-movement';
import type { Transaction } from '../domain/transaction';
import { SettleTransactionUseCase } from './settle-transaction.use-case';

const PRODUCT_ID = '11111111-1111-4111-8111-111111111111';
const NOW = new Date('2026-08-23T00:00:00.000Z');

function makeRepositories(stock: number) {
  const products = new InMemoryProductRepository().seed([makeProduct({ id: PRODUCT_ID, stock })]);
  const savedTransactions: Transaction[] = [];
  const appendedMovements: StockMovement[] = [];

  const { okAsync } = jest.requireActual('neverthrow');

  return {
    repositories: {
      products,
      transactions: {
        save: (transaction: Transaction) => {
          savedTransactions.push(transaction);
          return okAsync(undefined);
        },
      },
      stockMovements: {
        append: (movement: StockMovement) => {
          appendedMovements.push(movement);
          return okAsync(undefined);
        },
      },
    } as unknown as RepositoryRegistry,
    products,
    savedTransactions,
    appendedMovements,
  };
}

function makeSettler() {
  return new SettleTransactionUseCase(new FixedClock(NOW), new SequentialIdGenerator('mv'));
}

describe('SettleTransactionUseCase', () => {
  it('approves the transaction and records a COMMIT without touching stock further', async () => {
    const { repositories, products, appendedMovements } = makeRepositories(3);
    const transaction = makeTransaction({ productId: PRODUCT_ID, quantity: 2 });
    const unitOfWork = new FakeUnitOfWork(repositories);

    const result = await unitOfWork.run((repos) =>
      makeSettler().settle(repos, transaction, { status: 'APPROVED', failureReason: null }),
    );

    expect(result._unsafeUnwrap().status).toBe('APPROVED');
    expect(appendedMovements).toEqual([expect.objectContaining({ type: 'COMMIT', quantity: 2 })]);
    // Stock stays at whatever it already was after reservation — approval commits
    // the units already taken, it does not decrement them a second time.
    const reloaded = (await products.findById(PRODUCT_ID))._unsafeUnwrap();
    expect(reloaded?.stock).toBe(3);
  });

  it('declines the transaction and releases the reserved units back to the shelf', async () => {
    const { repositories, products, appendedMovements } = makeRepositories(3);
    const transaction = makeTransaction({ productId: PRODUCT_ID, quantity: 2 });
    const unitOfWork = new FakeUnitOfWork(repositories);

    const result = await unitOfWork.run((repos) =>
      makeSettler().settle(repos, transaction, {
        status: 'DECLINED',
        failureReason: 'INSUFFICIENT_FUNDS',
      }),
    );

    expect(result._unsafeUnwrap().status).toBe('DECLINED');
    expect(result._unsafeUnwrap().failureReason).toBe('INSUFFICIENT_FUNDS');
    expect(appendedMovements).toEqual([expect.objectContaining({ type: 'RELEASE', quantity: 2 })]);
    const reloaded = (await products.findById(PRODUCT_ID))._unsafeUnwrap();
    expect(reloaded?.stock).toBe(5);
  });

  it('releases stock for an ERROR outcome too, the same as a decline', async () => {
    const { repositories, products } = makeRepositories(3);
    const transaction = makeTransaction({ productId: PRODUCT_ID, quantity: 1 });
    const unitOfWork = new FakeUnitOfWork(repositories);

    await unitOfWork.run((repos) =>
      makeSettler().settle(repos, transaction, { status: 'ERROR', failureReason: 'GENERIC_ERROR' }),
    );

    const reloaded = (await products.findById(PRODUCT_ID))._unsafeUnwrap();
    expect(reloaded?.stock).toBe(4);
  });

  it('refuses to settle a transaction that is already final, protecting against a duplicate call', async () => {
    const { repositories } = makeRepositories(3);
    const transaction = makeTransaction({ productId: PRODUCT_ID, quantity: 1 });
    transaction.settle('APPROVED', NOW);
    const unitOfWork = new FakeUnitOfWork(repositories);

    const result = await unitOfWork.run((repos) =>
      makeSettler().settle(repos, transaction, { status: 'DECLINED', failureReason: 'late event' }),
    );

    expect(result._unsafeUnwrapErr().kind).toBe('TransactionNotPending');
  });

  it('fails with ProductNotFound rather than silently skipping the release', async () => {
    const { repositories } = makeRepositories(3);
    const transaction = makeTransaction({ productId: 'does-not-exist', quantity: 1 });
    const unitOfWork = new FakeUnitOfWork(repositories);

    const result = await unitOfWork.run((repos) =>
      makeSettler().settle(repos, transaction, { status: 'DECLINED', failureReason: 'no funds' }),
    );

    expect(result._unsafeUnwrapErr().kind).toBe('ProductNotFound');
  });
});
