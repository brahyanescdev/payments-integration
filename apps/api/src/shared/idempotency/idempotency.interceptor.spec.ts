import {
  Body,
  Controller,
  Global,
  type INestApplication,
  Module,
  Post,
  UseInterceptors,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { IDEMPOTENCY_KEY_HEADER } from '@payments/shared';
import request from 'supertest';

import { CLOCK } from '../clock/clock.port';
import { FixedClock } from '../clock/clock.port';
import {
  IDEMPOTENCY_KEY_REPOSITORY,
  type IdempotencyKeyRepository,
} from '../../persistence/idempotency-key.repository';
import { InMemoryIdempotencyKeyRepository } from '../../testing/fakes';
import { IdempotencyInterceptor } from './idempotency.interceptor';

let callCount = 0;

@Controller('widgets')
class WidgetsController {
  @Post()
  @UseInterceptors(IdempotencyInterceptor)
  create(@Body() body: { name: string }) {
    callCount += 1;

    return { widgetId: `widget-${callCount}`, name: body.name, transactionId: `tx-${callCount}` };
  }
}

@Global()
@Module({})
class TestIdempotencyModule {
  static register(clock: FixedClock, repository: IdempotencyKeyRepository) {
    return {
      module: TestIdempotencyModule,
      providers: [
        { provide: CLOCK, useValue: clock },
        { provide: IDEMPOTENCY_KEY_REPOSITORY, useValue: repository },
      ],
      exports: [CLOCK, IDEMPOTENCY_KEY_REPOSITORY],
    };
  }
}

describe('IdempotencyInterceptor', () => {
  let app: INestApplication;
  let clock: FixedClock;
  let repository: InMemoryIdempotencyKeyRepository;

  beforeEach(async () => {
    callCount = 0;
    clock = new FixedClock(new Date('2026-08-23T00:00:00.000Z'));
    repository = new InMemoryIdempotencyKeyRepository();

    const moduleRef = await Test.createTestingModule({
      imports: [TestIdempotencyModule.register(clock, repository)],
      controllers: [WidgetsController],
      providers: [IdempotencyInterceptor],
    }).compile();

    app = moduleRef.createNestApplication();
    // Listening on a real (ephemeral) port, rather than leaving supertest to
    // auto-listen per request, is what makes firing genuinely concurrent
    // requests against this server reliable.
    await app.listen(0);
  });

  afterEach(async () => {
    await app.close();
  });

  it('rejects a request with no idempotency key', async () => {
    await request(app.getHttpServer()).post('/widgets').send({ name: 'gizmo' }).expect(400);

    expect(callCount).toBe(0);
  });

  it('runs the handler once for a fresh key', async () => {
    const response = await request(app.getHttpServer())
      .post('/widgets')
      .set(IDEMPOTENCY_KEY_HEADER, 'key-1')
      .send({ name: 'gizmo' })
      .expect(201);

    expect(response.body).toMatchObject({ name: 'gizmo' });
    expect(callCount).toBe(1);
  });

  it('replays the stored response for a repeat of the same key and body, without rerunning the handler', async () => {
    const first = await request(app.getHttpServer())
      .post('/widgets')
      .set(IDEMPOTENCY_KEY_HEADER, 'key-2')
      .send({ name: 'gizmo' })
      .expect(201);

    const second = await request(app.getHttpServer())
      .post('/widgets')
      .set(IDEMPOTENCY_KEY_HEADER, 'key-2')
      .send({ name: 'gizmo' })
      .expect(201);

    expect(second.body).toEqual(first.body);
    expect(callCount).toBe(1);
  });

  it('rejects the same key reused with a different body', async () => {
    await request(app.getHttpServer())
      .post('/widgets')
      .set(IDEMPOTENCY_KEY_HEADER, 'key-3')
      .send({ name: 'gizmo' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/widgets')
      .set(IDEMPOTENCY_KEY_HEADER, 'key-3')
      .send({ name: 'different' })
      .expect(409);

    expect(callCount).toBe(1);
  });

  it('releases the claim when the handler throws, so a retry can proceed', async () => {
    @Controller('failing')
    class FailingController {
      @Post()
      @UseInterceptors(IdempotencyInterceptor)
      create() {
        throw new Error('boom');
      }
    }

    const moduleRef = await Test.createTestingModule({
      imports: [TestIdempotencyModule.register(clock, repository)],
      controllers: [FailingController],
      providers: [IdempotencyInterceptor],
    }).compile();

    const failingApp = moduleRef.createNestApplication();
    await failingApp.init();

    await request(failingApp.getHttpServer())
      .post('/failing')
      .set(IDEMPOTENCY_KEY_HEADER, 'key-4')
      .send({})
      .expect(500);

    const outcome = await repository.claim('key-4', 'POST /failing', 'irrelevant', clock.now());
    expect(outcome.kind).toBe('claimed');

    await failingApp.close();
  });

  it('rejects with 409 when another request with the same key is still in flight', async () => {
    // A dedicated double rather than real concurrency: two genuinely simultaneous
    // requests can resolve to either "in-progress" or "replay" depending on
    // timing (see the test below), which makes this exact branch unreliable to
    // reach that way. Asserting it deterministically needs a repository that
    // always reports the key as already claimed and still unanswered.
    const inProgressRepository = {
      claim: () => Promise.resolve({ kind: 'in-progress' as const }),
      complete: () => Promise.resolve(),
      release: () => Promise.resolve(),
    };

    const moduleRef = await Test.createTestingModule({
      imports: [TestIdempotencyModule.register(clock, inProgressRepository)],
      controllers: [WidgetsController],
      providers: [IdempotencyInterceptor],
    }).compile();

    const inProgressApp = moduleRef.createNestApplication();
    await inProgressApp.init();

    await request(inProgressApp.getHttpServer())
      .post('/widgets')
      .set(IDEMPOTENCY_KEY_HEADER, 'key-in-flight')
      .send({ name: 'gizmo' })
      .expect(409);

    expect(callCount).toBe(0);

    await inProgressApp.close();
  });

  it('lets exactly one of several concurrent requests with the same key run the handler', async () => {
    // A single agent reuses one keep-alive connection; firing raw parallel
    // requests at a freshly listening test server intermittently trips
    // ECONNRESET, which is a socket-pooling artefact of the harness, not a
    // property of the interceptor. The concurrency guarantee itself is already
    // proven at the database layer, against real PostgreSQL, in
    // mikro-idempotency-key.repository.spec.ts.
    const agent = request.agent(app.getHttpServer());

    const attempts = await Promise.all(
      Array.from({ length: 5 }, () =>
        agent.post('/widgets').set(IDEMPOTENCY_KEY_HEADER, 'key-5').send({ name: 'gizmo' }),
      ),
    );

    // The handler running exactly once is the actual guarantee. A request that
    // loses the race can observe either "still in flight" (409) or "already
    // done" (a 201 replay of the winner's exact body) depending on timing —
    // both are correct; a second *distinct* success would mean it failed.
    expect(callCount).toBe(1);
    expect(attempts.every((response) => response.status === 201 || response.status === 409)).toBe(
      true,
    );

    const successes = attempts.filter((response) => response.status === 201);
    for (const success of successes) {
      expect(success.body).toEqual(successes[0]?.body);
    }
  });
});
