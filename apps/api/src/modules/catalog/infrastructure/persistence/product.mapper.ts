import type { Result } from 'neverthrow';

import { Money } from '../../../../shared/domain/money';
import type { DomainError } from '../../../../shared/result/domain-error';
import { Product } from '../../domain/product';
import { ProductEntity } from './product.entity';

/**
 * Translates between the persisted row and the domain entity.
 *
 * This is the price of keeping the domain free of the ORM, and it buys two things:
 * the schema can change without touching business rules, and a row that violates a
 * domain invariant — a negative price, a malformed currency — fails here as a
 * `Result` instead of becoming an impossible object deeper in the system.
 */
export const productMapper = {
  toDomain(row: ProductEntity): Result<Product, DomainError> {
    return Money.create(row.priceInCents, row.currency).map((price) =>
      Product.rehydrate({
        id: row.id,
        sku: row.sku,
        name: row.name,
        description: row.description,
        price,
        imageUrl: row.imageUrl,
        stock: row.stock,
        version: row.version,
      }),
    );
  },

  /**
   * Copies domain state onto the row the unit of work is tracking.
   *
   * Writing onto the managed instance — rather than returning a new one — is what
   * lets MikroORM's identity map detect the change and include it in the single
   * flush at commit time.
   */
  applyToRow(product: Product, row: ProductEntity): void {
    const snapshot = product.toSnapshot();

    row.sku = snapshot.sku;
    row.name = snapshot.name;
    row.description = snapshot.description;
    row.priceInCents = snapshot.price.amountInCents;
    row.currency = snapshot.price.currency;
    row.imageUrl = snapshot.imageUrl;
    row.stock = snapshot.stock;
  },

  toNewRow(product: Product): ProductEntity {
    const row = new ProductEntity();
    row.id = product.id;
    productMapper.applyToRow(product, row);

    return row;
  },
};
