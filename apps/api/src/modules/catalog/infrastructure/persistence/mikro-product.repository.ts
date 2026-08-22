import type { EntityManager } from '@mikro-orm/postgresql';
import { ok, okAsync, Result, ResultAsync } from 'neverthrow';

import { type DomainError, persistence } from '../../../../shared/result/domain-error';
import type { Product } from '../../domain/product';
import type { ProductPage, ProductRepository } from '../../domain/ports/product.repository';
import { ProductEntity } from './product.entity';
import { productMapper } from './product.mapper';

/**
 * MikroORM adapter for {@link ProductRepository}.
 *
 * Constructed per unit of work with that unit's forked `EntityManager`, so every
 * repository in a piece of work shares one session and one commit.
 */
export class MikroProductRepository implements ProductRepository {
  /**
   * Domain object id to the managed row it came from.
   *
   * The domain entity is a plain object the ORM knows nothing about, so `save` needs
   * a way back to the tracked row in order to write onto it. Re-querying would work
   * — MikroORM's identity map returns the same instance — but keeping the link
   * explicit avoids a round trip and makes the mapping visible.
   */
  private readonly rowsById = new Map<string, ProductEntity>();

  constructor(private readonly em: EntityManager) {}

  findById(productId: string): ResultAsync<Product | null, DomainError> {
    return this.query('products.findById', () =>
      this.em.findOne(ProductEntity, { id: productId }),
    ).andThen((row) => (row === null ? ok(null) : this.track(row)));
  }

  list(limit: number, offset: number): ResultAsync<ProductPage, DomainError> {
    return this.query('products.list', () =>
      this.em.findAndCount(ProductEntity, {}, { limit, offset, orderBy: { name: 'asc' } }),
    ).andThen(([rows, total]) =>
      Result.combine(rows.map((row) => this.track(row))).map((items) => ({ items, total })),
    );
  }

  save(product: Product): ResultAsync<void, DomainError> {
    const tracked = this.rowsById.get(product.id);

    if (tracked !== undefined) {
      // Writing onto the managed row is what lets the identity map notice the change
      // and include it in the unit's single flush.
      productMapper.applyToRow(product, tracked);

      return okAsync(undefined);
    }

    const row = productMapper.toNewRow(product);
    this.em.persist(row);
    this.rowsById.set(product.id, row);

    return okAsync(undefined);
  }

  /** Maps a row to the domain and remembers the pairing for later writes. */
  private track(row: ProductEntity): Result<Product, DomainError> {
    return productMapper.toDomain(row).map((product) => {
      this.rowsById.set(product.id, row);

      return product;
    });
  }

  /** Wraps a driver call so a thrown database error becomes a `Persistence` value. */
  private query<T>(operation: string, run: () => Promise<T>): ResultAsync<T, DomainError> {
    return ResultAsync.fromPromise(run(), () => persistence(operation));
  }
}
