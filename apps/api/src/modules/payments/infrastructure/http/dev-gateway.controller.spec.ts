import { Global, type INestApplication, Module, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { APP_CONFIG, loadAppConfig } from '../../../../config/app.config';
import { makeEnv } from '../../../../config/env.fixture';
import { DevGatewayController } from './dev-gateway.controller';

const VALID_BODY = {
  number: '4242424242424242',
  cvc: '123',
  exp_month: '12',
  exp_year: '29',
  card_holder: 'Ana Perez',
};

@Global()
@Module({})
class TestConfigModule {
  static withDriver(driver: 'fake' | 'http') {
    const config = loadAppConfig(
      makeEnv(
        driver === 'http'
          ? {
              PAYMENT_GATEWAY_DRIVER: driver,
              PSP_PUBLIC_KEY: 'pub',
              PSP_PRIVATE_KEY: 'prv',
              PSP_INTEGRITY_SECRET: 'int',
              PSP_EVENTS_SECRET: 'evt',
            }
          : { PAYMENT_GATEWAY_DRIVER: driver },
      ),
    );

    return {
      module: TestConfigModule,
      providers: [{ provide: APP_CONFIG, useValue: config }],
      exports: [APP_CONFIG],
    };
  }
}

async function bootApp(driver: 'fake' | 'http'): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [TestConfigModule.withDriver(driver)],
    controllers: [DevGatewayController],
  }).compile();

  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
  await app.init();

  return app;
}

describe('DevGatewayController', () => {
  it('mints a token that encodes the last four digits', async () => {
    const app = await bootApp('fake');

    const response = await request(app.getHttpServer())
      .post('/checkout/dev-tokenize')
      .send(VALID_BODY)
      .expect(201);

    expect(response.body.data.id).toMatch(/^tok_fake_4242_/);
    expect(response.body.data.last_four).toBe('4242');

    await app.close();
  });

  it('mints a different token id on every call', async () => {
    const app = await bootApp('fake');

    const first = await request(app.getHttpServer())
      .post('/checkout/dev-tokenize')
      .send(VALID_BODY);
    const second = await request(app.getHttpServer())
      .post('/checkout/dev-tokenize')
      .send(VALID_BODY);

    expect(first.body.data.id).not.toBe(second.body.data.id);

    await app.close();
  });

  it('rejects a malformed card number', async () => {
    const app = await bootApp('fake');

    await request(app.getHttpServer())
      .post('/checkout/dev-tokenize')
      .send({ ...VALID_BODY, number: 'not-a-number' })
      .expect(400);

    await app.close();
  });

  it('answers 404 when a real gateway driver is configured, so this stub cannot be mistaken for the real one', async () => {
    const app = await bootApp('http');

    await request(app.getHttpServer()).post('/checkout/dev-tokenize').send(VALID_BODY).expect(404);

    await app.close();
  });
});
