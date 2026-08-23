import { Body, Controller, HttpCode, HttpStatus, Inject, Post } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';

import { unwrapOrThrow } from '../../../../shared/http/domain-error.http';
import {
  PROCESS_PAYMENT_WEBHOOK_USE_CASE,
  type ProcessPaymentWebhookUseCase,
} from '../../application/process-payment-webhook.use-case';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- Nest resolves this DTO class at runtime via reflect-metadata; see the note on this pattern in products.controller.ts.
import { WebhookPayloadDto } from './webhook-payload.dto';

/**
 * Inbound HTTP adapter for the gateway's asynchronous notification.
 *
 * Excluded from Swagger: this endpoint is called by the gateway, never by a
 * client browsing the API. `200` on every recognised outcome — settled, or
 * already settled, or a duplicate delivery — is deliberate: anything else tells
 * the gateway to retry an event that will never turn out differently.
 */
@ApiExcludeController()
@Controller('webhooks/payments')
export class WebhooksController {
  constructor(
    @Inject(PROCESS_PAYMENT_WEBHOOK_USE_CASE)
    private readonly processWebhook: ProcessPaymentWebhookUseCase,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async receive(@Body() body: WebhookPayloadDto): Promise<{ received: true }> {
    unwrapOrThrow(await this.processWebhook.execute(body));

    return { received: true };
  }
}
