import { randomUUID } from 'node:crypto';

import type { MikroORM } from '@mikro-orm/postgresql';
import { errAsync, okAsync, ResultAsync } from 'neverthrow';

import { type Product } from '../modules/catalog/domain/product';
import { ProductEntity } from '../modules/catalog/infrastructure/persistence/product.entity';
import { insufficientStock } from '../shared/result/domain-error';
import { openTestOrm } from '../testing/orm';
import { MikroUnitOfWork } from './mikro-unit-of-work';

/**
 * Integration coverage for the transactional boundary.
 *
 * Runs against a real PostgreSQL instance because the behaviour under test is the
 * database's: an in-memory double would happily "roll back" without proving that a
 * commit was actually withheld.
 */
describe('MikroUnitOfWork', () => {
  let orm: MikroORM;
  let unitOfWork: MikroUnitOfWork;
  let productId: string;

  const readStock = async (): Promise<number> => {
    const row = await orm.em.fork().findOneOrFail(ProductEntity, { id: productId });

    return row.stock;
  };

  beforeAll(async () => {
    orm = await openTestOrm();
    unitOfWork = new MikroUnitOfWork(orm);
  });

  afterAll(async () => {
    await orm.close();
  });

  beforeEach(async () => {
    productId = randomUUID();

    const em = orm.em.fork();
    const row = new ProductEntity();
    row.id = productId;
    row.sku = `TEST-${productId.slice(0, 8)}`;
    row.name = 'Producto de prueba';
    row.description = 'Creado por la suite de integración.';
    row.priceInCents = 1_000_000;
    row.currency = 'COP';
    row.imageUrl = '/images/test.svg';
    row.stock = 5;
    await em.persistAndFlush(row);
  });

  afterEach(async () => {
    await orm.em.fork().nativeDelete(ProductEntity, { id: productId });
  });

  it('commits everything staged when the work succeeds', async () => {
    const result = await unitOfWork.run((repositories) =>
      repositories.products
        .findById(productId)
        .andThen((product) => okAsync(product as Product))
        .andThen((product) =>
          product
            .reserve(2)
            .asyncAndThen(() => repositories.products.save(product))
            .map(() => product.stock),
        ),
    );

    expect(result._unsafeUnwrap()).toBe(3);
    await expect(readStock()).resolves.toBe(3);
  });

  it('rolls back when the work returns Err, not only when it throws', async () => {
    const result = await unitOfWork.run((repositories) =>
      repositories.products
        .findById(productId)
        .andThen((product) => okAsync(product as Product))
        .andThen((product) =>
          product
            .reserve(2)
            .asyncAndThen(() => repositories.products.save(product))
            // A business failure discovered *after* stock was staged. Railway
            // Oriented Programming returns it rather than throwing, so a unit that
            // only reacted to exceptions would commit the reservation anyway.
            .andThen(() => errAsync(insufficientStock(productId, 99, 3))),
        ),
    );

    expect(result._unsafeUnwrapErr().kind).toBe('InsufficientStock');
    await expect(readStock()).resolves.toBe(5);
  });

  it('rolls back and reports a persistence failure when the work throws', async () => {
    const result = await unitOfWork.run((repositories) =>
      repositories.products
        .findById(productId)
        .andThen((product) => okAsync(product as Product))
        .andThen((product) => {
          product.reserve(1);

          return repositories.products.save(product).map(() => {
            throw new Error('driver exploded');
          });
        }),
    );

    expect(result._unsafeUnwrapErr().kind).toBe('Persistence');
    await expect(readStock()).resolves.toBe(5);
  });

  it('passes the work result through untouched on success', async () => {
    const result = await unitOfWork.run(() => okAsync({ answer: 42 }));

    expect(result._unsafeUnwrap()).toEqual({ answer: 42 });
  });

  describe('two buyers racing for the last unit', () => {
    /**
     * Releases both units only once each has read the product, so both hold the
     * same version. Without the barrier the second unit would usually read after
     * the first committed and simply find no stock — a valid outcome, but not the
     * one that exercises the optimistic lock.
     */
    const barrier = (participants: number) => {
      let arrived = 0;
      let release: () => void;
      const opened = new Promise<void>((resolve) => {
        release = resolve;
      });

      return async () => {
        arrived += 1;
        if (arrived === participants) release();
        await opened;
      };
    };

    beforeEach(async () => {
      await orm.em.fork().nativeUpdate(ProductEntity, { id: productId }, { stock: 1 });
    });

    it('lets exactly one succeed and never oversells', async () => {
      const bothHaveRead = barrier(2);

      const buyOneUnit = () =>
        unitOfWork.run((repositories) =>
          repositories.products
            .findById(productId)
            .andThen((product) => okAsync(product as Product))
            .andThen((product) =>
              ResultAsync.fromSafePromise(bothHaveRead()).andThen(() =>
                product.reserve(1).asyncAndThen(() => repositories.products.save(product)),
              ),
            ),
        );

      const [first, second] = await Promise.all([buyOneUnit(), buyOneUnit()]);

      const succeeded = [first, second].filter((result) => result.isOk());
      const failed = [first, second].filter((result) => result.isErr());

      expect(succeeded).toHaveLength(1);
      expect(failed).toHaveLength(1);
      // Either the loser lost the optimistic lock, or it read after the winner
      // committed and found the shelf empty. Both are correct; overselling is not.
      expect(['ConcurrencyConflict', 'InsufficientStock']).toContain(
        failed[0]?._unsafeUnwrapErr().kind,
      );
      await expect(readStock()).resolves.toBe(0);
    });
  });
});
