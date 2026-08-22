import { Global, type INestApplication, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { API_ROUTES, healthResponseSchema } from '@payments/shared';
import request from 'supertest';

import { APP_CONFIG, type AppConfig, loadAppConfig } from '../../../../config/app.config';
import { makeEnv } from '../../../../config/env.fixture';
import { HealthModule } from '../../health.module';

/** Stands in for the real global ConfigModule without touching process.env. */
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

describe('GET /health', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const config = loadAppConfig(makeEnv({ APP_VERSION: '9.9.9' }));

    const moduleRef = await Test.createTestingModule({
      imports: [TestConfigModule.withConfig(config), HealthModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('answers 200 with a payload that satisfies the published contract', async () => {
    const response = await request(app.getHttpServer()).get(`/${API_ROUTES.health}`).expect(200);

    expect(() => healthResponseSchema.parse(response.body)).not.toThrow();
  });

  it('reports the version supplied by configuration, not a hardcoded literal', async () => {
    const response = await request(app.getHttpServer()).get(`/${API_ROUTES.health}`).expect(200);

    expect(response.body.version).toBe('9.9.9');
  });
});
