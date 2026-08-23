import type { ResultAsync } from 'neverthrow';

import type { DomainError } from '../shared/result/domain-error';

/** Outbound port for the webhook processing ledger. */
export interface WebhookEventRepository {
  /** True when an event with this checksum was already recorded — the gateway retries deliveries. */
  existsByChecksum(checksum: string): ResultAsync<boolean, DomainError>;

  /** Records a processed event. Shares the caller's unit-of-work transaction, unlike the idempotency-key ledger. */
  record(event: {
    id: string;
    checksum: string;
    eventType: string;
    payload: unknown;
  }): ResultAsync<void, DomainError>;
}
