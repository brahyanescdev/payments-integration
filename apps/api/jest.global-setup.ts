import { MikroORM } from '@mikro-orm/postgresql';

import { buildMikroOrmConfig } from './src/persistence/mikro-orm.config';
import { loadOrmSettings } from './src/persistence/orm-settings';

/**
 * Prepares the integration-test schema exactly once, before any worker starts.
 *
 * Migrating from inside each spec file races: Jest runs suites in parallel workers,
 * and two of them creating `mikro_orm_migrations` at the same moment means one gets
 * "relation already exists". Schema preparation is a property of the whole run, so
 * it belongs here rather than in a `beforeAll`.
 */
export default async function globalSetup(): Promise<void> {
  const settings = loadOrmSettings({
    ...process.env,
    DATABASE_URL:
      process.env.DATABASE_URL ?? 'postgresql://payments:payments@localhost:5432/payments',
    NODE_ENV: 'test',
  });

  let orm: MikroORM | undefined;

  try {
    orm = await MikroORM.init(buildMikroOrmConfig(settings));
    await orm.getMigrator().up();
  } catch (cause) {
    throw new Error(
      'Could not prepare the test database. Start it with `pnpm db:up`, or set DATABASE_URL.',
      { cause },
    );
  } finally {
    await orm?.close();
  }
}
