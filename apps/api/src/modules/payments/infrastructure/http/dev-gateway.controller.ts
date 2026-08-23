import { randomUUID } from 'node:crypto';

import { Body, Controller, Inject, NotFoundException, Post } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';

import { APP_CONFIG, type AppConfig } from '../../../../config/app.config';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- Nest resolves this DTO class at runtime via reflect-metadata; see the note on this pattern in products.controller.ts.
import { DevTokenizeRequestDto } from './dev-tokenize-request.dto';

/**
 * Stands in for the gateway's own `POST /tokens/cards`, active only in fake mode.
 *
 * The frontend's card-tokenisation call is identical in code whichever driver is
 * active — it always posts to whatever `tokenizationUrl` the acceptance-tokens
 * response names. `FakePaymentGatewayAdapter` names this endpoint; the real
 * adapter names the gateway's own origin instead, so this stub is simply never
 * referenced outside of `PAYMENT_GATEWAY_DRIVER=fake`. It still guards itself
 * with a 404 when a real driver is configured, rather than trusting that nothing
 * will ever call it by mistake.
 *
 * The resulting token deliberately encodes the card's last four digits, mirroring
 * the real sandbox's own documented test cards (a number ending in 4242 always
 * approves, 1111 always declines) — see `FakePaymentGatewayAdapter.chargeCard`.
 */
@ApiExcludeController()
@Controller('checkout/dev-tokenize')
export class DevGatewayController {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  @Post()
  tokenize(@Body() body: DevTokenizeRequestDto): {
    status: 'CREATED';
    data: { id: string; last_four: string; exp_month: string; exp_year: string };
  } {
    if (this.config.psp.driver !== 'fake') {
      throw new NotFoundException();
    }

    const lastFour = body.number.slice(-4);

    return {
      status: 'CREATED',
      data: {
        id: `tok_fake_${lastFour}_${randomUUID()}`,
        last_four: lastFour,
        exp_month: body.exp_month,
        exp_year: body.exp_year,
      },
    };
  }
}
