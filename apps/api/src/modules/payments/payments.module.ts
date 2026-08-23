import { Module } from '@nestjs/common';

import { APP_CONFIG, type AppConfig } from '../../config/app.config';
import { PAYMENT_GATEWAY, type PaymentGatewayPort } from './domain/ports/payment-gateway.port';
import { FakePaymentGatewayAdapter } from './infrastructure/gateway/fake-payment-gateway.adapter';
import { HttpPaymentGatewayAdapter } from './infrastructure/gateway/http-payment-gateway.adapter';

/**
 * Wiring for the payment gateway slice.
 *
 * The adapter is chosen once, at boot, from `PAYMENT_GATEWAY_DRIVER` — nothing
 * downstream ever branches on which one is active.
 */
@Module({
  providers: [
    {
      provide: PAYMENT_GATEWAY,
      useFactory: (config: AppConfig): PaymentGatewayPort => {
        if (config.psp.driver === 'fake') {
          return new FakePaymentGatewayAdapter();
        }

        return new HttpPaymentGatewayAdapter({
          baseUrl: config.psp.baseUrl,
          publicKey: config.psp.publicKey,
          timeoutMs: config.psp.timeoutMs,
        });
      },
      inject: [APP_CONFIG],
    },
  ],
  exports: [PAYMENT_GATEWAY],
})
export class PaymentsModule {}
