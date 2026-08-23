import { randomUUID } from 'node:crypto';

import type { MikroORM } from '@mikro-orm/postgresql';
import { okAsync } from 'neverthrow';

import { Customer } from '../modules/checkout/domain/customer';
import { Delivery } from '../modules/checkout/domain/delivery';
import { StockMovement } from '../modules/checkout/domain/stock-movement';
import { Transaction } from '../modules/checkout/domain/transaction';
import { ProductEntity } from '../modules/catalog/infrastructure/persistence/product.entity';
import { Email } from '../shared/domain/email';
import type { RepositoryRegistry } from '../shared/unit-of-work/unit-of-work.port';
import { FIXED_NOW, makeAddress, makeBreakdown, makeProduct } from '../testing/builders';
import { openTestOrm } from '../testing/orm';
import { MikroUnitOfWork } from './mikro-unit-of-work';

/** Persists a whole checkout in one unit, mirroring what the real use case does. */
interface CheckoutIds {
  customerId: string;
  transactionId: string;
  productId: string;
}

describe('MikroORM repositories', () => {
  let orm: MikroORM;
  let unitOfWork: MikroUnitOfWork;
  let ids: CheckoutIds;

  const openCheckout = (repositories: RepositoryRegistry) => {
    const customer = Customer.rehydrate({
      id: ids.customerId,
      email: Email.create(`buyer-${ids.customerId.slice(0, 8)}@example.com`)._unsafeUnwrap(),
      fullName: 'Ana Pérez',
      phone: '3001234567',
      legalId: '1020304050',
      legalIdType: 'CC',
      createdAt: FIXED_NOW,
    });

    const transaction = Transaction.open({
      id: ids.transactionId,
      reference: `TX-${ids.transactionId}`,
      customerId: ids.customerId,
      productId: ids.productId,
      quantity: 2,
      breakdown: makeBreakdown(),
      now: FIXED_NOW,
    });

    const delivery = Delivery.open({
      id: randomUUID(),
      transactionId: ids.transactionId,
      recipientName: 'Ana Pérez',
      phone: '3001234567',
      address: makeAddress(),
      now: FIXED_NOW,
    })._unsafeUnwrap();

    const movement = StockMovement.record({
      id: randomUUID(),
      productId: ids.productId,
      transactionId: ids.transactionId,
      type: 'RESERVE',
      quantity: 2,
      now: FIXED_NOW,
    });

    return repositories.customers
      .save(customer)
      .andThen(() => repositories.transactions.save(transaction))
      .andThen(() => repositories.deliveries.save(delivery))
      .andThen(() => repositories.stockMovements.append(movement))
      .map(() => transaction);
  };

  beforeAll(async () => {
    orm = await openTestOrm();
    unitOfWork = new MikroUnitOfWork(orm);
  });

  afterAll(async () => {
    await orm.close();
  });

  beforeEach(async () => {
    ids = {
      customerId: randomUUID(),
      transactionId: randomUUID(),
      productId: randomUUID(),
    };

    const em = orm.em.fork();
    const row = new ProductEntity();
    row.id = ids.productId;
    row.sku = `TEST-${ids.productId.slice(0, 8)}`;
    row.name = 'Producto de prueba';
    row.description = 'Creado por la suite de integración.';
    row.priceInCents = 1_000_000;
    row.currency = 'COP';
    row.imageUrl = '/images/test.svg';
    row.stock = 5;
    await em.persistAndFlush(row);
  });

  afterEach(async () => {
    const em = orm.em.fork();
    await em.nativeDelete('stock_movements', { transaction_id: ids.transactionId });
    await em.nativeDelete('deliveries', { transaction_id: ids.transactionId });
    await em.nativeDelete('transactions', { id: ids.transactionId });
    await em.nativeDelete('customers', { id: ids.customerId });
    await em.nativeDelete(ProductEntity, { id: ids.productId });
  });

  it('writes customer, transaction, delivery and ledger entry in a single commit', async () => {
    const written = await unitOfWork.run(openCheckout);

    expect(written.isOk()).toBe(true);

    const found = await unitOfWork.run((repositories) =>
      repositories.transactions
        .findById(ids.transactionId)
        .andThen((transaction) =>
          repositories.deliveries
            .findByTransactionId(ids.transactionId)
            .andThen((delivery) =>
              repositories.stockMovements
                .exists(ids.transactionId, 'RESERVE')
                .map((reserved) => ({ transaction, delivery, reserved })),
            ),
        ),
    );

    const state = found._unsafeUnwrap();
    expect(state.transaction?.status).toBe('PENDING');
    expect(state.transaction?.breakdown.total.amountInCents).toBe(10_000_000);
    expect(state.delivery?.status).toBe('PENDING');
    expect(state.reserved).toBe(true);
  });

  it('finds a transaction by the reference sent to the gateway', async () => {
    await unitOfWork.run(openCheckout);

    const found = await unitOfWork.run((repositories) =>
      repositories.transactions.findByReference(`TX-${ids.transactionId}`),
    );

    expect(found._unsafeUnwrap()?.id).toBe(ids.transactionId);
  });

  it('finds a customer by its normalised email', async () => {
    await unitOfWork.run(openCheckout);

    const found = await unitOfWork.run((repositories) =>
      repositories.customers.findByEmail(
        Email.create(`BUYER-${ids.customerId.slice(0, 8)}@EXAMPLE.COM`)._unsafeUnwrap(),
      ),
    );

    expect(found._unsafeUnwrap()?.id).toBe(ids.customerId);
  });

  it('reports null rather than failing when nothing matches', async () => {
    const result = await unitOfWork.run((repositories) =>
      repositories.transactions
        .findById(randomUUID())
        .andThen((transaction) =>
          repositories.deliveries
            .findByTransactionId(randomUUID())
            .map((delivery) => ({ transaction, delivery })),
        ),
    );

    expect(result._unsafeUnwrap()).toEqual({ transaction: null, delivery: null });
  });

  it('persists a settled transaction through the tracked row', async () => {
    await unitOfWork.run(openCheckout);

    await unitOfWork.run((repositories) =>
      repositories.transactions.findById(ids.transactionId).andThen((transaction) => {
        transaction?.attachCard({ brand: 'VISA', lastFour: '4242' }, FIXED_NOW);
        transaction?.settle('APPROVED', FIXED_NOW);

        return transaction === null
          ? okAsync(undefined)
          : repositories.transactions.save(transaction);
      }),
    );

    const reloaded = await unitOfWork.run((repositories) =>
      repositories.transactions.findById(ids.transactionId),
    );

    const transaction = reloaded._unsafeUnwrap();
    expect(transaction?.status).toBe('APPROVED');
    expect(transaction?.card).toEqual({ brand: 'VISA', lastFour: '4242' });
  });

  it('inserts a brand-new product the first time it is saved, not just updates a tracked one', async () => {
    const newProductId = randomUUID();
    const product = makeProduct({ id: newProductId, sku: `NEW-${newProductId.slice(0, 8)}` });

    await unitOfWork.run((repositories) => repositories.products.save(product));

    const row = await orm.em.fork().findOneOrFail(ProductEntity, { id: newProductId });
    expect(row.sku).toBe(product.toSnapshot().sku);

    await orm.em.fork().nativeDelete(ProductEntity, { id: newProductId });
  });

  it('refuses a second ledger entry of the same kind for one transaction', async () => {
    await unitOfWork.run(openCheckout);

    const duplicate = await unitOfWork.run((repositories) =>
      repositories.stockMovements.append(
        StockMovement.record({
          id: randomUUID(),
          productId: ids.productId,
          transactionId: ids.transactionId,
          type: 'RESERVE',
          quantity: 2,
          now: FIXED_NOW,
        }),
      ),
    );

    // The unique constraint is the guarantee; the adapter surfaces it as a value.
    expect(duplicate._unsafeUnwrapErr().kind).toBe('Persistence');
  });

  describe('product listing', () => {
    // The suite creates its own catalogue rather than leaning on the seeder: a test
    // that depends on seeded rows passes or fails according to how the database was
    // last prepared, which is not a property of the code under test.
    const extraIds: string[] = [];

    beforeEach(async () => {
      const em = orm.em.fork();

      for (const suffix of ['aaa', 'bbb', 'ccc']) {
        const id = randomUUID();
        extraIds.push(id);

        const row = new ProductEntity();
        row.id = id;
        row.sku = `LIST-${suffix}-${id.slice(0, 8)}`;
        row.name = `zzz-listado-${suffix}`;
        row.description = 'Fixture de paginación.';
        row.priceInCents = 500_000;
        row.currency = 'COP';
        row.imageUrl = '/images/test.svg';
        row.stock = 1;
        em.persist(row);
      }

      await em.flush();
    });

    afterEach(async () => {
      await orm.em.fork().nativeDelete(ProductEntity, { id: { $in: extraIds } });
      extraIds.length = 0;
    });

    it('honours the page size and reports the full total', async () => {
      const page = await unitOfWork.run((repositories) => repositories.products.list(2, 0));

      const { items, total } = page._unsafeUnwrap();

      expect(items).toHaveLength(2);
      expect(total).toBeGreaterThanOrEqual(4);
    });

    it('orders by name so paging is stable rather than arbitrary', async () => {
      const page = await unitOfWork.run((repositories) => repositories.products.list(50, 0));

      const names = page._unsafeUnwrap().items.map((product) => product.name);

      expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    });

    it('returns disjoint pages, so nothing is skipped or shown twice', async () => {
      const first = await unitOfWork.run((repositories) => repositories.products.list(2, 0));
      const second = await unitOfWork.run((repositories) => repositories.products.list(2, 2));

      const firstIds = first._unsafeUnwrap().items.map((product) => product.id);
      const secondIds = second._unsafeUnwrap().items.map((product) => product.id);

      expect(secondIds.some((id) => firstIds.includes(id))).toBe(false);
    });
  });
});
