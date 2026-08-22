import { HttpException, HttpStatus } from '@nestjs/common';
import type { ApiErrorDto } from '@payments/shared';
import type { Result } from 'neverthrow';

import type { DomainError, DomainErrorKind } from '../result/domain-error';

/**
 * The one place where a domain failure becomes an HTTP status.
 *
 * The map is exhaustive by type: adding a variant to `DomainError` without deciding
 * its status is a compile error, not a silent `500` discovered in production.
 */
const STATUS_BY_KIND: Record<DomainErrorKind, HttpStatus> = {
  ProductNotFound: HttpStatus.NOT_FOUND,
  TransactionNotFound: HttpStatus.NOT_FOUND,

  Validation: HttpStatus.BAD_REQUEST,
  InvalidQuantity: HttpStatus.BAD_REQUEST,

  // 409 rather than 400: the request is well formed, it conflicts with current state.
  InsufficientStock: HttpStatus.CONFLICT,
  TransactionNotPending: HttpStatus.CONFLICT,
  IdempotencyConflict: HttpStatus.CONFLICT,
  ConcurrencyConflict: HttpStatus.CONFLICT,

  // The gateway failed us, not the caller — 502 tells the client a retry may work.
  GatewayUnavailable: HttpStatus.BAD_GATEWAY,

  InvalidWebhookSignature: HttpStatus.UNAUTHORIZED,
  Persistence: HttpStatus.INTERNAL_SERVER_ERROR,
};

/**
 * Failures we do not describe to the caller.
 *
 * An internal fault leaks implementation detail and gives an attacker a probe, so
 * the operator-facing message stays in the logs and the client gets a flat reply.
 */
const OPAQUE_KINDS: ReadonlySet<DomainErrorKind> = new Set<DomainErrorKind>([
  'Persistence',
  'InvalidWebhookSignature',
]);

export const httpStatusFor = (error: DomainError): HttpStatus => STATUS_BY_KIND[error.kind];

/** Wraps a domain failure in the uniform error envelope. */
export function toHttpException(error: DomainError): HttpException {
  const status = httpStatusFor(error);
  const opaque = OPAQUE_KINDS.has(error.kind);

  const body: ApiErrorDto = {
    error: {
      kind: error.kind,
      message: opaque ? 'La solicitud no pudo completarse.' : error.message,
      ...(opaque || error.details === undefined ? {} : { details: error.details }),
    },
  };

  return new HttpException(body, status);
}

/**
 * Boundary between Railway Oriented Programming and Nest.
 *
 * Use cases return failures as values all the way to here; the controller converts
 * once, at the edge, by throwing what Nest already knows how to render. Nothing
 * inside the application layer ever throws for control flow.
 *
 * @throws HttpException when the result is `Err`.
 */
export function unwrapOrThrow<T>(result: Result<T, DomainError>): T {
  if (result.isErr()) {
    throw toHttpException(result.error);
  }

  return result.value;
}
