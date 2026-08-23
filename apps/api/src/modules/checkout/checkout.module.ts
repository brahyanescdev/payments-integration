import { Module } from '@nestjs/common';

import { APP_CONFIG, type AppConfig } from '../../config/app.config';
import { CLOCK, SystemClock, type Clock } from '../../shared/clock/clock.port';
import { ID_GENERATOR, UuidGenerator, type IdGenerator } from '../../shared/id/id-generator.port';
import { UNIT_OF_WORK, type UnitOfWork } from '../../shared/unit-of-work/unit-of-work.port';
import {
  PAYMENT_GATEWAY,
  type PaymentGatewayPort,
} from '../payments/domain/ports/payment-gateway.port';
import { PaymentsModule } from '../payments/payments.module';
import {
  CREATE_CHECKOUT_USE_CASE,
  CreateCheckoutUseCase,
} from './application/create-checkout.use-case';
import {
  GET_ACCEPTANCE_TOKENS_USE_CASE,
  GetAcceptanceTokensUseCase,
} from './application/get-acceptance-tokens.use-case';
import { PAY_CHECKOUT_USE_CASE, PayCheckoutUseCase } from './application/pay-checkout.use-case';
import {
  SETTLE_TRANSACTION_USE_CASE,
  SettleTransactionUseCase,
} from './application/settle-transaction.use-case';
import { PricingPolicy } from './domain/pricing-policy';
import { CheckoutController } from './infrastructure/http/checkout.controller';

/** Injection token for the {@link PricingPolicy} instance, built from configuration. */
const PRICING_POLICY = Symbol('PRICING_POLICY');

/** Wiring for the checkout slice: opening a transaction, paying it, and reading the gateway's terms. */
@Module({
  imports: [PaymentsModule],
  controllers: [CheckoutController],
  providers: [
    { provide: CLOCK, useClass: SystemClock },
    { provide: ID_GENERATOR, useClass: UuidGenerator },
    {
      provide: PRICING_POLICY,
      useFactory: (config: AppConfig) =>
        new PricingPolicy({
          currency: config.checkout.currency,
          baseFeeInCents: config.checkout.baseFeeInCents,
          deliveryFeeInCents: config.checkout.deliveryFeeInCents,
          freeDeliveryThresholdInCents: config.checkout.freeDeliveryThresholdInCents,
        }),
      inject: [APP_CONFIG],
    },
    {
      provide: CREATE_CHECKOUT_USE_CASE,
      useFactory: (
        unitOfWork: UnitOfWork,
        pricing: PricingPolicy,
        clock: Clock,
        ids: IdGenerator,
      ) => new CreateCheckoutUseCase(unitOfWork, pricing, clock, ids),
      inject: [UNIT_OF_WORK, PRICING_POLICY, CLOCK, ID_GENERATOR],
    },
    {
      provide: GET_ACCEPTANCE_TOKENS_USE_CASE,
      useFactory: (gateway: PaymentGatewayPort) => new GetAcceptanceTokensUseCase(gateway),
      inject: [PAYMENT_GATEWAY],
    },
    {
      provide: SETTLE_TRANSACTION_USE_CASE,
      useFactory: (clock: Clock, ids: IdGenerator) => new SettleTransactionUseCase(clock, ids),
      inject: [CLOCK, ID_GENERATOR],
    },
    {
      provide: PAY_CHECKOUT_USE_CASE,
      useFactory: (
        unitOfWork: UnitOfWork,
        gateway: PaymentGatewayPort,
        settleTransaction: SettleTransactionUseCase,
        clock: Clock,
      ) => new PayCheckoutUseCase(unitOfWork, gateway, settleTransaction, clock),
      inject: [UNIT_OF_WORK, PAYMENT_GATEWAY, SETTLE_TRANSACTION_USE_CASE, CLOCK],
    },
  ],
})
export class CheckoutModule {}
