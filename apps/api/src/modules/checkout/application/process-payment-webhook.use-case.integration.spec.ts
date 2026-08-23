import { randomUUID } from 'node:crypto';

import type { MikroORM } from '@mikro-orm/postgresql';

import { CreateCheckoutUseCase } from './create-checkout.use-case';
import {
  ProcessPaymentWebhookUseCase,
  type WebhookPayload,
} from './process-payment-webhook.use-case';
import { SettleTransactionUseCase } from './settle-transaction.use-case';
import { MikroUnitOfWork } from '../../../persistence/mikro-unit-of-work';
import { WebhookEventEntity } from '../../../persistence/webhook-event.entity';
import { ProductEntity } from '../../catalog/infrastructure/persistence/product.entity';
import { FixedClock } from '../../../shared/clock/clock.port';
import { UuidGenerator } from '../../../shared/id/id-generator.port';
import { makeAddress, makePricingRules } from '../../../testing/builders';
import { cleanupCheckoutFixtures, openTestOrm } from '../../../testing/orm';
import { computeWebhookChecksum } from '../../payments/domain/webhook-checksum';
import { readWebhookProperty } from '../../payments/domain/read-webhook-property';
import { PricingPolicy } from '../domain/pricing-policy';

const EVENTS_SECRET = 'test-events-secret';
const PROPERTIES = ['transaction.id', 'transaction.status'];

/**
 * Proves the async settlement path against real PostgreSQL: a transaction the
 * gateway left `PENDING` after the charge call, resolved later by its own
 * webhook — the exact scenario `SettleTransactionUseCase` was split out for in
 * the first place, now exercised from its other caller.
 */
describe('ProcessPaymentWebhookUseCase (integration)', () => {
  let orm: MikroORM;
  let createCheckout: CreateCheckoutUseCase;
  let processWebhook: ProcessPaymentWebhookUseCase;
  let productId: string;
  /** Checksums this test created, so `afterEach` can clean up only its own rows. */
  let createdChecksums: string[];

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

  function webhookFor(reference: string, status: string): WebhookPayload {
    const timestamp = 1_700_000_000;
    const data = {
      transaction: { id: `gw_${reference}`, reference, status, status_message: null },
    };
    const propertyValues = PROPERTIES.map((path) => readWebhookProperty(data, path) ?? '');
    const checksum = computeWebhookChecksum(propertyValues, timestamp, EVENTS_SECRET);
    createdChecksums.push(checksum);

    return {
      event: 'transaction.updated',
      data,
      signature: { properties: PROPERTIES, checksum },
      timestamp,
    };
  }

  beforeAll(async () => {
    orm = await openTestOrm();
    const unitOfWork = new MikroUnitOfWork(orm);
    const clock = new FixedClock(new Date('2026-08-23T00:00:00.000Z'));
    const ids = new UuidGenerator();

    createCheckout = new CreateCheckoutUseCase(
      unitOfWork,
      new PricingPolicy(makePricingRules()),
      clock,
      ids,
    );
    processWebhook = new ProcessPaymentWebhookUseCase(
      unitOfWork,
      new SettleTransactionUseCase(clock, ids),
      ids,
      EVENTS_SECRET,
    );
  });

  afterAll(async () => {
    await orm.close();
  });

  beforeEach(async () => {
    productId = randomUUID();
    createdChecksums = [];
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
    if (createdChecksums.length > 0) {
      const em = orm.em.fork();
      await em.nativeDelete(WebhookEventEntity, { checksum: { $in: createdChecksums } });
    }

    await cleanupCheckoutFixtures(orm, productId);
  });

  it('settles a PENDING transaction to APPROVED and commits the reserved stock', async () => {
    const opened = (await createCheckout.execute(openInput()))._unsafeUnwrap();

    const result = await processWebhook.execute(webhookFor(opened.reference, 'APPROVED'));

    expect(result._unsafeUnwrap()).toBe('settled');
    const productRow = await orm.em.fork().findOneOrFail(ProductEntity, { id: productId });
    expect(productRow.stock).toBe(2);
  });

  it('settles a PENDING transaction to DECLINED and releases the reserved stock', async () => {
    const opened = (await createCheckout.execute(openInput()))._unsafeUnwrap();

    const result = await processWebhook.execute(webhookFor(opened.reference, 'DECLINED'));

    expect(result._unsafeUnwrap()).toBe('settled');
    const productRow = await orm.em.fork().findOneOrFail(ProductEntity, { id: productId });
    expect(productRow.stock).toBe(3);
  });

  it('ignores a retried delivery of the same event, thanks to the checksum ledger', async () => {
    const opened = (await createCheckout.execute(openInput()))._unsafeUnwrap();
    const payload = webhookFor(opened.reference, 'APPROVED');

    const first = await processWebhook.execute(payload);
    const second = await processWebhook.execute(payload);

    expect(first._unsafeUnwrap()).toBe('settled');
    expect(second._unsafeUnwrap()).toBe('ignored');
    const productRow = await orm.em.fork().findOneOrFail(ProductEntity, { id: productId });
    // A second COMMIT would be a silent double-count if the ledger let it through.
    expect(productRow.stock).toBe(2);
  });

  it('fails with TransactionNotFound for a reference nothing opened', async () => {
    const result = await processWebhook.execute(webhookFor(`TX-${randomUUID()}`, 'APPROVED'));

    expect(result._unsafeUnwrapErr().kind).toBe('TransactionNotFound');
  });
});
