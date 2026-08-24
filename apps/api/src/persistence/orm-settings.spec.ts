import { makeEnv } from '../config/env.fixture';
import { loadOrmSettings } from './orm-settings';

describe('loadOrmSettings', () => {
  it('projects a valid environment into the narrower ORM settings', () => {
    const settings = loadOrmSettings(makeEnv());

    expect(settings.databaseUrl).toBe(makeEnv().DATABASE_URL);
    expect(settings.debug).toBe(false);
  });

  it('enables debug only in development, never in test or production', () => {
    expect(loadOrmSettings(makeEnv({ NODE_ENV: 'development' })).debug).toBe(true);
    expect(loadOrmSettings(makeEnv({ NODE_ENV: 'test' })).debug).toBe(false);
    expect(loadOrmSettings(makeEnv({ NODE_ENV: 'production' })).debug).toBe(false);
  });

  it('defaults NODE_ENV to development when it is absent', () => {
    expect(loadOrmSettings(makeEnv({ NODE_ENV: undefined })).debug).toBe(true);
  });

  it('requires SSL only in production, since only a managed database like RDS demands it', () => {
    expect(loadOrmSettings(makeEnv({ NODE_ENV: 'development' })).requireSsl).toBe(false);
    expect(loadOrmSettings(makeEnv({ NODE_ENV: 'test' })).requireSsl).toBe(false);
    expect(loadOrmSettings(makeEnv({ NODE_ENV: 'production' })).requireSsl).toBe(true);
  });

  it('names the offending variable when DATABASE_URL is missing', () => {
    expect(() => loadOrmSettings(makeEnv({ DATABASE_URL: undefined }))).toThrow(/DATABASE_URL/);
  });

  it('rejects a DATABASE_URL that is not a valid URL', () => {
    expect(() => loadOrmSettings(makeEnv({ DATABASE_URL: 'not-a-url' }))).toThrow(/DATABASE_URL/);
  });

  it('labels a whole-object failure as "(root)" so the message stays readable', () => {
    expect(() => loadOrmSettings(null as unknown as Record<string, unknown>)).toThrow(/\(root\)/);
  });
});
