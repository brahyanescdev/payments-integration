import { MikroOrmModule } from '@mikro-orm/nestjs';
import { MikroORM, PostgreSqlDriver } from '@mikro-orm/postgresql';
import { Global, Module } from '@nestjs/common';

import { APP_CONFIG, type AppConfig } from '../config/app.config';
import { UNIT_OF_WORK } from '../shared/unit-of-work/unit-of-work.port';
import { buildMikroOrmConfig } from './mikro-orm.config';
import { MikroUnitOfWork } from './mikro-unit-of-work';

/**
 * Persistence composition root.
 *
 * Global because every slice reaches for the same transactional boundary, and the
 * alternative — importing it into each module — would be ceremony without
 * isolation. Only the {@link UNIT_OF_WORK} token is exported: use cases receive
 * repositories from the unit that owns their session, never by injecting a
 * repository directly, which is what stops two repositories in one operation from
 * ending up in different transactions.
 */
@Global()
@Module({
  imports: [
    MikroOrmModule.forRootAsync({
      // The driver is declared here, not only inside the factory: Nest registers the
      // driver-specific ORM class at module definition time, before any factory has
      // run, so without it the container cannot resolve `PostgreSqlMikroORM`.
      driver: PostgreSqlDriver,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => buildMikroOrmConfig(config),
    }),
  ],
  providers: [
    {
      provide: UNIT_OF_WORK,
      useFactory: (orm: MikroORM) => new MikroUnitOfWork(orm),
      inject: [MikroORM],
    },
  ],
  exports: [UNIT_OF_WORK],
})
export class PersistenceModule {}
