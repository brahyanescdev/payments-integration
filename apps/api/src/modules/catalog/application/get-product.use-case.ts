import { errAsync, okAsync, type ResultAsync } from 'neverthrow';

import { type DomainError, productNotFound } from '../../../shared/result/domain-error';
import type { UnitOfWork } from '../../../shared/unit-of-work/unit-of-work.port';
import type { Product } from '../domain/product';

/** Injection token for {@link GetProductUseCase}. */
export const GET_PRODUCT_USE_CASE = Symbol('GET_PRODUCT_USE_CASE');

/**
 * Reads a single product, or fails with `ProductNotFound`.
 *
 * "Get this product or explain why not" is the actual business operation, so the
 * use case resolves the null case itself rather than handing a nullable value to
 * the controller and asking it to invent the 404.
 */
export class GetProductUseCase {
  constructor(private readonly unitOfWork: UnitOfWork) {}

  execute(productId: string): ResultAsync<Product, DomainError> {
    return this.unitOfWork.run((repositories) =>
      repositories.products
        .findById(productId)
        .andThen((product) =>
          product === null ? errAsync(productNotFound(productId)) : okAsync(product),
        ),
    );
  }
}
