import { MikroORM } from '@mikro-orm/postgresql';

import { buildMikroOrmConfig } from '../persistence/mikro-orm.config';
import { loadOrmSettings } from '../persistence/orm-settings';

/**
 * Opens an ORM instance against the integration-test database.
 *
 * Reads `DATABASE_URL` when present — CI provides one through a Postgres service
 * container — and otherwise falls back to the local `docker compose` stack, so
 * `pnpm db:up && pnpm test` works with no further setup.
 *
 * The schema is prepared once by `jest.global-setup.ts`, so this only opens a
 * connection — migrating here would race between parallel Jest workers.
 */
export async function openTestOrm() {
  const settings = loadOrmSettings({
    ...process.env,
    DATABASE_URL:
      process.env.DATABASE_URL ?? 'postgresql://payments:payments@localhost:5432/payments',
    NODE_ENV: 'test',
  });

  // NODE_ENV is pinned to `test`, so the builder keeps query logging off.
  return MikroORM.init(buildMikroOrmConfig(settings));
}
