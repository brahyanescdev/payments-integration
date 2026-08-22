import { Controller, Get, Inject, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { API_ROUTES, type ProductDto, type ProductListDto } from '@payments/shared';

import { APP_CONFIG, type AppConfig } from '../../../../config/app.config';
import { unwrapOrThrow } from '../../../../shared/http/domain-error.http';
import {
  GET_PRODUCT_USE_CASE,
  type GetProductUseCase,
} from '../../application/get-product.use-case';
import {
  LIST_PRODUCTS_USE_CASE,
  type ListProductsUseCase,
} from '../../application/list-products.use-case';
// Nest resolves a decorated parameter's DTO class at runtime via
// emitDecoratorMetadata — ValidationPipe needs the actual constructor to
// instantiate and validate against, not just its shape. A `import type` here gets
// erased at compile time, so Nest sees `Object` as the metatype and silently skips
// validation. Every DTO bound with @Body()/@Query()/@Param() must stay a value
// import even though, from a pure type-usage analysis, it looks type-only.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ListProductsQueryDto } from './list-products-query.dto';
import { toProductDto } from './product.presenter';

/** Inbound HTTP adapter for the catalogue: translates requests, throws on failure. */
@ApiTags('products')
@Controller(API_ROUTES.products.list)
export class ProductsController {
  constructor(
    @Inject(LIST_PRODUCTS_USE_CASE) private readonly listProducts: ListProductsUseCase,
    @Inject(GET_PRODUCT_USE_CASE) private readonly getProduct: GetProductUseCase,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Lists the catalogue with stock, paginated' })
  @ApiOkResponse({ description: 'A page of products.' })
  async list(@Query() query: ListProductsQueryDto): Promise<ProductListDto> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? this.config.reliability.catalogPageSize;
    const offset = (page - 1) * pageSize;

    const result = await this.listProducts.execute(pageSize, offset);
    const { items, total } = unwrapOrThrow(result);

    return { items: items.map(toProductDto), total };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Reads a single product by id' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ description: 'The requested product.' })
  async detail(@Param('id', ParseUUIDPipe) id: string): Promise<ProductDto> {
    const result = await this.getProduct.execute(id);

    return toProductDto(unwrapOrThrow(result));
  }
}
