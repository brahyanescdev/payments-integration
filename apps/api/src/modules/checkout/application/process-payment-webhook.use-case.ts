import { err, errAsync, ok, okAsync, type Result, type ResultAsync } from 'neverthrow';

import type { IdGenerator } from '../../../shared/id/id-generator.port';
import {
  invalidWebhookSignature,
  transactionNotFound,
  validation,
  type DomainError,
} from '../../../shared/result/domain-error';
import type {
  RepositoryRegistry,
  UnitOfWork,
} from '../../../shared/unit-of-work/unit-of-work.port';
import { computeWebhookChecksum } from '../../payments/domain/webhook-checksum';
import { readWebhookProperty } from '../../payments/domain/read-webhook-property';
import { TRANSACTION_STATUSES, type TransactionStatus } from '../domain/transaction';
import type { SettleTransactionUseCase } from './settle-transaction.use-case';

/** Injection token for {@link ProcessPaymentWebhookUseCase}. */
export const PROCESS_PAYMENT_WEBHOOK_USE_CASE = Symbol('PROCESS_PAYMENT_WEBHOOK_USE_CASE');

export interface WebhookPayload {
  readonly event: string;
  readonly data: Record<string, unknown>;
  readonly signature: { readonly properties: string[]; readonly checksum: string };
  readonly timestamp: number;
}

/**
 * What happened, for the controller to log — every branch still answers `200`,
 * since none of them is the caller's fault: the gateway must never see a retry
 * become worthwhile.
 */
export type WebhookOutcome = 'settled' | 'ignored';

/** Every status the gateway can report except `PENDING`, which `Transaction.settle` does not accept. */
const TERMINAL_STATUSES: ReadonlySet<string> = new Set(
  TRANSACTION_STATUSES.filter((status) => status !== 'PENDING'),
);

/**
 * Resolves a transaction from the gateway's own async notification.
 *
 * The counterpart to the synchronous branch in `PayCheckoutUseCase`: a charge
 * that came back `PENDING` from the charge call is settled here instead, later,
 * by whichever arrives first — this webhook or a status poll. Both drive the
 * exact same {@link SettleTransactionUseCase}, so stock and the transaction's own
 * state machine stay correct regardless of which path resolves it.
 */
export class ProcessPaymentWebhookUseCase {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly settleTransaction: SettleTransactionUseCase,
    private readonly ids: IdGenerator,
    private readonly eventsSecret: string,
  ) {}

  execute(payload: WebhookPayload): ResultAsync<WebhookOutcome, DomainError> {
    return this.verifySignature(payload).asyncAndThen(() => this.process(payload));
  }

  /** Pure and synchronous: no reason to open a transaction for a payload that fails here. */
  private verifySignature(payload: WebhookPayload): Result<void, DomainError> {
    const propertyValues = payload.signature.properties.map(
      (path) => readWebhookProperty(payload.data, path) ?? '',
    );
    const expected = computeWebhookChecksum(propertyValues, payload.timestamp, this.eventsSecret);

    return expected === payload.signature.checksum ? ok(undefined) : err(invalidWebhookSignature());
  }

  private process(payload: WebhookPayload): ResultAsync<WebhookOutcome, DomainError> {
    return this.unitOfWork.run((repositories) =>
      repositories.webhookEvents
        .existsByChecksum(payload.signature.checksum)
        .andThen((exists) =>
          exists
            ? okAsync<WebhookOutcome>('ignored')
            : this.settleFromPayload(repositories, payload),
        ),
    );
  }

  private settleFromPayload(
    repositories: RepositoryRegistry,
    payload: WebhookPayload,
  ): ResultAsync<WebhookOutcome, DomainError> {
    const reference = readWebhookProperty(payload.data, 'transaction.reference');
    const rawStatus = readWebhookProperty(payload.data, 'transaction.status');

    if (reference === undefined || rawStatus === undefined || !TERMINAL_STATUSES.has(rawStatus)) {
      return errAsync(
        validation('transaction.status', 'must name a known transaction and a terminal status'),
      );
    }

    const status = rawStatus as Exclude<TransactionStatus, 'PENDING'>;
    const failureReason = readWebhookProperty(payload.data, 'transaction.status_message') ?? null;

    return repositories.transactions.findByReference(reference).andThen((transaction) => {
      if (transaction === null) {
        return errAsync(transactionNotFound(reference));
      }

      if (!transaction.isPending) {
        return this.recordEvent(repositories, payload).map(() => 'ignored' as const);
      }

      return this.settleTransaction
        .settle(repositories, transaction, { status, failureReason })
        .andThen(() => this.recordEvent(repositories, payload))
        .map(() => 'settled' as const);
    });
  }

  private recordEvent(
    repositories: RepositoryRegistry,
    payload: WebhookPayload,
  ): ResultAsync<void, DomainError> {
    return repositories.webhookEvents.record({
      id: this.ids.generate(),
      checksum: payload.signature.checksum,
      eventType: payload.event,
      payload,
    });
  }
}
