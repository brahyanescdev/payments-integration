import { FixedClock, SystemClock } from './clock.port';

describe('SystemClock', () => {
  it('returns the current instant', () => {
    const before = Date.now();
    const now = new SystemClock().now().getTime();

    expect(now).toBeGreaterThanOrEqual(before);
    expect(now).toBeLessThanOrEqual(Date.now());
  });
});

describe('FixedClock', () => {
  it('keeps returning the same instant so assertions stay deterministic', () => {
    const clock = new FixedClock(new Date('2026-08-22T13:00:00.000Z'));

    expect(clock.now().toISOString()).toBe('2026-08-22T13:00:00.000Z');
    expect(clock.now().toISOString()).toBe('2026-08-22T13:00:00.000Z');
  });

  it('advances on demand, which is how expiry rules get tested without waiting', () => {
    const clock = new FixedClock(new Date('2026-08-22T13:00:00.000Z'));

    clock.advanceBy(90 * 60 * 1000);

    expect(clock.now().toISOString()).toBe('2026-08-22T14:30:00.000Z');
  });
});
