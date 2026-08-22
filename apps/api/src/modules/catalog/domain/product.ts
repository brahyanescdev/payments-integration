import { err, ok, type Result } from 'neverthrow';

import { type Money } from '../../../shared/domain/money';
import {
  type DomainError,
  insufficientStock,
  invalidQuantity,
} from '../../../shared/result/domain-error';

/** Plain projection of a product, used by mappers and read models. */
export interface ProductSnapshot {
  readonly id: string;
  readonly sku: string;
  readonly name: string;
  readonly description: string;
  readonly price: Money;
  readonly imageUrl: string;
  readonly stock: number;
  /** Optimistic-lock counter owned by the persistence layer. */
  readonly version: number;
}

/**
 * A sellable product and its available inventory.
 *
 * Stock is guarded by the entity rather than by the caller: `reserve` is the only
 * way the count goes down, and it refuses to oversell. That invariant plus the
 * optimistic-lock `version` is what keeps two simultaneous buyers from both
 * claiming the last unit — the second flush loses and its use case retries or
 * fails cleanly.
 */
export class Product {
  private constructor(
    readonly id: string,
    readonly sku: string,
    readonly name: string,
    readonly description: string,
    readonly price: Money,
    readonly imageUrl: string,
    private currentStock: number,
    readonly version: number,
  ) {}

  /** Rebuilds an instance from persisted state. */
  static rehydrate(snapshot: ProductSnapshot): Product {
    return new Product(
      snapshot.id,
      snapshot.sku,
      snapshot.name,
      snapshot.description,
      snapshot.price,
      snapshot.imageUrl,
      snapshot.stock,
      snapshot.version,
    );
  }

  get stock(): number {
    return this.currentStock;
  }

  get isAvailable(): boolean {
    return this.currentStock > 0;
  }

  /** Price for a whole line, before any fee. */
  lineTotal(quantity: number): Result<Money, DomainError> {
    if (!Number.isInteger(quantity) || quantity <= 0) {
      return err(invalidQuantity(quantity));
    }

    return this.price.multiply(quantity);
  }

  /**
   * Takes units out of available stock for a pending transaction.
   *
   * @returns An error when the quantity is not a positive integer, or when fewer
   *   units are available than requested.
   */
  reserve(quantity: number): Result<void, DomainError> {
    if (!Number.isInteger(quantity) || quantity <= 0) {
      return err(invalidQuantity(quantity));
    }

    if (quantity > this.currentStock) {
      return err(insufficientStock(this.id, quantity, this.currentStock));
    }

    this.currentStock -= quantity;

    return ok(undefined);
  }

  /**
   * Returns previously reserved units to available stock, after a declined or
   * failed payment.
   */
  release(quantity: number): Result<void, DomainError> {
    if (!Number.isInteger(quantity) || quantity <= 0) {
      return err(invalidQuantity(quantity));
    }

    this.currentStock += quantity;

    return ok(undefined);
  }

  toSnapshot(): ProductSnapshot {
    return {
      id: this.id,
      sku: this.sku,
      name: this.name,
      description: this.description,
      price: this.price,
      imageUrl: this.imageUrl,
      stock: this.currentStock,
      version: this.version,
    };
  }
}
