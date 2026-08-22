import type { HealthResponse } from '@payments/shared';

import type { Clock } from '../../../shared/clock/clock.port';

/** Injection token for {@link GetHealthUseCase}. */
export const GET_HEALTH_USE_CASE = Symbol('GET_HEALTH_USE_CASE');

/**
 * Reports that the process is alive and which version is running.
 *
 * Deliberately shallow: App Runner uses this endpoint to decide whether to keep a
 * deployment, so it must not depend on the database or the payment gateway. A
 * check that fails when a downstream dependency blips would roll back a perfectly
 * good release.
 */
export class GetHealthUseCase {
  constructor(
    private readonly version: string,
    private readonly clock: Clock,
  ) {}

  execute(): HealthResponse {
    return {
      status: 'ok',
      timestamp: this.clock.now().toISOString(),
      version: this.version,
    };
  }
}
