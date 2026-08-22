/**
 * Kinds of inventory movement.
 *
 * `RESERVE` takes units out of available stock when a transaction opens, `COMMIT`
 * records that an approved payment consumed them, and `RELEASE` puts them back
 * after a declined or failed payment.
 */
export const STOCK_MOVEMENT_TYPES = ['RESERVE', 'COMMIT', 'RELEASE'] as const;

export type StockMovementType = (typeof STOCK_MOVEMENT_TYPES)[number];

export interface StockMovementSnapshot {
  readonly id: string;
  readonly productId: string;
  readonly transactionId: string;
  readonly type: StockMovementType;
  readonly quantity: number;
  readonly createdAt: Date;
}

/**
 * An append-only inventory ledger entry.
 *
 * The database carries `UNIQUE (transaction_id, type)`, which is what makes stock
 * updates idempotent by construction: replaying a webhook, or settling the same
 * transaction twice, cannot record a second `COMMIT` or `RELEASE` and therefore
 * cannot drift the count. Entries are never updated or deleted, so the ledger also
 * explains how the current stock was reached.
 */
export class StockMovement {
  private constructor(
    readonly id: string,
    readonly productId: string,
    readonly transactionId: string,
    readonly type: StockMovementType,
    readonly quantity: number,
    readonly createdAt: Date,
  ) {}

  static record(input: {
    id: string;
    productId: string;
    transactionId: string;
    type: StockMovementType;
    quantity: number;
    now: Date;
  }): StockMovement {
    return new StockMovement(
      input.id,
      input.productId,
      input.transactionId,
      input.type,
      input.quantity,
      input.now,
    );
  }

  static rehydrate(snapshot: StockMovementSnapshot): StockMovement {
    return new StockMovement(
      snapshot.id,
      snapshot.productId,
      snapshot.transactionId,
      snapshot.type,
      snapshot.quantity,
      snapshot.createdAt,
    );
  }

  toSnapshot(): StockMovementSnapshot {
    return {
      id: this.id,
      productId: this.productId,
      transactionId: this.transactionId,
      type: this.type,
      quantity: this.quantity,
      createdAt: this.createdAt,
    };
  }
}
