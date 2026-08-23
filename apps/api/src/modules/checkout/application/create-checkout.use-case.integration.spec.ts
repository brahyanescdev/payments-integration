import { randomUUID } from 'node:crypto';

import type { MikroORM } from '@mikro-orm/postgresql';

import { MikroUnitOfWork } from '../../../persistence/mikro-unit-of-work';
import { ProductEntity } from '../../catalog/infrastructure/persistence/product.entity';
import { DeliveryEntity, TransactionEntity } from '../infrastructure/persistence/checkout.entities';
import { FixedClock } from '../../../shared/clock/clock.port';
import { UuidGenerator } from '../../../shared/id/id-generator.port';
import { makeAddress, makePricingRules } from '../../../testing/builders';
import { openTestOrm } from '../../../testing/orm';
import { PricingPolicy } from '../domain/pricing-policy';
import { CreateCheckoutUseCase } from './create-checkout.use-case';

/**
 * Proves the use case against real PostgreSQL: the property that actually
 * matters — one commit, or none at all — can only be demonstrated against a
 * database that can genuinely roll back.
 */
describe('CreateCheckoutUseCase (integration)', () => {
  let orm: MikroORM;
  let useCase: CreateCheckoutUseCase;
  let productId: string;

  const input = () => ({
    productId,
    quantity: 1,
    customer: {
      email: `buyer-${randomUUID().slice(0, 8)}@example.com`,
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
  });

  beforeAll(async () => {
    orm = await openTestOrm();
    useCase = new CreateCheckoutUseCase(
      new MikroUnitOfWork(orm),
      new PricingPolicy(makePricingRules()),
      new FixedClock(new Date('2026-08-23T00:00:00.000Z')),
      new UuidGenerator(),
    );
  });

  afterAll(async () => {
    await orm.close();
  });

  beforeEach(async () => {
    productId = randomUUID();
    const em = orm.em.fork();
    const row = new ProductEntity();
    row.id = productId;
    row.sku = `TEST-${productId.slice(0, 8)}`;
    row.name = 'Producto de prueba';
    row.description = 'Creado por la suite de integración.';
    row.priceInCents = 1_000_000;
    row.currency = 'COP';
    row.imageUrl = '/images/test.svg';
    row.stock = 1;
    await em.persistAndFlush(row);
  });

  afterEach(async () => {
    const em = orm.em.fork();
    // Deliveries key on transactionId, not productId, so the transactions this
    // test created have to be looked up first — an unscoped delete on a shared
    // table would wipe rows other tests, possibly running concurrently in a
    // different worker, are still relying on.
    const transactionRows = await em.find(TransactionEntity, { productId });
    const transactionIds = transactionRows.map((row) => row.id);

    if (transactionIds.length > 0) {
      await em.nativeDelete(DeliveryEntity, { transactionId: { $in: transactionIds } });
    }

    await em.nativeDelete('stock_movements', { product_id: productId });
    await em.nativeDelete(TransactionEntity, { productId });
    await em.nativeDelete(ProductEntity, { id: productId });
  });

  it('commits customer, transaction, delivery and stock reservation together', async () => {
    const result = await useCase.execute(input());

    const transaction = result._unsafeUnwrap();

    const em = orm.em.fork();
    const productRow = await em.findOneOrFail(ProductEntity, { id: productId });
    expect(productRow.stock).toBe(0);

    const transactionRow = await em.findOneOrFail(TransactionEntity, { id: transaction.id });
    expect(transactionRow).toMatchObject({ status: 'PENDING', quantity: 1 });

    const deliveryRow = await em.findOneOrFail(DeliveryEntity, { transactionId: transaction.id });
    expect(deliveryRow).toBeTruthy();
  });

  it('lets exactly one of two simultaneous buyers of the last unit succeed', async () => {
    const [first, second] = await Promise.all([useCase.execute(input()), useCase.execute(input())]);

    const outcomes = [first, second];
    const succeeded = outcomes.filter((outcome) => outcome.isOk());
    const failed = outcomes.filter((outcome) => outcome.isErr());

    expect(succeeded).toHaveLength(1);
    expect(failed).toHaveLength(1);
    expect(['ConcurrencyConflict', 'InsufficientStock']).toContain(
      failed[0]?._unsafeUnwrapErr().kind,
    );

    const em = orm.em.fork();
    const productRow = await em.findOneOrFail(ProductEntity, { id: productId });
    expect(productRow.stock).toBe(0);
  });
});
