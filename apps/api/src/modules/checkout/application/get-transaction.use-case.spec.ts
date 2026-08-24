import { errAsync, okAsync } from 'neverthrow';

import { gatewayUnavailable } from '../../../shared/result/domain-error';
import { FixedClock } from '../../../shared/clock/clock.port';
import { SequentialIdGenerator } from '../../../shared/id/id-generator.port';
import { FakeUnitOfWork, InMemoryProductRepository } from '../../../testing/fakes';
import { makeProduct, makeTransaction } from '../../../testing/builders';
import type { RepositoryRegistry } from '../../../shared/unit-of-work/unit-of-work.port';
import type {
  GatewayStatus,
  PaymentGatewayPort,
} from '../../payments/domain/ports/payment-gateway.port';
import type { StockMovement } from '../domain/stock-movement';
import type { Transaction } from '../domain/transaction';
import { GetTransactionUseCase } from './get-transaction.use-case';
import { SettleTransactionUseCase } from './settle-transaction.use-case';

const PRODUCT_ID = '11111111-1111-4111-8111-111111111111';
const NOW = new Date('2026-08-24T00:00:00.000Z');

/** Keyed by id so `findById` in the fake repository below can resolve it. */
const store = new Map<string, Transaction>();

function makeRepositories(stock = 3) {
  const products = new InMemoryProductRepository().seed([makeProduct({ id: PRODUCT_ID, stock })]);
  const savedTransactions: Transaction[] = [];
  const appendedMovements: StockMovement[] = [];

  return {
    repositories: {
      products,
      transactions: {
        findById: (id: string) => okAsync(store.get(id) ?? null),
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
    appendedMovements,
  };
}

function gatewayThatReturns(result: GatewayStatus): PaymentGatewayPort {
  return {
    getAcceptanceTokens: () => errAsync(gatewayUnavailable('not used in this test')),
    chargeCard: () => errAsync(gatewayUnavailable('not used in this test')),
    getTransactionStatus: () => okAsync(result),
  };
}

function gatewayThatFails(): PaymentGatewayPort {
  return {
    getAcceptanceTokens: () => errAsync(gatewayUnavailable('not used in this test')),
    chargeCard: () => errAsync(gatewayUnavailable('not used in this test')),
    getTransactionStatus: () => errAsync(gatewayUnavailable('sandbox is unreachable')),
  };
}

function makeUseCase(repositories: RepositoryRegistry, gateway: PaymentGatewayPort) {
  return new GetTransactionUseCase(
    new FakeUnitOfWork(repositories),
    gateway,
    new SettleTransactionUseCase(new FixedClock(NOW), new SequentialIdGenerator('mv')),
  );
}

describe('GetTransactionUseCase', () => {
  afterEach(() => store.clear());

  it('returns the transaction when it exists, without asking the gateway if it already settled', async () => {
    const transaction = makeTransaction({ id: 'tx-1' });
    transaction.settle('APPROVED', NOW, null);
    store.set('tx-1', transaction);
    const { repositories } = makeRepositories();
    const gateway = gatewayThatFails();

    const result = await makeUseCase(repositories, gateway).execute('tx-1');

    expect(result._unsafeUnwrap()).toBe(transaction);
  });

  it('fails with TransactionNotFound for an unknown id', async () => {
    const { repositories } = makeRepositories();

    const result = await makeUseCase(repositories, gatewayThatFails()).execute('missing');

    expect(result._unsafeUnwrapErr().kind).toBe('TransactionNotFound');
  });

  it('leaves a PENDING transaction untouched when it was never linked to the gateway', async () => {
    const transaction = makeTransaction({ id: 'tx-2' });
    store.set('tx-2', transaction);
    const { repositories } = makeRepositories();
    const gateway = gatewayThatFails();

    const result = await makeUseCase(repositories, gateway).execute('tx-2');

    expect(result._unsafeUnwrap().status).toBe('PENDING');
  });

  it('settles a PENDING transaction once the gateway reports a terminal status — the fallback for a webhook that can never reach us', async () => {
    const transaction = makeTransaction({ id: 'tx-3', productId: PRODUCT_ID, quantity: 2 });
    transaction.linkToGateway('gw-3', NOW);
    store.set('tx-3', transaction);
    const { repositories, appendedMovements } = makeRepositories(3);
    const gateway = gatewayThatReturns({ status: 'APPROVED', failureReason: null });

    const result = await makeUseCase(repositories, gateway).execute('tx-3');

    expect(result._unsafeUnwrap().status).toBe('APPROVED');
    expect(appendedMovements).toEqual([expect.objectContaining({ type: 'COMMIT', quantity: 2 })]);
  });

  it('leaves a PENDING transaction untouched when the gateway still reports it PENDING', async () => {
    const transaction = makeTransaction({ id: 'tx-4' });
    transaction.linkToGateway('gw-4', NOW);
    store.set('tx-4', transaction);
    const { repositories, appendedMovements } = makeRepositories();
    const gateway = gatewayThatReturns({ status: 'PENDING', failureReason: null });

    const result = await makeUseCase(repositories, gateway).execute('tx-4');

    expect(result._unsafeUnwrap().status).toBe('PENDING');
    expect(appendedMovements).toEqual([]);
  });

  it('answers with the stale transaction when the gateway is unreachable, rather than failing the request', async () => {
    const transaction = makeTransaction({ id: 'tx-5' });
    transaction.linkToGateway('gw-5', NOW);
    store.set('tx-5', transaction);
    const { repositories } = makeRepositories();

    const result = await makeUseCase(repositories, gatewayThatFails()).execute('tx-5');

    expect(result._unsafeUnwrap().status).toBe('PENDING');
  });
});
