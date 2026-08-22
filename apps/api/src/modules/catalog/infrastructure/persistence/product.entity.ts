import { Entity, PrimaryKey, Property } from '@mikro-orm/core';

/**
 * Persistence shape of a product.
 *
 * Separate from the `Product` domain entity on purpose: this class carries ORM
 * decorators and a database identity, while the domain entity carries the rules.
 * A mapper bridges the two, which is what keeps the domain free of MikroORM and
 * lets the schema change without touching business logic.
 */
@Entity({ tableName: 'products' })
export class ProductEntity {
  @PrimaryKey({ type: 'uuid' })
  id!: string;

  @Property({ type: 'string', unique: true, length: 64 })
  sku!: string;

  @Property({ type: 'string', length: 160 })
  name!: string;

  @Property({ type: 'text' })
  description!: string;

  /** Integer cents; the database never stores a fractional amount. */
  @Property({ type: 'integer' })
  priceInCents!: number;

  @Property({ type: 'string', length: 3 })
  currency!: string;

  @Property({ type: 'text' })
  imageUrl!: string;

  @Property({ type: 'integer' })
  stock!: number;

  /**
   * Optimistic lock. Two concurrent buyers of the last unit read the same version;
   * the second flush raises and the caller gets `ConcurrencyConflict` instead of
   * the shop overselling.
   */
  @Property({ version: true, type: 'integer' })
  version!: number;

  @Property({ type: 'Date', onCreate: () => new Date() })
  createdAt!: Date;

  @Property({ type: 'Date', onCreate: () => new Date(), onUpdate: () => new Date() })
  updatedAt!: Date;
}
