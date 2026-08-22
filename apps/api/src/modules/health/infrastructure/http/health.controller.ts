import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { API_ROUTES, type HealthResponse } from '@payments/shared';

import { GET_HEALTH_USE_CASE, type GetHealthUseCase } from '../../application/get-health.use-case';

/** Inbound HTTP adapter: translates a request into a use-case call and back. */
@ApiTags('health')
@Controller(API_ROUTES.health)
export class HealthController {
  constructor(@Inject(GET_HEALTH_USE_CASE) private readonly getHealth: GetHealthUseCase) {}

  @Get()
  @ApiOperation({ summary: 'Liveness probe used by the load balancer and the E2E harness' })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
        timestamp: { type: 'string', format: 'date-time' },
        version: { type: 'string', example: '0.1.0' },
      },
    },
  })
  check(): HealthResponse {
    return this.getHealth.execute();
  }
}
