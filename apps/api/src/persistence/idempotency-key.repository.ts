/**
 * Outcome of attempting to claim an idempotency key.
 *
 * `claimed` means this call owns the key and must run the real work. The other
 * three tell the interceptor what to answer instead, without running anything:
 * `replay` returns the exact response the first successful call produced,
 * `conflict` means the same key arrived with a different request body, and
 * `in-progress` means another call with the same key is still being processed.
 */
export type ClaimOutcome =
  | { readonly kind: 'claimed' }
  | { readonly kind: 'replay'; readonly status: number; readonly body: unknown }
  | { readonly kind: 'conflict' }
  | { readonly kind: 'in-progress' };

/**
 * Outbound port for the idempotency ledger.
 *
 * Deliberately not folded into {@link UnitOfWork}'s repository registry: a claim
 * must be visible to concurrent requests the instant it commits, which requires
 * its own short-lived transaction rather than sharing the business write's — the
 * whole mechanism depends on the claim landing in the database *before* the
 * business logic even starts, not alongside it.
 */
export interface IdempotencyKeyRepository {
  /**
   * Attempts to claim `key` for `endpoint`, or reports why it could not.
   *
   * @param now - Injected clock reading, used to size the claim's TTL and to
   *   detect an abandoned in-flight claim worth reclaiming.
   */
  claim(key: string, endpoint: string, requestHash: string, now: Date): Promise<ClaimOutcome>;

  /** Records the successful response, ending the claim's in-flight window. */
  complete(key: string, status: number, body: unknown, transactionId: string | null): Promise<void>;

  /** Releases a claim after the protected work failed, so a retry can proceed. */
  release(key: string): Promise<void>;
}

/** Injection token for {@link IdempotencyKeyRepository}. */
export const IDEMPOTENCY_KEY_REPOSITORY = Symbol('IDEMPOTENCY_KEY_REPOSITORY');
