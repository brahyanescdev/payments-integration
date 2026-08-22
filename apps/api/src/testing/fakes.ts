import { okAsync, type ResultAsync } from 'neverthrow';

import type { DomainError } from '../shared/result/domain-error';
import type { RepositoryRegistry, UnitOfWork } from '../shared/unit-of-work/unit-of-work.port';
import type { Product } from '../modules/catalog/domain/product';
import type {
  ProductPage,
  ProductRepository,
} from '../modules/catalog/domain/ports/product.repository';

/**
 * Runs work against a fixed repository registry, with no transaction underneath.
 *
 * Use-case tests care whether the right repository calls happen in the right
 * order, not whether PostgreSQL actually rolls back — that guarantee is proven
 * once, against a real database, by `mikro-unit-of-work.spec.ts`. This double lets
 * every use case be tested without paying for a connection.
 */
export class FakeUnitOfWork implements UnitOfWork {
  constructor(private readonly repositories: Partial<RepositoryRegistry>) {}

  run<T>(
    work: (repositories: RepositoryRegistry) => ResultAsync<T, DomainError>,
  ): ResultAsync<T, DomainError> {
    return work(this.repositories as RepositoryRegistry);
  }
}

/**
 * In-memory catalogue, ordered and paginated the same way the real repository is.
 *
 * Fast enough for controller-level tests that only care about HTTP wiring, leaving
 * the real MikroORM adapter to be exercised against PostgreSQL in its own suite.
 */
export class InMemoryProductRepository implements ProductRepository {
  private readonly products = new Map<string, Product>();

  seed(products: readonly Product[]): this {
    for (const product of products) {
      this.products.set(product.id, product);
    }

    return this;
  }

  findById(productId: string): ResultAsync<Product | null, DomainError> {
    return okAsync(this.products.get(productId) ?? null);
  }

  list(limit: number, offset: number): ResultAsync<ProductPage, DomainError> {
    const items = [...this.products.values()].sort((a, b) => a.name.localeCompare(b.name));

    return okAsync({ items: items.slice(offset, offset + limit), total: items.length });
  }

  save(product: Product): ResultAsync<void, DomainError> {
    this.products.set(product.id, product);

    return okAsync(undefined);
  }
}
