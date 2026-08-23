import { Global, type INestApplication, Module, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { API_ROUTES, IDEMPOTENCY_KEY_HEADER } from '@payments/shared';
import { errAsync, okAsync } from 'neverthrow';
import request from 'supertest';

import { APP_CONFIG, loadAppConfig } from '../../../../config/app.config';
import { makeEnv } from '../../../../config/env.fixture';
import { CLOCK, FixedClock } from '../../../../shared/clock/clock.port';
import type { Email } from '../../../../shared/domain/email';
import { ID_GENERATOR, UuidGenerator } from '../../../../shared/id/id-generator.port';
import { IDEMPOTENCY_KEY_REPOSITORY } from '../../../../persistence/idempotency-key.repository';
import { insufficientStock } from '../../../../shared/result/domain-error';
import {
  UNIT_OF_WORK,
  type RepositoryRegistry,
} from '../../../../shared/unit-of-work/unit-of-work.port';
import {
  InMemoryIdempotencyKeyRepository,
  InMemoryProductRepository,
} from '../../../../testing/fakes';
import { COP, makePricingRules, makeProduct } from '../../../../testing/builders';
import type { Customer } from '../../domain/customer';
import type { Transaction } from '../../domain/transaction';
import {
  CREATE_CHECKOUT_USE_CASE,
  CreateCheckoutUseCase,
} from '../../application/create-checkout.use-case';
import {
  GET_ACCEPTANCE_TOKENS_USE_CASE,
  GetAcceptanceTokensUseCase,
} from '../../application/get-acceptance-tokens.use-case';
import { PAY_CHECKOUT_USE_CASE, PayCheckoutUseCase } from '../../application/pay-checkout.use-case';
import { SettleTransactionUseCase } from '../../application/settle-transaction.use-case';
import { PricingPolicy } from '../../domain/pricing-policy';
import { FakePaymentGatewayAdapter } from '../../../payments/infrastructure/gateway/fake-payment-gateway.adapter';
import { CheckoutController } from './checkout.controller';

const PRODUCT_ID = '11111111-1111-4111-8111-111111111111';
const NOW = new Date('2026-08-23T00:00:00.000Z');

const validBody = () => ({
  productId: PRODUCT_ID,
  quantity: 1,
  customer: {
    email: 'ana@example.com',
    fullName: 'Ana Pérez',
    phone: '3001234567',
    legalId: '1020304050',
    legalIdType: 'CC',
  },
  delivery: {
    recipientName: 'Ana Pérez',
    phone: '3001234567',
    addressLine1: 'Calle 100 # 15-20',
    city: 'Bogotá',
    region: 'Cundinamarca',
    country: 'CO',
    postalCode: '110111',
  },
});

const payBody = (cardLastFour = '4242') => ({
  cardToken: `tok_fake_${cardLastFour}_test`,
  acceptanceToken: 'acc',
  acceptPersonalAuthToken: 'priv',
  installments: 1,
  cardBrand: 'visa',
  cardLastFour,
});

/**
 * In-memory registry backing the whole controller: real domain objects held in
 * plain Maps, so opening a checkout and then paying it flow through the exact
 * same repositories, the way they do against MikroORM.
 */
function makeRepositories() {
  const products = new InMemoryProductRepository().seed([
    makeProduct({ id: PRODUCT_ID, price: COP(1_000_000), stock: 3 }),
  ]);
  const customers = new Map<string, Customer>();
  const transactions = new Map<string, Transaction>();

  const repositories: RepositoryRegistry = {
    products,
    customers: {
      findByEmail: (email: Email) =>
        okAsync([...customers.values()].find((customer) => customer.email.equals(email)) ?? null),
      findById: (id: string) => okAsync(customers.get(id) ?? null),
      save: (customer: Customer) => {
        customers.set(customer.id, customer);

        return okAsync(undefined);
      },
    },
    transactions: {
      findById: (id: string) => okAsync(transactions.get(id) ?? null),
      findByReference: (reference: string) =>
        okAsync([...transactions.values()].find((tx) => tx.reference === reference) ?? null),
      save: (transaction: Transaction) => {
        transactions.set(transaction.id, transaction);

        return okAsync(undefined);
      },
    },
    deliveries: {
      save: (delivery: unknown) => {
        if (delivery === null) return errAsync(insufficientStock('n/a', 0, 0));

        return okAsync(undefined);
      },
    },
    stockMovements: { append: () => okAsync(undefined) },
  } as unknown as RepositoryRegistry;

  return { repositories, products };
}

@Global()
@Module({})
class TestCheckoutModule {
  static register(repositories: RepositoryRegistry) {
    const config = loadAppConfig(makeEnv());
    const unitOfWork = {
      run: (work: (repos: RepositoryRegistry) => unknown) => work(repositories),
    };
    const pricing = new PricingPolicy(makePricingRules());
    const clock = new FixedClock(NOW);
    // A real UUID generator, not the sequential test double: the pay route
    // validates :id with ParseUUIDPipe, exactly like production traffic would hit.
    const ids = new UuidGenerator();
    const gateway = new FakePaymentGatewayAdapter({ apiBasePath: '/api/v1' });

    return {
      module: TestCheckoutModule,
      providers: [
        { provide: APP_CONFIG, useValue: config },
        { provide: CLOCK, useValue: clock },
        { provide: ID_GENERATOR, useValue: ids },
        { provide: UNIT_OF_WORK, useValue: unitOfWork },
        { provide: IDEMPOTENCY_KEY_REPOSITORY, useValue: new InMemoryIdempotencyKeyRepository() },
        {
          provide: CREATE_CHECKOUT_USE_CASE,
          useFactory: () => new CreateCheckoutUseCase(unitOfWork as never, pricing, clock, ids),
        },
        {
          provide: GET_ACCEPTANCE_TOKENS_USE_CASE,
          useFactory: () => new GetAcceptanceTokensUseCase(gateway),
        },
        {
          provide: PAY_CHECKOUT_USE_CASE,
          useFactory: () =>
            new PayCheckoutUseCase(
              unitOfWork as never,
              gateway,
              new SettleTransactionUseCase(clock, ids),
              clock,
            ),
        },
      ],
      exports: [
        APP_CONFIG,
        CLOCK,
        ID_GENERATOR,
        UNIT_OF_WORK,
        IDEMPOTENCY_KEY_REPOSITORY,
        CREATE_CHECKOUT_USE_CASE,
        GET_ACCEPTANCE_TOKENS_USE_CASE,
        PAY_CHECKOUT_USE_CASE,
      ],
    };
  }
}

describe('CheckoutController', () => {
  let app: INestApplication;
  let products: InMemoryProductRepository;

  beforeEach(async () => {
    const built = makeRepositories();
    products = built.products;

    const moduleRef = await Test.createTestingModule({
      imports: [TestCheckoutModule.register(built.repositories)],
      controllers: [CheckoutController],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe(`POST /${API_ROUTES.checkout.create}`, () => {
    it('rejects a request with no idempotency key', async () => {
      await request(app.getHttpServer()).post('/checkout').send(validBody()).expect(400);
    });

    it('opens a PENDING transaction and returns the published contract shape', async () => {
      const response = await request(app.getHttpServer())
        .post('/checkout')
        .set(IDEMPOTENCY_KEY_HEADER, 'ck-1')
        .send(validBody())
        .expect(201);

      expect(response.body).toMatchObject({
        status: 'PENDING',
        breakdown: { totalInCents: 2_100_000 },
      });
    });

    it('replays the same response for a retried idempotency key', async () => {
      const first = await request(app.getHttpServer())
        .post('/checkout')
        .set(IDEMPOTENCY_KEY_HEADER, 'ck-2')
        .send(validBody())
        .expect(201);

      const second = await request(app.getHttpServer())
        .post('/checkout')
        .set(IDEMPOTENCY_KEY_HEADER, 'ck-2')
        .send(validBody())
        .expect(201);

      expect(second.body).toEqual(first.body);
    });

    it('answers 409 when the product has insufficient stock', async () => {
      const response = await request(app.getHttpServer())
        .post('/checkout')
        .set(IDEMPOTENCY_KEY_HEADER, 'ck-3')
        .send({ ...validBody(), quantity: 10 })
        .expect(409);

      expect(response.body).toMatchObject({ error: { kind: 'InsufficientStock' } });
    });

    it('rejects a malformed body before it reaches the use case', async () => {
      await request(app.getHttpServer())
        .post('/checkout')
        .set(IDEMPOTENCY_KEY_HEADER, 'ck-4')
        .send({ ...validBody(), customer: { ...validBody().customer, email: 'not-an-email' } })
        .expect(400);
    });

    it('rejects a quantity beyond the allowed maximum', async () => {
      await request(app.getHttpServer())
        .post('/checkout')
        .set(IDEMPOTENCY_KEY_HEADER, 'ck-5')
        .send({ ...validBody(), quantity: 51 })
        .expect(400);
    });
  });

  describe(`GET /${API_ROUTES.checkout.acceptanceTokens}`, () => {
    it("proxies the gateway's acceptance tokens, including where to tokenise a card", async () => {
      const response = await request(app.getHttpServer())
        .get(`/${API_ROUTES.checkout.acceptanceTokens}`)
        .expect(200);

      expect(response.body).toMatchObject({
        publicKey: 'pub_test_fake00000000000000000000',
        tokenizationUrl: '/api/v1/checkout/dev-tokenize',
      });
    });
  });

  describe('POST /checkout/:id/pay', () => {
    const openTransaction = async (): Promise<string> => {
      const response = await request(app.getHttpServer())
        .post('/checkout')
        .set(IDEMPOTENCY_KEY_HEADER, `open-${Math.random()}`)
        .send(validBody())
        .expect(201);

      return response.body.transactionId as string;
    };

    it('rejects a request with no idempotency key', async () => {
      const transactionId = await openTransaction();

      await request(app.getHttpServer())
        .post(`/checkout/${transactionId}/pay`)
        .send(payBody())
        .expect(400);
    });

    it('approves a card ending in 4242 and returns the published contract shape', async () => {
      const transactionId = await openTransaction();

      const response = await request(app.getHttpServer())
        .post(`/checkout/${transactionId}/pay`)
        .set(IDEMPOTENCY_KEY_HEADER, 'pay-1')
        .send(payBody('4242'))
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'APPROVED',
        card: { brand: 'visa', lastFour: '4242' },
      });
    });

    it('declines a card ending in 1111 and releases the reserved stock', async () => {
      const transactionId = await openTransaction();

      const response = await request(app.getHttpServer())
        .post(`/checkout/${transactionId}/pay`)
        .set(IDEMPOTENCY_KEY_HEADER, 'pay-2')
        .send(payBody('1111'))
        .expect(200);

      expect(response.body.status).toBe('DECLINED');
      const reloaded = (await products.findById(PRODUCT_ID))._unsafeUnwrap();
      expect(reloaded?.stock).toBe(3);
    });

    it('replays the same response for a retried idempotency key, without charging twice', async () => {
      const transactionId = await openTransaction();

      const first = await request(app.getHttpServer())
        .post(`/checkout/${transactionId}/pay`)
        .set(IDEMPOTENCY_KEY_HEADER, 'pay-3')
        .send(payBody('4242'))
        .expect(200);

      const second = await request(app.getHttpServer())
        .post(`/checkout/${transactionId}/pay`)
        .set(IDEMPOTENCY_KEY_HEADER, 'pay-3')
        .send(payBody('4242'))
        .expect(200);

      expect(second.body).toEqual(first.body);
    });

    it('answers 404 for a transaction that does not exist', async () => {
      await request(app.getHttpServer())
        .post('/checkout/99999999-9999-4999-8999-999999999999/pay')
        .set(IDEMPOTENCY_KEY_HEADER, 'pay-4')
        .send(payBody())
        .expect(404);
    });

    it('answers 409 when the transaction already settled', async () => {
      const transactionId = await openTransaction();
      await request(app.getHttpServer())
        .post(`/checkout/${transactionId}/pay`)
        .set(IDEMPOTENCY_KEY_HEADER, 'pay-5')
        .send(payBody('4242'))
        .expect(200);

      const response = await request(app.getHttpServer())
        .post(`/checkout/${transactionId}/pay`)
        .set(IDEMPOTENCY_KEY_HEADER, 'pay-6')
        .send(payBody('4242'))
        .expect(409);

      expect(response.body).toMatchObject({ error: { kind: 'TransactionNotPending' } });
    });

    it('rejects a malformed body before it reaches the use case', async () => {
      const transactionId = await openTransaction();

      await request(app.getHttpServer())
        .post(`/checkout/${transactionId}/pay`)
        .set(IDEMPOTENCY_KEY_HEADER, 'pay-7')
        .send({ ...payBody(), cardLastFour: 'abcd' })
        .expect(400);
    });

    it('rejects a malformed transaction id before it reaches the use case', async () => {
      await request(app.getHttpServer())
        .post('/checkout/not-a-uuid/pay')
        .set(IDEMPOTENCY_KEY_HEADER, 'pay-8')
        .send(payBody())
        .expect(400);
    });
  });
});
