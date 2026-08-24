import { Global, type INestApplication, Module, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { okAsync } from 'neverthrow';
import request from 'supertest';

import { APP_CONFIG, loadAppConfig } from '../../../../config/app.config';
import { makeEnv } from '../../../../config/env.fixture';
import {
  UNIT_OF_WORK,
  type RepositoryRegistry,
} from '../../../../shared/unit-of-work/unit-of-work.port';
import { makeTransaction } from '../../../../testing/builders';
import type { Transaction } from '../../domain/transaction';
import {
  GET_TRANSACTION_USE_CASE,
  GetTransactionUseCase,
} from '../../application/get-transaction.use-case';
import { TransactionsController } from './transactions.controller';

const TRANSACTION_ID = '22222222-2222-4222-8222-222222222222';

@Global()
@Module({})
class TestTransactionsModule {
  static register(transactions: Map<string, Transaction>) {
    const unitOfWork = {
      run: (work: (repos: RepositoryRegistry) => unknown) =>
        work({
          transactions: { findById: (id: string) => okAsync(transactions.get(id) ?? null) },
        } as unknown as RepositoryRegistry),
    };

    return {
      module: TestTransactionsModule,
      providers: [
        { provide: UNIT_OF_WORK, useValue: unitOfWork },
        {
          provide: GET_TRANSACTION_USE_CASE,
          useFactory: () => new GetTransactionUseCase(unitOfWork as never),
        },
        { provide: APP_CONFIG, useValue: loadAppConfig(makeEnv()) },
      ],
      exports: [UNIT_OF_WORK, GET_TRANSACTION_USE_CASE, APP_CONFIG],
    };
  }
}

describe('TransactionsController', () => {
  let app: INestApplication;

  async function bootApp(transactions: Map<string, Transaction>): Promise<INestApplication> {
    const moduleRef = await Test.createTestingModule({
      imports: [TestTransactionsModule.register(transactions)],
      controllers: [TransactionsController],
    }).compile();

    const nestApp = moduleRef.createNestApplication();
    nestApp.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
    await nestApp.init();

    return nestApp;
  }

  afterEach(async () => {
    await app.close();
  });

  it('returns the published contract shape for an existing transaction', async () => {
    const transaction = makeTransaction({ id: TRANSACTION_ID });
    app = await bootApp(new Map([[TRANSACTION_ID, transaction]]));

    const response = await request(app.getHttpServer())
      .get(`/transactions/${TRANSACTION_ID}`)
      .expect(200);

    expect(response.body).toMatchObject({
      id: TRANSACTION_ID,
      status: 'PENDING',
      gatewayMode: 'fake',
    });
    expect(response.body).not.toHaveProperty('customerId');
  });

  it('reports gatewayMode "sandbox" when the real driver is configured, never the internal "http" name', async () => {
    const transaction = makeTransaction({ id: TRANSACTION_ID });
    const moduleRef = await Test.createTestingModule({
      imports: [TestTransactionsModule.register(new Map([[TRANSACTION_ID, transaction]]))],
      controllers: [TransactionsController],
    })
      .overrideProvider(APP_CONFIG)
      .useValue(
        loadAppConfig(
          makeEnv({
            PAYMENT_GATEWAY_DRIVER: 'http',
            PSP_PUBLIC_KEY: 'pub',
            PSP_PRIVATE_KEY: 'prv',
            PSP_INTEGRITY_SECRET: 'int',
            PSP_EVENTS_SECRET: 'evt',
          }),
        ),
      )
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();

    const response = await request(app.getHttpServer())
      .get(`/transactions/${TRANSACTION_ID}`)
      .expect(200);

    expect(response.body.gatewayMode).toBe('sandbox');
  });

  it('answers 404 for a transaction that does not exist', async () => {
    app = await bootApp(new Map());

    await request(app.getHttpServer())
      .get('/transactions/33333333-3333-4333-8333-333333333333')
      .expect(404);
  });

  it('rejects a malformed transaction id before it reaches the use case', async () => {
    app = await bootApp(new Map());

    await request(app.getHttpServer()).get('/transactions/not-a-uuid').expect(400);
  });
});
