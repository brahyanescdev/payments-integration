import { Controller, Get, Inject, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import type { TransactionDto } from '@payments/shared';

import { APP_CONFIG, type AppConfig } from '../../../../config/app.config';
import { unwrapOrThrow } from '../../../../shared/http/domain-error.http';
import {
  GET_TRANSACTION_USE_CASE,
  type GetTransactionUseCase,
} from '../../application/get-transaction.use-case';
import { toTransactionDto } from './transaction.presenter';

/** Inbound HTTP adapter for polling a transaction's status — Screens 4 and 5's data source. */
@ApiTags('transactions')
@Controller('transactions')
export class TransactionsController {
  constructor(
    @Inject(GET_TRANSACTION_USE_CASE) private readonly getTransaction: GetTransactionUseCase,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  @Get(':id')
  @ApiOperation({ summary: 'Reads a single transaction by id, for polling its status' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ description: 'The requested transaction.' })
  async detail(@Param('id', ParseUUIDPipe) id: string): Promise<TransactionDto> {
    const result = await this.getTransaction.execute(id);

    return toTransactionDto(unwrapOrThrow(result), this.config.psp.driver);
  }
}
