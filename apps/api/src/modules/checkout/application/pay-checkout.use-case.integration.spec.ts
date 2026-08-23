import { randomUUID } from 'node:crypto';

import type { MikroORM } from '@mikro-orm/postgresql';

import { CreateCheckoutUseCase } from './create-checkout.use-case';
import { PayCheckoutUseCase } from './pay-checkout.use-case';
import { SettleTransactionUseCase } from './settle-transaction.use-case';
import { FakePaymentGatewayAdapter } from '../../payments/infrastructure/gateway/fake-payment-gateway.adapter';
import { MikroUnitOfWork } from '../../../persistence/mikro-unit-of-work';
import { ProductEntity } from '../../catalog/infrastructure/persistence/product.entity';
import { FixedClock } from '../../../shared/clock/clock.port';
import { UuidGenerator } from '../../../shared/id/id-generator.port';
import { makeAddress, makePricingRules } from '../../../testing/builders';
import { openTestOrm } from '../../../testing/orm';
import { PricingPolicy } from '../domain/pricing-policy';

/**
 * Proves the whole vertical slice against real PostgreSQL: open a checkout, pay
 * it, and watch the transaction and the stock land exactly where the sandbox's
 * own documented test cards say they should.
 */
describe('PayCheckoutUseCase (integration)', () => {
  let orm: MikroORM;
  let createCheckout: CreateCheckoutUseCase;
  let payCheckout: PayCheckoutUseCase;
  let productId: string;

  const openInput = () => ({
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

  const payInputFor = (lastFour: string) => ({
    cardToken: `tok_fake_${lastFour}_${randomUUID()}`,
    acceptanceToken: 'acc',
    acceptPersonalAuthToken: 'priv',
    installments: 1,
    cardBrand: 'visa',
    cardLastFour: lastFour,
  });

  beforeAll(async () => {
    orm = await openTestOrm();
    const unitOfWork = new MikroUnitOfWork(orm);
    const clock = new FixedClock(new Date('2026-08-23T00:00:00.000Z'));
    const ids = new UuidGenerator();
    const gateway = new FakePaymentGatewayAdapter({ apiBasePath: '/api/v1' });

    createCheckout = new CreateCheckoutUseCase(
      unitOfWork,
      new PricingPolicy(makePricingRules()),
      clock,
      ids,
    );
    payCheckout = new PayCheckoutUseCase(
      unitOfWork,
      gateway,
      new SettleTransactionUseCase(clock, ids),
      clock,
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
    row.stock = 3;
    await em.persistAndFlush(row);
  });

  afterEach(async () => {
    const em = orm.em.fork();
    await em.nativeDelete('stock_movements', { product_id: productId });
    await em.nativeDelete('deliveries', {});
    await em.nativeDelete('transactions', { product_id: productId });
    await em.nativeDelete('customers', {});
    await em.nativeDelete(ProductEntity, { id: productId });
  });

  it('approves a card ending in 4242, exactly like the real sandbox', async () => {
    const opened = (await createCheckout.execute(openInput()))._unsafeUnwrap();

    const result = await payCheckout.execute(opened.id, payInputFor('4242'));

    expect(result._unsafeUnwrap().status).toBe('APPROVED');
    const productRow = await orm.em.fork().findOneOrFail(ProductEntity, { id: productId });
    expect(productRow.stock).toBe(2);
  });

  it('declines a card ending in 1111 and releases the reserved unit', async () => {
    const opened = (await createCheckout.execute(openInput()))._unsafeUnwrap();

    const result = await payCheckout.execute(opened.id, payInputFor('1111'));

    expect(result._unsafeUnwrap().status).toBe('DECLINED');
    const productRow = await orm.em.fork().findOneOrFail(ProductEntity, { id: productId });
    expect(productRow.stock).toBe(3);
  });

  it('errors for any other card and releases the reserved unit all the same', async () => {
    const opened = (await createCheckout.execute(openInput()))._unsafeUnwrap();

    const result = await payCheckout.execute(opened.id, payInputFor('0000'));

    expect(result._unsafeUnwrap().status).toBe('ERROR');
    const productRow = await orm.em.fork().findOneOrFail(ProductEntity, { id: productId });
    expect(productRow.stock).toBe(3);
  });

  it('refuses to pay the same transaction twice', async () => {
    const opened = (await createCheckout.execute(openInput()))._unsafeUnwrap();
    await payCheckout.execute(opened.id, payInputFor('4242'));

    const second = await payCheckout.execute(opened.id, payInputFor('4242'));

    expect(second._unsafeUnwrapErr().kind).toBe('TransactionNotPending');
  });
});
