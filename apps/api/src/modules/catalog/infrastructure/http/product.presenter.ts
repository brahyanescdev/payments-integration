import type { ProductDto } from '@payments/shared';

import type { Product } from '../../domain/product';

/**
 * Translates a domain product into the wire contract.
 *
 * The only place `isAvailable` is computed for the client: the domain exposes the
 * getter, the frontend gets a plain boolean, and nothing downstream re-derives
 * "available" from a stock number of its own.
 */
export function toProductDto(product: Product): ProductDto {
  const snapshot = product.toSnapshot();

  return {
    id: snapshot.id,
    sku: snapshot.sku,
    name: snapshot.name,
    description: snapshot.description,
    priceInCents: snapshot.price.amountInCents,
    currency: snapshot.price.currency,
    imageUrl: snapshot.imageUrl,
    stock: snapshot.stock,
    isAvailable: product.isAvailable,
  };
}
