import { loadAppConfig } from './app.config';
import { makeEnv } from './env.fixture';

describe('loadAppConfig', () => {
  it('projects a valid environment into typed, grouped configuration', () => {
    const config = loadAppConfig(makeEnv());

    expect(config.port).toBe(3000);
    expect(config.version).toBe('1.2.3');
    expect(config.corsAllowedOrigins).toEqual(['http://localhost:5173']);
    expect(config.checkout.baseFeeInCents).toBe(300_000);
    expect(config.reliability.idempotencyTtlHours).toBe(24);
  });

  it('coerces numeric variables so downstream code never parses strings', () => {
    const config = loadAppConfig(makeEnv({ PORT: '8080', CHECKOUT_MAX_INSTALLMENTS: '12' }));

    expect(config.port).toStrictEqual(8080);
    expect(config.checkout.maxInstallments).toStrictEqual(12);
  });

  it('splits and trims the comma-separated CORS allow list', () => {
    const config = loadAppConfig(
      makeEnv({ CORS_ALLOWED_ORIGINS: 'https://a.example, https://b.example ,' }),
    );

    expect(config.corsAllowedOrigins).toEqual(['https://a.example', 'https://b.example']);
  });

  it('applies documented defaults for optional variables', () => {
    const config = loadAppConfig(makeEnv({ PORT: undefined, APP_VERSION: undefined }));

    expect(config.port).toBe(3000);
    expect(config.version).toBe('0.0.0-dev');
  });

  it('names the offending variable when one is missing', () => {
    expect(() => loadAppConfig(makeEnv({ DATABASE_URL: undefined }))).toThrow(/DATABASE_URL/);
  });

  it('rejects a malformed value rather than silently falling back', () => {
    expect(() => loadAppConfig(makeEnv({ CHECKOUT_CURRENCY: 'PESOS' }))).toThrow(
      /CHECKOUT_CURRENCY/,
    );
  });

  it('requires PSP credentials only when the real gateway driver is selected', () => {
    expect(() => loadAppConfig(makeEnv({ PAYMENT_GATEWAY_DRIVER: 'http' }))).toThrow(
      /PSP_PRIVATE_KEY/,
    );

    const config = loadAppConfig(
      makeEnv({
        PAYMENT_GATEWAY_DRIVER: 'http',
        PSP_PUBLIC_KEY: 'pub',
        PSP_PRIVATE_KEY: 'prv',
        PSP_INTEGRITY_SECRET: 'int',
        PSP_EVENTS_SECRET: 'evt',
      }),
    );

    expect(config.psp.driver).toBe('http');
    expect(config.psp.privateKey).toBe('prv');
  });

  it('labels a whole-object failure as "(root)" so the message stays readable', () => {
    expect(() => loadAppConfig(null as unknown as Record<string, unknown>)).toThrow(/\(root\)/);
  });

  it('reports every invalid variable at once instead of failing one at a time', () => {
    const error = (() => {
      try {
        loadAppConfig(makeEnv({ DATABASE_URL: undefined, CATALOG_PAGE_SIZE: 'many' }));
        return null;
      } catch (caught) {
        return caught as Error;
      }
    })();

    expect(error?.message).toMatch(/DATABASE_URL/);
    expect(error?.message).toMatch(/CATALOG_PAGE_SIZE/);
  });
});
