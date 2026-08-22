import type { ResultAsync } from 'neverthrow';

import type { DomainError } from '../../../../shared/result/domain-error';
import type { Product } from '../product';

export interface ProductPage {
  readonly items: readonly Product[];
  readonly total: number;
}

/**
 * Outbound port for product storage.
 *
 * Declared in the domain and implemented in infrastructure, so the domain states
 * what it needs and the database decides how. `save` stages a change inside the
 * ambient unit of work rather than writing immediately — nothing reaches the
 * database until the unit commits.
 */
export interface ProductRepository {
  /**
   * Loads a product, tracked by the ambient unit of work.
   *
   * Safe to modify: the optimistic lock is enforced when the unit commits, not when
   * the row is read. Two concurrent buyers of the last unit read the same version
   * and the second commit fails with `ConcurrencyConflict` rather than overselling.
   */
  findById(productId: string): ResultAsync<Product | null, DomainError>;

  list(limit: number, offset: number): ResultAsync<ProductPage, DomainError>;

  save(product: Product): ResultAsync<void, DomainError>;
}

/** Injection token for {@link ProductRepository}. */
export const PRODUCT_REPOSITORY = Symbol('PRODUCT_REPOSITORY');
