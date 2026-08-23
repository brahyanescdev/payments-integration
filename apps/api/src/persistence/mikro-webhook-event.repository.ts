import type { EntityManager } from '@mikro-orm/postgresql';
import { okAsync, ResultAsync } from 'neverthrow';

import { type DomainError, persistence } from '../shared/result/domain-error';
import { WebhookEventEntity } from './webhook-event.entity';
import type { WebhookEventRepository } from './webhook-event.repository';

/** Turns a thrown driver error into a `Persistence` value, keeping the rails intact. */
const query = <T>(operation: string, run: () => Promise<T>): ResultAsync<T, DomainError> =>
  ResultAsync.fromPromise(run(), () => persistence(operation));

/**
 * MikroORM implementation of {@link WebhookEventRepository}.
 *
 * Bound to the same `EntityManager` as the rest of a unit of work, unlike the
 * idempotency-key ledger: a webhook's checksum only needs to be visible once the
 * settlement it guards has actually landed, so recording it alongside that write
 * — one flush, one commit — is exactly right here.
 */
export class MikroWebhookEventRepository implements WebhookEventRepository {
  constructor(private readonly em: EntityManager) {}

  existsByChecksum(checksum: string): ResultAsync<boolean, DomainError> {
    return query('webhookEvents.existsByChecksum', () =>
      this.em.count(WebhookEventEntity, { checksum }),
    ).map((count) => count > 0);
  }

  record(event: {
    id: string;
    checksum: string;
    eventType: string;
    payload: unknown;
  }): ResultAsync<void, DomainError> {
    const row = new WebhookEventEntity();
    row.id = event.id;
    row.checksum = event.checksum;
    row.eventType = event.eventType;
    row.payload = event.payload;

    this.em.persist(row);

    return okAsync(undefined);
  }
}
