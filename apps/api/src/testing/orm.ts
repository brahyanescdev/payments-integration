import { MikroORM } from '@mikro-orm/postgresql';

import { loadAppConfig } from '../config/app.config';
import { buildMikroOrmConfig } from '../persistence/mikro-orm.config';
import { makeEnv } from '../config/env.fixture';

/**
 * Opens an ORM instance against the integration-test database.
 *
 * Reads `DATABASE_URL` when present — CI provides one through a Postgres service
 * container — and otherwise falls back to the local `docker compose` stack, so
 * `pnpm db:up && pnpm test` works with no further setup.
 *
 * Migrations are applied on connect, which keeps the suite self-sufficient: a fresh
 * container needs no manual preparation step, and a schema change that was never
 * captured in a migration fails the tests instead of passing silently.
 */
export async function openTestOrm() {
  const config = loadAppConfig(
    makeEnv({
      DATABASE_URL:
        process.env.DATABASE_URL ?? 'postgresql://payments:payments@localhost:5432/payments',
    }),
  );

  // NODE_ENV is `test` in the fixture, so the builder already turns query logging off.
  const orm = await MikroORM.init(buildMikroOrmConfig(config));
  await orm.getMigrator().up();

  return orm;
}
