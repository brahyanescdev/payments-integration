/**
 * Every failure the system can express, as one discriminated union.
 *
 * Errors are values, not exceptions: use cases return `Result<T, DomainError>` and
 * compose with `andThen` / `mapErr`, so the failure paths are as visible in the
 * signature as the happy one. The `kind` discriminator is what lets the HTTP
 * adapter translate a failure without the domain knowing that HTTP exists, and
 * what makes an unhandled case a compile error rather than a silent 500.
 */

interface ErrorShape<Kind extends string, Details = undefined> {
  readonly kind: Kind;
  /** Operator-facing description. User-facing copy lives in the frontend dictionary. */
  readonly message: string;
  readonly details: Details;
}

export type ProductNotFoundError = ErrorShape<'ProductNotFound', { productId: string }>;
export type InsufficientStockError = ErrorShape<
  'InsufficientStock',
  { productId: string; requested: number; available: number }
>;
export type InvalidQuantityError = ErrorShape<'InvalidQuantity', { quantity: number }>;
export type ValidationError = ErrorShape<'Validation', { field: string; reason: string }>;
export type TransactionNotFoundError = ErrorShape<'TransactionNotFound', { transactionId: string }>;
export type TransactionNotPendingError = ErrorShape<
  'TransactionNotPending',
  { transactionId: string; status: string }
>;
export type IdempotencyConflictError = ErrorShape<'IdempotencyConflict', { key: string }>;
export type ConcurrencyConflictError = ErrorShape<'ConcurrencyConflict', { entity: string }>;
export type GatewayUnavailableError = ErrorShape<'GatewayUnavailable', { reason: string }>;
export type InvalidWebhookSignatureError = ErrorShape<'InvalidWebhookSignature', undefined>;
export type PersistenceError = ErrorShape<'Persistence', { operation: string }>;

export type DomainError =
  | ProductNotFoundError
  | InsufficientStockError
  | InvalidQuantityError
  | ValidationError
  | TransactionNotFoundError
  | TransactionNotPendingError
  | IdempotencyConflictError
  | ConcurrencyConflictError
  | GatewayUnavailableError
  | InvalidWebhookSignatureError
  | PersistenceError;

/** Discriminator values, useful for exhaustive switches and test assertions. */
export type DomainErrorKind = DomainError['kind'];

export const productNotFound = (productId: string): ProductNotFoundError => ({
  kind: 'ProductNotFound',
  message: `Product ${productId} does not exist.`,
  details: { productId },
});

export const insufficientStock = (
  productId: string,
  requested: number,
  available: number,
): InsufficientStockError => ({
  kind: 'InsufficientStock',
  message: `Product ${productId} has ${available} units available but ${requested} were requested.`,
  details: { productId, requested, available },
});

export const invalidQuantity = (quantity: number): InvalidQuantityError => ({
  kind: 'InvalidQuantity',
  message: `Quantity must be a positive integer, received ${quantity}.`,
  details: { quantity },
});

export const validation = (field: string, reason: string): ValidationError => ({
  kind: 'Validation',
  message: `${field} ${reason}.`,
  details: { field, reason },
});

export const transactionNotFound = (transactionId: string): TransactionNotFoundError => ({
  kind: 'TransactionNotFound',
  message: `Transaction ${transactionId} does not exist.`,
  details: { transactionId },
});

export const transactionNotPending = (
  transactionId: string,
  status: string,
): TransactionNotPendingError => ({
  kind: 'TransactionNotPending',
  message: `Transaction ${transactionId} is already ${status} and cannot change state.`,
  details: { transactionId, status },
});

export const idempotencyConflict = (key: string): IdempotencyConflictError => ({
  kind: 'IdempotencyConflict',
  message: `Idempotency key ${key} was already used with a different request body.`,
  details: { key },
});

export const concurrencyConflict = (entity: string): ConcurrencyConflictError => ({
  kind: 'ConcurrencyConflict',
  message: `${entity} was modified concurrently; the operation was not applied.`,
  details: { entity },
});

export const gatewayUnavailable = (reason: string): GatewayUnavailableError => ({
  kind: 'GatewayUnavailable',
  message: `The payment gateway could not be reached: ${reason}`,
  details: { reason },
});

export const invalidWebhookSignature = (): InvalidWebhookSignatureError => ({
  kind: 'InvalidWebhookSignature',
  message: 'The webhook checksum does not match the expected value.',
  details: undefined,
});

export const persistence = (operation: string): PersistenceError => ({
  kind: 'Persistence',
  message: `Persistence operation "${operation}" failed.`,
  details: { operation },
});
