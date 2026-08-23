import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  UseInterceptors,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  API_ROUTES,
  type AcceptanceTokensDto,
  type CheckoutCreatedDto,
  type TransactionDto,
} from '@payments/shared';

import { unwrapOrThrow } from '../../../../shared/http/domain-error.http';
import { IdempotencyInterceptor } from '../../../../shared/idempotency/idempotency.interceptor';
import {
  CREATE_CHECKOUT_USE_CASE,
  type CreateCheckoutUseCase,
} from '../../application/create-checkout.use-case';
import {
  GET_ACCEPTANCE_TOKENS_USE_CASE,
  type GetAcceptanceTokensUseCase,
} from '../../application/get-acceptance-tokens.use-case';
import {
  PAY_CHECKOUT_USE_CASE,
  type PayCheckoutUseCase,
} from '../../application/pay-checkout.use-case';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- see the note on this pattern in products.controller.ts: Nest resolves this class at runtime via reflect-metadata, so it must stay a value import.
import { CreateCheckoutRequestDto } from './create-checkout-request.dto';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- same reason as CreateCheckoutRequestDto above.
import { PayCheckoutRequestDto } from './pay-checkout-request.dto';
import { toCheckoutCreatedDto } from './checkout.presenter';
import { toTransactionDto } from './transaction.presenter';

/** Inbound HTTP adapter for opening a checkout, reading the gateway's terms, and paying. */
@ApiTags('checkout')
@Controller(API_ROUTES.checkout.create)
export class CheckoutController {
  constructor(
    @Inject(CREATE_CHECKOUT_USE_CASE) private readonly createCheckout: CreateCheckoutUseCase,
    @Inject(GET_ACCEPTANCE_TOKENS_USE_CASE)
    private readonly getAcceptanceTokens: GetAcceptanceTokensUseCase,
    @Inject(PAY_CHECKOUT_USE_CASE) private readonly payCheckout: PayCheckoutUseCase,
  ) {}

  @Post()
  @HttpCode(201)
  @UseInterceptors(IdempotencyInterceptor)
  @ApiOperation({
    summary: 'Opens a PENDING transaction, reserving stock. Requires an Idempotency-Key header.',
  })
  @ApiOkResponse({ description: 'The transaction was opened.' })
  async create(@Body() body: CreateCheckoutRequestDto): Promise<CheckoutCreatedDto> {
    const result = await this.createCheckout.execute({
      productId: body.productId,
      quantity: body.quantity,
      customer: body.customer,
      delivery: {
        recipientName: body.delivery.recipientName,
        phone: body.delivery.phone,
        address: {
          line1: body.delivery.addressLine1,
          line2: body.delivery.addressLine2 ?? null,
          city: body.delivery.city,
          region: body.delivery.region,
          country: body.delivery.country.toUpperCase(),
          postalCode: body.delivery.postalCode,
        },
      },
    });

    return toCheckoutCreatedDto(unwrapOrThrow(result));
  }

  @Get('acceptance-tokens')
  @ApiOperation({ summary: "Proxies the gateway's terms and public key" })
  @ApiOkResponse({ description: 'Acceptance tokens the buyer must agree to before paying.' })
  async acceptanceTokens(): Promise<AcceptanceTokensDto> {
    return unwrapOrThrow(await this.getAcceptanceTokens.execute());
  }

  @Post(':id/pay')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(IdempotencyInterceptor)
  @ApiOperation({
    summary: 'Submits the charge for an open transaction. Requires an Idempotency-Key header.',
  })
  @ApiOkResponse({ description: 'The transaction after submitting the charge.' })
  async pay(
    @Param('id', ParseUUIDPipe) transactionId: string,
    @Body() body: PayCheckoutRequestDto,
  ): Promise<TransactionDto> {
    const result = await this.payCheckout.execute(transactionId, body);

    return toTransactionDto(unwrapOrThrow(result));
  }
}
