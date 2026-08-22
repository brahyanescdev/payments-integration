import { makeWebEnv } from '../testing/config.fixture';
import { loadWebConfig } from './web-config';

describe('loadWebConfig', () => {
  it('projects a valid environment into typed configuration', () => {
    const config = loadWebConfig(makeWebEnv());

    expect(config.apiBaseUrl).toBe('http://localhost:3000/api/v1');
    expect(config.transactionPolling.intervalMs).toBe(2_000);
  });

  it('strips trailing slashes so request paths never end up doubled', () => {
    const config = loadWebConfig(
      makeWebEnv({ VITE_API_BASE_URL: 'https://api.example.test/v1//' }),
    );

    expect(config.apiBaseUrl).toBe('https://api.example.test/v1');
  });

  it('applies polling defaults when the variables are absent', () => {
    const config = loadWebConfig(
      makeWebEnv({
        VITE_TRANSACTION_POLL_INTERVAL_MS: undefined,
        VITE_TRANSACTION_POLL_TIMEOUT_MS: undefined,
      }),
    );

    expect(config.transactionPolling).toEqual({ intervalMs: 2_000, timeoutMs: 180_000 });
  });

  it('names the offending variable when the API URL is missing', () => {
    expect(() => loadWebConfig(makeWebEnv({ VITE_API_BASE_URL: undefined }))).toThrow(
      /VITE_API_BASE_URL/,
    );
  });

  it('labels a whole-object failure as "(root)" so the message stays readable', () => {
    expect(() => loadWebConfig(null as unknown as Record<string, unknown>)).toThrow(/\(root\)/);
  });

  it('rejects a non-positive polling interval instead of busy-looping at runtime', () => {
    expect(() => loadWebConfig(makeWebEnv({ VITE_TRANSACTION_POLL_INTERVAL_MS: '0' }))).toThrow(
      /VITE_TRANSACTION_POLL_INTERVAL_MS/,
    );
  });
});
