import { errAsync, okAsync, ResultAsync } from 'neverthrow';

import { FakeUnitOfWork, InMemoryProductRepository } from '../../../testing/fakes';
import { FixedClock } from '../../../shared/clock/clock.port';
import { SequentialIdGenerator } from '../../../shared/id/id-generator.port';
import { Email } from '../../../shared/domain/email';
import { gatewayUnavailable } from '../../../shared/result/domain-error';
import { makeProduct, makeTransaction } from '../../../testing/builders';
import type { RepositoryRegistry } from '../../../shared/unit-of-work/unit-of-work.port';
import { Customer } from '../domain/customer';
import type {
  ChargeResult,
  PaymentGatewayPort,
} from '../../payments/domain/ports/payment-gateway.port';
import { PayCheckoutUseCase } from './pay-checkout.use-case';
import { SettleTransactionUseCase } from './settle-transaction.use-case';

const PRODUCT_ID = '11111111-1111-4111-8111-111111111111';
const CUSTOMER_ID = '33333333-3333-4333-8333-333333333333';
const NOW = new Date('2026-08-23T00:00:00.000Z');

const PAY_INPUT = {
  cardToken: 'tok_fake_4242_abc',
  acceptanceToken: 'acc',
  acceptPersonalAuthToken: 'priv',
  installments: 1,
  cardBrand: 'visa',
  cardLastFour: '4242',
};

function makeCustomer() {
  return Customer.rehydrate({
    id: CUSTOMER_ID,
    email: Email.create('ana@example.com')._unsafeUnwrap(),
    fullName: 'Ana Pérez',
    phone: '3001234567',
    legalId: '1020304050',
    legalIdType: 'CC',
    createdAt: NOW,
  });
}

function makeRepositories() {
  const products = new InMemoryProductRepository().seed([
    makeProduct({ id: PRODUCT_ID, stock: 3 }),
  ]);
  const savedTransactions: unknown[] = [];

  return {
    repositories: {
      products,
      transactions: {
        findById: (id: string) =>
          okAsync(id === 'missing' ? null : makeTransaction({ id, productId: PRODUCT_ID })),
        save: (transaction: unknown) => {
          savedTransactions.push(transaction);
          return okAsync(undefined);
        },
      },
      customers: {
        findById: (id: string) => okAsync(id === CUSTOMER_ID ? makeCustomer() : null),
      },
      stockMovements: { append: () => okAsync(undefined) },
    } as unknown as RepositoryRegistry,
    products,
    savedTransactions,
  };
}

function makeUseCase(repositories: RepositoryRegistry, gateway: PaymentGatewayPort) {
  return new PayCheckoutUseCase(
    new FakeUnitOfWork(repositories),
    gateway,
    new SettleTransactionUseCase(new FixedClock(NOW), new SequentialIdGenerator('mv')),
    new FixedClock(NOW),
  );
}

const gatewayThatReturns = (result: ChargeResult): PaymentGatewayPort => ({
  getAcceptanceTokens: () => errAsync(gatewayUnavailable('not used in this test')),
  chargeCard: () => okAsync(result),
});

describe('PayCheckoutUseCase', () => {
  it('charges the card and settles APPROVED immediately, committing the reserved stock', async () => {
    const { repositories } = makeRepositories();
    const gateway = gatewayThatReturns({
      gatewayTransactionId: 'gw_1',
      status: 'APPROVED',
      failureReason: null,
    });

    const result = await makeUseCase(repositories, gateway).execute(
      '22222222-2222-4222-8222-222222222222',
      PAY_INPUT,
    );

    const transaction = result._unsafeUnwrap();
    expect(transaction.status).toBe('APPROVED');
    expect(transaction.gatewayTransactionId).toBe('gw_1');
    expect(transaction.card).toEqual({ brand: 'visa', lastFour: '4242' });
  });

  it('settles DECLINED and releases the reserved stock', async () => {
    const { repositories, products } = makeRepositories();
    const gateway = gatewayThatReturns({
      gatewayTransactionId: 'gw_2',
      status: 'DECLINED',
      failureReason: 'INSUFFICIENT_FUNDS',
    });

    const result = await makeUseCase(repositories, gateway).execute(
      '22222222-2222-4222-8222-222222222222',
      PAY_INPUT,
    );

    expect(result._unsafeUnwrap().status).toBe('DECLINED');
    const reloaded = (await products.findById(PRODUCT_ID))._unsafeUnwrap();
    expect(reloaded?.stock).toBe(4);
  });

  it('leaves a PENDING gateway response untouched, for the webhook to resolve later', async () => {
    const { repositories, savedTransactions } = makeRepositories();
    const gateway = gatewayThatReturns({
      gatewayTransactionId: 'gw_3',
      status: 'PENDING',
      failureReason: null,
    });

    const result = await makeUseCase(repositories, gateway).execute(
      '22222222-2222-4222-8222-222222222222',
      PAY_INPUT,
    );

    expect(result._unsafeUnwrap().status).toBe('PENDING');
    expect(savedTransactions).toHaveLength(1);
  });

  it('fails with TransactionNotFound for an unknown transaction', async () => {
    const { repositories } = makeRepositories();
    const gateway = gatewayThatReturns({
      gatewayTransactionId: 'gw_4',
      status: 'APPROVED',
      failureReason: null,
    });

    const result = await makeUseCase(repositories, gateway).execute('missing', PAY_INPUT);

    expect(result._unsafeUnwrapErr().kind).toBe('TransactionNotFound');
  });

  it('fails with TransactionNotFound when the transaction names a customer that no longer exists', async () => {
    const repositories = makeRepositories().repositories;
    repositories.transactions.findById = () =>
      okAsync(
        makeTransaction({
          productId: PRODUCT_ID,
          customerId: 'does-not-exist',
        }),
      );
    const gateway = gatewayThatReturns({
      gatewayTransactionId: 'gw_6',
      status: 'APPROVED',
      failureReason: null,
    });

    const result = await makeUseCase(repositories, gateway).execute(
      '22222222-2222-4222-8222-222222222222',
      PAY_INPUT,
    );

    expect(result._unsafeUnwrapErr().kind).toBe('TransactionNotFound');
  });

  it('fails with TransactionNotPending when the transaction already settled', async () => {
    const repositories = makeRepositories().repositories;
    repositories.transactions.findById = () =>
      ResultAsync.fromSafePromise(
        Promise.resolve(
          (() => {
            const transaction = makeTransaction({ productId: PRODUCT_ID });
            transaction.settle('APPROVED', NOW);
            return transaction;
          })(),
        ),
      );
    const gateway = gatewayThatReturns({
      gatewayTransactionId: 'gw_5',
      status: 'APPROVED',
      failureReason: null,
    });

    const result = await makeUseCase(repositories, gateway).execute(
      '22222222-2222-4222-8222-222222222222',
      PAY_INPUT,
    );

    expect(result._unsafeUnwrapErr().kind).toBe('TransactionNotPending');
  });

  it('passes a gateway failure through untouched, without settling the transaction', async () => {
    const { repositories, savedTransactions } = makeRepositories();
    const gateway: PaymentGatewayPort = {
      getAcceptanceTokens: () => errAsync(gatewayUnavailable('not used')),
      chargeCard: () => errAsync(gatewayUnavailable('timeout')),
    };

    const result = await makeUseCase(repositories, gateway).execute(
      '22222222-2222-4222-8222-222222222222',
      PAY_INPUT,
    );

    expect(result._unsafeUnwrapErr().kind).toBe('GatewayUnavailable');
    expect(savedTransactions).toHaveLength(0);
  });
});
