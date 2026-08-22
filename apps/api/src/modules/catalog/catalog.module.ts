import { Module } from '@nestjs/common';

import { UNIT_OF_WORK, type UnitOfWork } from '../../shared/unit-of-work/unit-of-work.port';
import { GET_PRODUCT_USE_CASE, GetProductUseCase } from './application/get-product.use-case';
import { LIST_PRODUCTS_USE_CASE, ListProductsUseCase } from './application/list-products.use-case';
import { ProductsController } from './infrastructure/http/products.controller';

/** Wiring for the catalogue slice. */
@Module({
  controllers: [ProductsController],
  providers: [
    {
      provide: LIST_PRODUCTS_USE_CASE,
      useFactory: (unitOfWork: UnitOfWork) => new ListProductsUseCase(unitOfWork),
      inject: [UNIT_OF_WORK],
    },
    {
      provide: GET_PRODUCT_USE_CASE,
      useFactory: (unitOfWork: UnitOfWork) => new GetProductUseCase(unitOfWork),
      inject: [UNIT_OF_WORK],
    },
  ],
})
export class CatalogModule {}
