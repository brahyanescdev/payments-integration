import { Global, type INestApplication, Module, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { API_ROUTES, IDEMPOTENCY_KEY_HEADER } from '@payments/shared';
import { errAsync, okAsync } from 'neverthrow';
import request from 'supertest';

import { APP_CONFIG, loadAppConfig } from '../../../../config/app.config';
import { makeEnv } from '../../../../config/env.fixture';
import { CLOCK } from '../../../../shared/clock/clock.port';
import { FixedClock } from '../../../../shared/clock/clock.port';
import { IDEMPOTENCY_KEY_REPOSITORY } from '../../../../persistence/idempotency-key.repository';
import {
  InMemoryIdempotencyKeyRepository,
  InMemoryProductRepository,
} from '../../../../testing/fakes';
import { COP, makePricingRules, makeProduct } from '../../../../testing/builders';
import {
  UNIT_OF_WORK,
  type RepositoryRegistry,
} from '../../../../shared/unit-of-work/unit-of-work.port';
import { ID_GENERATOR, SequentialIdGenerator } from '../../../../shared/id/id-generator.port';
import { insufficientStock } from '../../../../shared/result/domain-error';
import {
  CREATE_CHECKOUT_USE_CASE,
  CreateCheckoutUseCase,
} from '../../application/create-checkout.use-case';
import {
  GET_ACCEPTANCE_TOKENS_USE_CASE,
  GetAcceptanceTokensUseCase,
} from '../../application/get-acceptance-tokens.use-case';
import { PricingPolicy } from '../../domain/pricing-policy';
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

@Global()
@Module({})
class TestCheckoutModule {
  static register(products: InMemoryProductRepository) {
    const config = loadAppConfig(makeEnv());

    const repositories = {
      products,
      customers: { findByEmail: () => okAsync(null), save: () => okAsync(undefined) },
      transactions: { save: () => okAsync(undefined) },
      deliveries: {
        save: (delivery: unknown) => {
          if (delivery === null) return errAsync(insufficientStock('n/a', 0, 0));

          return okAsync(undefined);
        },
      },
      stockMovements: { append: () => okAsync(undefined) },
    } as unknown as RepositoryRegistry;

    const unitOfWork = {
      run: (work: (repos: RepositoryRegistry) => unknown) => work(repositories),
    };
    const pricing = new PricingPolicy(makePricingRules());
    const clock = new FixedClock(NOW);
    const ids = new SequentialIdGenerator('gen');

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
          useFactory: () =>
            new GetAcceptanceTokensUseCase({
              getAcceptanceTokens: () =>
                okAsync({
                  publicKey: 'pub_test',
                  acceptance: { token: 'acc', permalink: 'https://example.test/terms' },
                  personalDataAuthorization: {
                    token: 'priv',
                    permalink: 'https://example.test/privacy',
                  },
                }),
            }),
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
      ],
    };
  }
}

describe('CheckoutController', () => {
  let app: INestApplication;
  let products: InMemoryProductRepository;

  beforeEach(async () => {
    products = new InMemoryProductRepository().seed([
      makeProduct({ id: PRODUCT_ID, price: COP(1_000_000), stock: 3 }),
    ]);

    const moduleRef = await Test.createTestingModule({
      imports: [TestCheckoutModule.register(products)],
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
    it("proxies the gateway's acceptance tokens", async () => {
      const response = await request(app.getHttpServer())
        .get(`/${API_ROUTES.checkout.acceptanceTokens}`)
        .expect(200);

      expect(response.body).toMatchObject({ publicKey: 'pub_test' });
    });
  });
});
