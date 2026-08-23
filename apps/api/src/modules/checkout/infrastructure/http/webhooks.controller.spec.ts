import { Global, type INestApplication, Module, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { okAsync } from 'neverthrow';
import request from 'supertest';

import { FixedClock } from '../../../../shared/clock/clock.port';
import { SequentialIdGenerator } from '../../../../shared/id/id-generator.port';
import type { RepositoryRegistry } from '../../../../shared/unit-of-work/unit-of-work.port';
import { makeTransaction } from '../../../../testing/builders';
import { computeWebhookChecksum } from '../../../payments/domain/webhook-checksum';
import { readWebhookProperty } from '../../../payments/domain/read-webhook-property';
import type { Transaction } from '../../domain/transaction';
import {
  PROCESS_PAYMENT_WEBHOOK_USE_CASE,
  ProcessPaymentWebhookUseCase,
} from '../../application/process-payment-webhook.use-case';
import { SettleTransactionUseCase } from '../../application/settle-transaction.use-case';
import { WebhooksController } from './webhooks.controller';

const REFERENCE = 'TX-22222222-2222-4222-8222-222222222222';
const NOW = new Date('2026-08-23T00:00:00.000Z');
const EVENTS_SECRET = 'test-events-secret';
const PROPERTIES = ['transaction.id', 'transaction.status'];

function makeBody(status: string) {
  const timestamp = 1_700_000_000;
  const data = {
    transaction: { id: 'gw-tx-1', reference: REFERENCE, status, status_message: null },
  };
  const propertyValues = PROPERTIES.map((path) => readWebhookProperty(data, path) ?? '');
  const checksum = computeWebhookChecksum(propertyValues, timestamp, EVENTS_SECRET);

  return {
    event: 'transaction.updated',
    data,
    signature: { properties: PROPERTIES, checksum },
    timestamp,
  };
}

@Global()
@Module({})
class TestWebhooksModule {
  static register(transactions: Map<string, Transaction>) {
    const unitOfWork = {
      run: (work: (repos: RepositoryRegistry) => unknown) =>
        work({
          transactions: {
            findByReference: (reference: string) =>
              okAsync([...transactions.values()].find((tx) => tx.reference === reference) ?? null),
            save: () => okAsync(undefined),
          },
          products: { findById: () => okAsync(null) },
          stockMovements: { append: () => okAsync(undefined) },
          webhookEvents: {
            existsByChecksum: () => okAsync(false),
            record: () => okAsync(undefined),
          },
        } as unknown as RepositoryRegistry),
    };

    return {
      module: TestWebhooksModule,
      providers: [
        {
          provide: PROCESS_PAYMENT_WEBHOOK_USE_CASE,
          useFactory: () =>
            new ProcessPaymentWebhookUseCase(
              unitOfWork as never,
              new SettleTransactionUseCase(new FixedClock(NOW), new SequentialIdGenerator('mv')),
              new SequentialIdGenerator('evt'),
              EVENTS_SECRET,
            ),
        },
      ],
      exports: [PROCESS_PAYMENT_WEBHOOK_USE_CASE],
    };
  }
}

describe('WebhooksController', () => {
  let app: INestApplication;

  async function bootApp(transactions: Map<string, Transaction>): Promise<INestApplication> {
    const moduleRef = await Test.createTestingModule({
      imports: [TestWebhooksModule.register(transactions)],
      controllers: [WebhooksController],
    }).compile();

    const nestApp = moduleRef.createNestApplication();
    nestApp.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
    await nestApp.init();

    return nestApp;
  }

  afterEach(async () => {
    await app.close();
  });

  it('settles the transaction an APPROVED event names and acknowledges it', async () => {
    // COMMIT would need a real product; APPROVED skips the release branch, so
    // the stub `products.findById` returning null is never actually reached.
    const transaction = makeTransaction({ reference: REFERENCE, productId: 'unused-product' });
    app = await bootApp(new Map([[transaction.id, transaction]]));

    const response = await request(app.getHttpServer())
      .post('/webhooks/payments')
      .send(makeBody('APPROVED'))
      .expect(200);

    expect(response.body).toEqual({ received: true });
    expect(transaction.status).toBe('APPROVED');
  });

  it('answers 401 when the checksum does not match', async () => {
    const transaction = makeTransaction({ reference: REFERENCE });
    app = await bootApp(new Map([[transaction.id, transaction]]));
    const body = makeBody('APPROVED');
    body.signature.checksum = 'tampered';

    await request(app.getHttpServer()).post('/webhooks/payments').send(body).expect(401);
  });

  it('answers 400 for a malformed body', async () => {
    app = await bootApp(new Map());

    await request(app.getHttpServer()).post('/webhooks/payments').send({ event: 'x' }).expect(400);
  });
});
