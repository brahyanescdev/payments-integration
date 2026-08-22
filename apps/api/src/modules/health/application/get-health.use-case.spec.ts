import { FixedClock } from '../../../shared/clock/clock.port';
import { GetHealthUseCase } from './get-health.use-case';

describe('GetHealthUseCase', () => {
  it('reports the running version and the instant of the check', () => {
    const clock = new FixedClock(new Date('2026-08-22T13:00:00.000Z'));
    const useCase = new GetHealthUseCase('1.2.3', clock);

    expect(useCase.execute()).toEqual({
      status: 'ok',
      timestamp: '2026-08-22T13:00:00.000Z',
      version: '1.2.3',
    });
  });

  it('re-reads the clock on every call so a cached response cannot go stale', () => {
    const clock = new FixedClock(new Date('2026-08-22T13:00:00.000Z'));
    const useCase = new GetHealthUseCase('1.2.3', clock);

    const first = useCase.execute();
    clock.advanceBy(1000);
    const second = useCase.execute();

    expect(second.timestamp).not.toBe(first.timestamp);
  });
});
