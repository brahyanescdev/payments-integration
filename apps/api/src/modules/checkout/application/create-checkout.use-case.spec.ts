import { FakeUnitOfWork, InMemoryProductRepository } from '../../../testing/fakes';
import { FixedClock } from '../../../shared/clock/clock.port';
import { SequentialIdGenerator } from '../../../shared/id/id-generator.port';
import { COP, makeAddress, makePricingRules, makeProduct } from '../../../testing/builders';
import { Customer } from '../domain/customer';
import { Email } from '../../../shared/domain/email';
import type { RepositoryRegistry } from '../../../shared/unit-of-work/unit-of-work.port';
import type { Customer } from '../domain/customer';
import type { Delivery } from '../domain/delivery';
import { PricingPolicy } from '../domain/pricing-policy';
import type { StockMovement } from '../domain/stock-movement';
import type { Transaction } from '../domain/transaction';
import { CreateCheckoutUseCase } from './create-checkout.use-case';

const PRODUCT_ID = '11111111-1111-4111-8111-111111111111';
const NOW = new Date('2026-08-23T00:00:00.000Z');

/** In-memory doubles for every repository the use case touches, plus spies. */
function makeRepositories(overrides: Partial<{ stock: number }> = {}) {
  const products = new InMemoryProductRepository().seed([
    makeProduct({ id: PRODUCT_ID, price: COP(1_000_000), stock: overrides.stock ?? 5 }),
  ]);

  const savedCustomers: Customer[] = [];
  const savedTransactions: Transaction[] = [];
  const savedDeliveries: Delivery[] = [];
  const appendedMovements: StockMovement[] = [];

  const customers = {
    findByEmail: async () => null,
    save: async (customer: Customer) => {
      savedCustomers.push(customer);
    },
  };
  const transactions = {
    save: async (transaction: Transaction) => {
      savedTransactions.push(transaction);
    },
  };
  const deliveries = {
    save: async (delivery: Delivery) => {
      savedDeliveries.push(delivery);
    },
  };
  const stockMovements = {
    append: async (movement: StockMovement) => {
      appendedMovements.push(movement);
    },
  };

  // Repositories are ROP throughout the codebase; these doubles wrap plain async
  // functions in the same ResultAsync-returning shape the real ones use.
  // `fromSafePromise` awaits the promise before wrapping it as Ok — okAsync(promise)
  // would wrap the *promise itself* as the value, never resolving it.
  const { ResultAsync } = jest.requireActual('neverthrow');
  const wrap =
    <T extends unknown[]>(fn: (...args: T) => Promise<unknown>) =>
    (...args: T) =>
      ResultAsync.fromSafePromise(fn(...args));

  return {
    repositories: {
      products,
      customers: { findByEmail: wrap(customers.findByEmail), save: wrap(customers.save) },
      transactions: { save: wrap(transactions.save) },
      deliveries: { save: wrap(deliveries.save) },
      stockMovements: { append: wrap(stockMovements.append) },
    } as unknown as RepositoryRegistry,
    savedCustomers,
    savedTransactions,
    savedDeliveries,
    appendedMovements,
    products,
  };
}

const VALID_INPUT = {
  productId: PRODUCT_ID,
  quantity: 2,
  customer: {
    email: 'ana@example.com',
    fullName: 'Ana Pérez',
    phone: '3001234567',
    legalId: '1020304050',
    legalIdType: 'CC' as const,
  },
  delivery: {
    recipientName: 'Ana Pérez',
    phone: '3001234567',
    address: makeAddress(),
  },
};

function makeUseCase(repositories: RepositoryRegistry) {
  return new CreateCheckoutUseCase(
    new FakeUnitOfWork(repositories),
    new PricingPolicy(makePricingRules()),
    new FixedClock(NOW),
    new SequentialIdGenerator('gen'),
  );
}

describe('CreateCheckoutUseCase', () => {
  it('opens a PENDING transaction priced from the catalogue, not from the caller', async () => {
    const { repositories, savedTransactions } = makeRepositories();
    const useCase = makeUseCase(repositories);

    const result = await useCase.execute(VALID_INPUT);

    const transaction = result._unsafeUnwrap();
    expect(transaction.status).toBe('PENDING');
    expect(transaction.breakdown.productAmount.amountInCents).toBe(2_000_000);
    expect(transaction.breakdown.total.amountInCents).toBe(3_100_000);
    expect(savedTransactions).toHaveLength(1);
  });

  it('reserves exactly the requested quantity from the product', async () => {
    const { repositories, products } = makeRepositories({ stock: 5 });

    await makeUseCase(repositories).execute(VALID_INPUT);

    const reloaded = (await products.findById(PRODUCT_ID))._unsafeUnwrap();
    expect(reloaded?.stock).toBe(3);
  });

  it('records a RESERVE stock movement tied to the new transaction', async () => {
    const { repositories, appendedMovements } = makeRepositories();

    const result = await makeUseCase(repositories).execute(VALID_INPUT);
    const transaction = result._unsafeUnwrap();

    expect(appendedMovements).toHaveLength(1);
    expect(appendedMovements[0]).toMatchObject({
      type: 'RESERVE',
      quantity: 2,
      transactionId: transaction.id,
      productId: PRODUCT_ID,
    });
  });

  it('creates the delivery tied to the new transaction', async () => {
    const { repositories, savedDeliveries } = makeRepositories();

    const result = await makeUseCase(repositories).execute(VALID_INPUT);
    const transaction = result._unsafeUnwrap();

    expect(savedDeliveries).toHaveLength(1);
    expect(savedDeliveries[0]?.transactionId).toBe(transaction.id);
    expect(savedDeliveries[0]?.status).toBe('PENDING');
  });

  it('creates a new customer when the email is not on file', async () => {
    const { repositories, savedCustomers } = makeRepositories();

    await makeUseCase(repositories).execute(VALID_INPUT);

    expect(savedCustomers).toHaveLength(1);
    expect(savedCustomers[0]?.email.value).toBe('ana@example.com');
  });

  it('reuses the existing customer instead of creating a duplicate for the same email', async () => {
    const { ResultAsync } = jest.requireActual('neverthrow');
    const { repositories, savedCustomers } = makeRepositories();
    const existing = Customer.rehydrate({
      id: 'existing-customer',
      email: Email.create('ana@example.com')._unsafeUnwrap(),
      fullName: 'Ana Pérez',
      phone: '3001234567',
      legalId: '1020304050',
      legalIdType: 'CC',
      createdAt: NOW,
    });
    repositories.customers.findByEmail = () =>
      ResultAsync.fromSafePromise(Promise.resolve(existing));

    const result = await makeUseCase(repositories).execute(VALID_INPUT);

    expect(result._unsafeUnwrap().customerId).toBe('existing-customer');
    expect(savedCustomers).toHaveLength(1);
    expect(savedCustomers[0]?.id).toBe('existing-customer');
  });

  it('fails with ProductNotFound when the product does not exist', async () => {
    const { repositories } = makeRepositories();

    const result = await makeUseCase(repositories).execute({
      ...VALID_INPUT,
      productId: 'does-not-exist',
    });

    expect(result._unsafeUnwrapErr().kind).toBe('ProductNotFound');
  });

  it('fails with InsufficientStock and reserves nothing when the quantity exceeds stock', async () => {
    const { repositories, savedTransactions, products } = makeRepositories({ stock: 1 });

    const result = await makeUseCase(repositories).execute({ ...VALID_INPUT, quantity: 5 });

    expect(result._unsafeUnwrapErr().kind).toBe('InsufficientStock');
    expect(savedTransactions).toHaveLength(0);
    const reloaded = (await products.findById(PRODUCT_ID))._unsafeUnwrap();
    expect(reloaded?.stock).toBe(1);
  });

  it('rejects a malformed customer email before touching any repository', async () => {
    const { repositories, savedTransactions } = makeRepositories();

    const result = await makeUseCase(repositories).execute({
      ...VALID_INPUT,
      customer: { ...VALID_INPUT.customer, email: 'not-an-email' },
    });

    expect(result._unsafeUnwrapErr().kind).toBe('Validation');
    expect(savedTransactions).toHaveLength(0);
  });

  it('derives the gateway reference from the transaction id', async () => {
    const { repositories } = makeRepositories();

    const transaction = (await makeUseCase(repositories).execute(VALID_INPUT))._unsafeUnwrap();

    expect(transaction.reference).toBe(`TX-${transaction.id}`);
  });
});
