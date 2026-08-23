import { UniqueConstraintViolationException } from '@mikro-orm/core';
import type { MikroORM } from '@mikro-orm/postgresql';

import { IdempotencyKeyEntity } from './idempotency-key.entity';
import type { ClaimOutcome, IdempotencyKeyRepository } from './idempotency-key.repository';

/**
 * How long an in-flight claim with no response yet is trusted before a new
 * request is allowed to reclaim the key.
 *
 * Not configuration: no deployment would ever legitimately want the checkout
 * endpoint to take longer than this to answer, so there is no environment where a
 * different value would be correct. A crashed process is the only realistic way a
 * claim is left dangling, and this bounds how long its retry has to wait.
 */
const IN_FLIGHT_CLAIM_TIMEOUT_MS = 30_000;

/**
 * MikroORM implementation of {@link IdempotencyKeyRepository}.
 *
 * The concurrency guarantee is the database's, not this class's: `claim` always
 * attempts an insert, and relies on the `key` column's primary-key constraint to
 * make exactly one concurrent caller succeed. Everyone else reads back whatever
 * that winner wrote — the same pattern a `SELECT ... FOR UPDATE` would give, at
 * the cost of one failed insert instead of a lock wait.
 */
export class MikroIdempotencyKeyRepository implements IdempotencyKeyRepository {
  constructor(private readonly orm: MikroORM) {}

  async claim(
    key: string,
    endpoint: string,
    requestHash: string,
    now: Date,
    allowReclaim = true,
  ): Promise<ClaimOutcome> {
    const em = this.orm.em.fork();
    const row = new IdempotencyKeyEntity();
    row.idempotencyKey = key;
    row.endpoint = endpoint;
    row.requestHash = requestHash;
    row.responseStatus = null;
    row.responseBody = null;
    row.transactionId = null;
    // Set explicitly rather than left to the entity's onCreate hook: the reclaim
    // check below compares against this value using the injected clock, and a
    // hook reading the real wall clock would silently ignore a test's fake `now`.
    row.createdAt = now;
    row.expiresAt = now;

    try {
      em.persist(row);
      await em.flush();

      return { kind: 'claimed' };
    } catch (error) {
      if (!(error instanceof UniqueConstraintViolationException)) {
        throw error;
      }

      return this.resolveExistingClaim(key, requestHash, now, allowReclaim);
    }
  }

  async complete(
    key: string,
    status: number,
    body: unknown,
    transactionId: string | null,
  ): Promise<void> {
    const em = this.orm.em.fork();
    await em.nativeUpdate(
      IdempotencyKeyEntity,
      { idempotencyKey: key },
      { responseStatus: status, responseBody: body, transactionId },
    );
  }

  async release(key: string): Promise<void> {
    const em = this.orm.em.fork();
    await em.nativeDelete(IdempotencyKeyEntity, { idempotencyKey: key });
  }

  /** Decides what an insert conflict on `key` means for this caller. */
  private async resolveExistingClaim(
    key: string,
    requestHash: string,
    now: Date,
    allowReclaim: boolean,
  ): Promise<ClaimOutcome> {
    const em = this.orm.em.fork();
    const existing = await em.findOneOrFail(IdempotencyKeyEntity, { idempotencyKey: key });

    if (existing.requestHash !== requestHash) {
      return { kind: 'conflict' };
    }

    if (existing.responseStatus !== null) {
      return { kind: 'replay', status: existing.responseStatus, body: existing.responseBody };
    }

    const ageMs = now.getTime() - existing.createdAt.getTime();

    if (allowReclaim && ageMs > IN_FLIGHT_CLAIM_TIMEOUT_MS) {
      await em.nativeDelete(IdempotencyKeyEntity, { idempotencyKey: key });

      // One reclaim attempt only: if this also loses the race, something else is
      // actively re-claiming the same key right now, which is exactly what
      // 'in-progress' already communicates correctly.
      return this.claim(key, existing.endpoint, requestHash, now, false);
    }

    return { kind: 'in-progress' };
  }
}
