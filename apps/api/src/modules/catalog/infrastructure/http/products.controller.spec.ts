import { Global, type INestApplication, Module, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { API_ROUTES } from '@payments/shared';
import request from 'supertest';

import { APP_CONFIG, type AppConfig, loadAppConfig } from '../../../../config/app.config';
import { makeEnv } from '../../../../config/env.fixture';
import { UNIT_OF_WORK } from '../../../../shared/unit-of-work/unit-of-work.port';
import { FakeUnitOfWork, InMemoryProductRepository } from '../../../../testing/fakes';
import { makeProduct } from '../../../../testing/builders';
import { CatalogModule } from '../../catalog.module';

/** Stands in for the global config module without touching process.env. */
@Global()
@Module({})
class TestConfigModule {
  static withConfig(config: AppConfig) {
    return {
      module: TestConfigModule,
      providers: [{ provide: APP_CONFIG, useValue: config }],
      exports: [APP_CONFIG],
    };
  }
}

/** Stands in for the persistence module with an in-memory catalogue. */
@Global()
@Module({})
class TestPersistenceModule {
  static withProducts(products: InMemoryProductRepository) {
    return {
      module: TestPersistenceModule,
      providers: [{ provide: UNIT_OF_WORK, useValue: new FakeUnitOfWork({ products }) }],
      exports: [UNIT_OF_WORK],
    };
  }
}

const ONE = makeProduct({
  id: '11111111-1111-4111-8111-000000000001',
  sku: 'AAA',
  name: 'Alfa',
  stock: 3,
});
const TWO = makeProduct({
  id: '11111111-1111-4111-8111-000000000002',
  sku: 'BBB',
  name: 'Beta',
  stock: 0,
});

describe('ProductsController', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const config = loadAppConfig(makeEnv({ CATALOG_PAGE_SIZE: '20' }));
    const products = new InMemoryProductRepository().seed([ONE, TWO]);

    const moduleRef = await Test.createTestingModule({
      imports: [
        TestConfigModule.withConfig(config),
        TestPersistenceModule.withProducts(products),
        CatalogModule,
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    // Mirrors main.ts: the controller's 400s (unknown params, out-of-range values)
    // depend on this pipe, so the test proves the same contract the deployed app has.
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe(`GET /${API_ROUTES.products.list}`, () => {
    it('returns the catalogue as the published contract shape', async () => {
      const response = await request(app.getHttpServer())
        .get(`/${API_ROUTES.products.list}`)
        .expect(200);

      expect(response.body).toEqual({
        total: 2,
        items: [
          expect.objectContaining({ sku: 'AAA', stock: 3, isAvailable: true }),
          expect.objectContaining({ sku: 'BBB', stock: 0, isAvailable: false }),
        ],
      });
    });

    it('paginates with page and pageSize', async () => {
      const response = await request(app.getHttpServer())
        .get(`/${API_ROUTES.products.list}?page=2&pageSize=1`)
        .expect(200);

      expect(response.body.items).toHaveLength(1);
      expect(response.body.items[0]).toMatchObject({ sku: 'BBB' });
      expect(response.body.total).toBe(2);
    });

    it('rejects a pageSize beyond the allowed maximum', async () => {
      await request(app.getHttpServer())
        .get(`/${API_ROUTES.products.list}?pageSize=1000`)
        .expect(400);
    });

    it('rejects an unknown query parameter rather than silently ignoring it', async () => {
      await request(app.getHttpServer()).get(`/${API_ROUTES.products.list}?unknown=1`).expect(400);
    });
  });

  describe(`GET /${API_ROUTES.products.detail(':id')}`, () => {
    it('returns the requested product', async () => {
      const response = await request(app.getHttpServer())
        .get(`/${API_ROUTES.products.detail(ONE.id)}`)
        .expect(200);

      expect(response.body).toMatchObject({ id: ONE.id, sku: 'AAA' });
    });

    it('answers 404 with the uniform error envelope for a missing product', async () => {
      const missingId = '99999999-9999-4999-8999-999999999999';

      const response = await request(app.getHttpServer())
        .get(`/${API_ROUTES.products.detail(missingId)}`)
        .expect(404);

      expect(response.body).toMatchObject({ error: { kind: 'ProductNotFound' } });
    });

    it('answers 400 for a malformed id, before it ever reaches the use case', async () => {
      await request(app.getHttpServer())
        .get(`/${API_ROUTES.products.detail('not-a-uuid')}`)
        .expect(400);
    });
  });
});
