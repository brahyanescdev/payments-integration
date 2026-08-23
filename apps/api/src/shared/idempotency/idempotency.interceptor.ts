import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import { IDEMPOTENCY_KEY_HEADER } from '@payments/shared';
import type { Request } from 'express';
import { catchError, map, Observable } from 'rxjs';

import { CLOCK, type Clock } from '../clock/clock.port';
import { hashRequestBody } from './request-hash';
import {
  IDEMPOTENCY_KEY_REPOSITORY,
  type IdempotencyKeyRepository,
} from '../../persistence/idempotency-key.repository';

/**
 * Enforces idempotent retries on the mutating endpoint it guards.
 *
 * The header is mandatory — a POST that changes money or inventory with no
 * `Idempotency-Key` has no way to tell a deliberate retry from an accidental
 * double submission, so it is rejected outright rather than processed unsafely.
 *
 * The claim happens in its own short transaction, committed *before* the guarded
 * handler runs at all; see `IdempotencyKeyRepository` for why that ordering, not
 * this interceptor, is what actually makes concurrent duplicates safe.
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(
    @Inject(IDEMPOTENCY_KEY_REPOSITORY) private readonly repository: IdempotencyKeyRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const request = context.switchToHttp().getRequest<Request>();
    const key = request.header(IDEMPOTENCY_KEY_HEADER);

    if (key === undefined || key.trim().length === 0) {
      throw new BadRequestException(`The "${IDEMPOTENCY_KEY_HEADER}" header is required.`);
    }

    const endpoint = `${request.method} ${request.route?.path ?? request.path}`;
    const requestHash = hashRequestBody(request.body);
    const outcome = await this.repository.claim(key, endpoint, requestHash, this.clock.now());

    switch (outcome.kind) {
      case 'replay':
        return new Observable((subscriber) => {
          subscriber.next(outcome.body);
          subscriber.complete();
        });
      case 'conflict':
        throw new ConflictException(
          `Idempotency key "${key}" was already used with a different request body.`,
        );
      case 'in-progress':
        throw new ConflictException(
          `A request with idempotency key "${key}" is already in progress.`,
        );
      case 'claimed':
        return next.handle().pipe(
          map((body: unknown) => {
            const status = context.switchToHttp().getResponse().statusCode as number;
            void this.repository.complete(key, status, body, extractTransactionId(body));

            return body;
          }),
          catchError((error: unknown) => {
            void this.repository.release(key);
            throw error;
          }),
        );
    }
  }
}

/** Pulls a transaction id out of a response body shaped like one, for auditing. */
function extractTransactionId(body: unknown): string | null {
  if (body !== null && typeof body === 'object' && 'transactionId' in body) {
    const value = (body as { transactionId: unknown }).transactionId;

    return typeof value === 'string' ? value : null;
  }

  return null;
}
