import { healthResponseSchema } from './health.contract';

describe('healthResponseSchema', () => {
  const validPayload = {
    status: 'ok',
    timestamp: '2026-08-22T13:00:00.000Z',
    version: '0.1.0',
  };

  it('accepts a well-formed liveness payload', () => {
    expect(healthResponseSchema.parse(validPayload)).toEqual(validPayload);
  });

  it('rejects a timestamp that is not ISO-8601', () => {
    const result = healthResponseSchema.safeParse({ ...validPayload, timestamp: '22/08/2026' });

    expect(result.success).toBe(false);
  });

  it('rejects any status other than "ok" so a degraded service cannot report healthy', () => {
    const result = healthResponseSchema.safeParse({ ...validPayload, status: 'degraded' });

    expect(result.success).toBe(false);
  });

  it('rejects an empty version', () => {
    const result = healthResponseSchema.safeParse({ ...validPayload, version: '' });

    expect(result.success).toBe(false);
  });
});
