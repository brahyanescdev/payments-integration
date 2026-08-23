import { randomUUID } from 'node:crypto';

import type { MikroORM } from '@mikro-orm/postgresql';

import { IdempotencyKeyEntity } from './idempotency-key.entity';
import { MikroIdempotencyKeyRepository } from './mikro-idempotency-key.repository';
import { openTestOrm } from '../testing/orm';

describe('MikroIdempotencyKeyRepository', () => {
  let orm: MikroORM;
  let repository: MikroIdempotencyKeyRepository;

  beforeAll(async () => {
    orm = await openTestOrm();
    repository = new MikroIdempotencyKeyRepository(orm);
  });

  afterAll(async () => {
    await orm.close();
  });

  const cleanup = async (key: string) => {
    await orm.em.fork().nativeDelete(IdempotencyKeyEntity, { idempotencyKey: key });
  };

  it('claims a fresh key', async () => {
    const key = randomUUID();

    const outcome = await repository.claim(key, 'POST /checkout', 'hash-a', new Date());

    expect(outcome).toEqual({ kind: 'claimed' });

    await cleanup(key);
  });

  it('replays the stored response for a repeat of the same key and body', async () => {
    const key = randomUUID();
    await repository.claim(key, 'POST /checkout', 'hash-a', new Date());
    await repository.complete(key, 201, { transactionId: 'tx-1' }, 'tx-1');

    const outcome = await repository.claim(key, 'POST /checkout', 'hash-a', new Date());

    expect(outcome).toEqual({ kind: 'replay', status: 201, body: { transactionId: 'tx-1' } });

    await cleanup(key);
  });

  it('reports a conflict when the same key arrives with a different body', async () => {
    const key = randomUUID();
    await repository.claim(key, 'POST /checkout', 'hash-a', new Date());
    await repository.complete(key, 201, { transactionId: 'tx-1' }, 'tx-1');

    const outcome = await repository.claim(key, 'POST /checkout', 'hash-b', new Date());

    expect(outcome).toEqual({ kind: 'conflict' });

    await cleanup(key);
  });

  it('reports in-progress for a key still awaiting its response', async () => {
    const key = randomUUID();
    await repository.claim(key, 'POST /checkout', 'hash-a', new Date());

    const outcome = await repository.claim(key, 'POST /checkout', 'hash-a', new Date());

    expect(outcome).toEqual({ kind: 'in-progress' });

    await cleanup(key);
  });

  it('reclaims a key abandoned well past the in-flight timeout', async () => {
    const key = randomUUID();
    const longAgo = new Date(Date.now() - 60_000);
    await repository.claim(key, 'POST /checkout', 'hash-a', longAgo);

    const outcome = await repository.claim(key, 'POST /checkout', 'hash-a', new Date());

    expect(outcome).toEqual({ kind: 'claimed' });

    await cleanup(key);
  });

  it('releases a claim so a retry can proceed as if it never happened', async () => {
    const key = randomUUID();
    await repository.claim(key, 'POST /checkout', 'hash-a', new Date());

    await repository.release(key);
    const outcome = await repository.claim(key, 'POST /checkout', 'hash-a', new Date());

    expect(outcome).toEqual({ kind: 'claimed' });

    await cleanup(key);
  });

  it('lets exactly one of many concurrent claims for the same key win', async () => {
    const key = randomUUID();
    const now = new Date();

    const attempts = await Promise.all(
      Array.from({ length: 8 }, () => repository.claim(key, 'POST /checkout', 'hash-a', now)),
    );

    const claimed = attempts.filter((outcome) => outcome.kind === 'claimed');
    const others = attempts.filter((outcome) => outcome.kind !== 'claimed');

    expect(claimed).toHaveLength(1);
    // Depending on exact timing, a loser observes either an in-flight claim or —
    // if it read after the winner's `complete()` in another test path — a replay.
    // Both are correct; a second 'claimed' would mean the guarantee failed.
    expect(
      others.every((outcome) => outcome.kind === 'in-progress' || outcome.kind === 'replay'),
    ).toBe(true);

    await cleanup(key);
  });
});
