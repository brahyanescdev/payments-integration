import { okAsync } from 'neverthrow';

import { FakeUnitOfWork, InMemoryProductRepository } from '../../../testing/fakes';
import { FixedClock } from '../../../shared/clock/clock.port';
import { SequentialIdGenerator } from '../../../shared/id/id-generator.port';
import { makeProduct, makeTransaction } from '../../../testing/builders';
import type { RepositoryRegistry } from '../../../shared/unit-of-work/unit-of-work.port';
import { computeWebhookChecksum } from '../../payments/domain/webhook-checksum';
import { readWebhookProperty } from '../../payments/domain/read-webhook-property';
import type { Transaction } from '../domain/transaction';
import {
  ProcessPaymentWebhookUseCase,
  type WebhookPayload,
} from './process-payment-webhook.use-case';
import { SettleTransactionUseCase } from './settle-transaction.use-case';

const PRODUCT_ID = '11111111-1111-4111-8111-111111111111';
const REFERENCE = 'TX-22222222-2222-4222-8222-222222222222';
const NOW = new Date('2026-08-23T00:00:00.000Z');
const EVENTS_SECRET = 'test-events-secret';
const PROPERTIES = ['transaction.id', 'transaction.status', 'transaction.amount_in_cents'];

function makePayload(
  overrides: {
    status?: string;
    reference?: string | null;
    checksum?: string;
    omitSignedAmount?: boolean;
  } = {},
): WebhookPayload {
  const status = overrides.status ?? 'APPROVED';
  const reference = overrides.reference === undefined ? REFERENCE : overrides.reference;
  const timestamp = 1_700_000_000;
  const data: Record<string, unknown> = {
    transaction: {
      id: 'gw-tx-1',
      status,
      ...(overrides.omitSignedAmount === true ? {} : { amount_in_cents: 10_000_000 }),
      ...(reference === null ? {} : { reference }),
      status_message: status === 'APPROVED' ? null : 'INSUFFICIENT_FUNDS',
    },
  };
  const propertyValues = PROPERTIES.map((path) => readWebhookProperty(data, path) ?? '');
  const checksum =
    overrides.checksum ?? computeWebhookChecksum(propertyValues, timestamp, EVENTS_SECRET);

  return {
    event: 'transaction.updated',
    data,
    signature: { properties: PROPERTIES, checksum },
    timestamp,
  };
}

function makeRepositories(transaction: Transaction | null) {
  const products = new InMemoryProductRepository().seed([
    makeProduct({ id: PRODUCT_ID, stock: 3 }),
  ]);
  const savedTransactions: Transaction[] = [];
  const recordedEvents: unknown[] = [];
  const checksumsSeen = new Set<string>();

  return {
    repositories: {
      products,
      transactions: {
        findByReference: (reference: string) =>
          okAsync(transaction !== null && reference === transaction.reference ? transaction : null),
        save: (tx: Transaction) => {
          savedTransactions.push(tx);
          return okAsync(undefined);
        },
      },
      stockMovements: { append: () => okAsync(undefined) },
      webhookEvents: {
        existsByChecksum: (checksum: string) => okAsync(checksumsSeen.has(checksum)),
        record: (event: { checksum: string }) => {
          checksumsSeen.add(event.checksum);
          recordedEvents.push(event);
          return okAsync(undefined);
        },
      },
    } as unknown as RepositoryRegistry,
    products,
    savedTransactions,
    recordedEvents,
  };
}

function makeUseCase(repositories: RepositoryRegistry) {
  return new ProcessPaymentWebhookUseCase(
    new FakeUnitOfWork(repositories),
    new SettleTransactionUseCase(new FixedClock(NOW), new SequentialIdGenerator('mv')),
    new SequentialIdGenerator('evt'),
    EVENTS_SECRET,
  );
}

describe('ProcessPaymentWebhookUseCase', () => {
  it('settles a pending transaction and releases stock for a declined charge', async () => {
    const transaction = makeTransaction({
      reference: REFERENCE,
      productId: PRODUCT_ID,
      quantity: 2,
    });
    const { repositories, products, recordedEvents } = makeRepositories(transaction);

    const result = await makeUseCase(repositories).execute(makePayload({ status: 'DECLINED' }));

    expect(result._unsafeUnwrap()).toBe('settled');
    expect(transaction.status).toBe('DECLINED');
    expect(transaction.failureReason).toBe('INSUFFICIENT_FUNDS');
    const reloaded = (await products.findById(PRODUCT_ID))._unsafeUnwrap();
    expect(reloaded?.stock).toBe(5);
    expect(recordedEvents).toHaveLength(1);
  });

  it('settles APPROVED, committing the reserved stock without touching it further', async () => {
    const transaction = makeTransaction({
      reference: REFERENCE,
      productId: PRODUCT_ID,
      quantity: 2,
    });
    const { repositories, products } = makeRepositories(transaction);

    const result = await makeUseCase(repositories).execute(makePayload({ status: 'APPROVED' }));

    expect(result._unsafeUnwrap()).toBe('settled');
    const reloaded = (await products.findById(PRODUCT_ID))._unsafeUnwrap();
    expect(reloaded?.stock).toBe(3);
  });

  it('rejects a payload whose checksum does not match', async () => {
    const transaction = makeTransaction({ reference: REFERENCE, productId: PRODUCT_ID });
    const { repositories } = makeRepositories(transaction);

    const result = await makeUseCase(repositories).execute(
      makePayload({ checksum: 'deliberately-wrong-checksum' }),
    );

    expect(result._unsafeUnwrapErr().kind).toBe('InvalidWebhookSignature');
    expect(transaction.status).toBe('PENDING');
  });

  it('treats a signed property absent from the payload as an empty string, same on both sides of the checksum', async () => {
    const transaction = makeTransaction({ reference: REFERENCE, productId: PRODUCT_ID });
    const { repositories } = makeRepositories(transaction);

    const result = await makeUseCase(repositories).execute(makePayload({ omitSignedAmount: true }));

    expect(result._unsafeUnwrap()).toBe('settled');
  });

  it('fails with TransactionNotFound when the reference names no transaction', async () => {
    const { repositories } = makeRepositories(null);

    const result = await makeUseCase(repositories).execute(makePayload());

    expect(result._unsafeUnwrapErr().kind).toBe('TransactionNotFound');
  });

  it('ignores a retried delivery of the same event instead of settling twice', async () => {
    const transaction = makeTransaction({
      reference: REFERENCE,
      productId: PRODUCT_ID,
      quantity: 1,
    });
    const { repositories, recordedEvents } = makeRepositories(transaction);
    const payload = makePayload({ status: 'APPROVED' });

    const first = await makeUseCase(repositories).execute(payload);
    const second = await makeUseCase(repositories).execute(payload);

    expect(first._unsafeUnwrap()).toBe('settled');
    expect(second._unsafeUnwrap()).toBe('ignored');
    expect(recordedEvents).toHaveLength(1);
  });

  it('acknowledges a late event for an already-settled transaction without reapplying it', async () => {
    const transaction = makeTransaction({
      reference: REFERENCE,
      productId: PRODUCT_ID,
      quantity: 1,
    });
    transaction.settle('APPROVED', NOW);
    const { repositories } = makeRepositories(transaction);

    const result = await makeUseCase(repositories).execute(makePayload({ status: 'DECLINED' }));

    expect(result._unsafeUnwrap()).toBe('ignored');
    // Still APPROVED: a late DECLINED event must never flip an already-settled charge.
    expect(transaction.status).toBe('APPROVED');
  });

  it('rejects a payload with no recognisable transaction reference', async () => {
    const transaction = makeTransaction({ reference: REFERENCE, productId: PRODUCT_ID });
    const { repositories } = makeRepositories(transaction);

    const result = await makeUseCase(repositories).execute(makePayload({ reference: null }));

    expect(result._unsafeUnwrapErr().kind).toBe('Validation');
  });
});
