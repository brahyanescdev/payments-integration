import type { ResultAsync } from 'neverthrow';

import type { DomainError } from '../../../shared/result/domain-error';
import type { UnitOfWork } from '../../../shared/unit-of-work/unit-of-work.port';
import type { ProductPage } from '../domain/ports/product.repository';

/** Injection token for {@link ListProductsUseCase}. */
export const LIST_PRODUCTS_USE_CASE = Symbol('LIST_PRODUCTS_USE_CASE');

/**
 * Reads a page of the catalogue.
 *
 * A query, not a command, so it never touches stock — but it still runs through
 * the unit of work rather than a bare repository, because that is the only place a
 * `ProductRepository` instance exists. Read-only work inside a transaction simply
 * has nothing to roll back.
 */
export class ListProductsUseCase {
  constructor(private readonly unitOfWork: UnitOfWork) {}

  execute(limit: number, offset: number): ResultAsync<ProductPage, DomainError> {
    return this.unitOfWork.run((repositories) => repositories.products.list(limit, offset));
  }
}
