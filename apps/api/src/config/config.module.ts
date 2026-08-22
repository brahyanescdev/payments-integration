import { Global, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';

import { APP_CONFIG, loadAppConfig } from './app.config';

/**
 * Composition root for configuration.
 *
 * `@nestjs/config` is used only to load `.env` files into the process; validation
 * and shaping happen in {@link loadAppConfig}. The module is global so that any
 * adapter can inject {@link APP_CONFIG} without re-importing it.
 */
@Global()
@Module({
  imports: [NestConfigModule.forRoot({ isGlobal: true, cache: true })],
  providers: [
    {
      provide: APP_CONFIG,
      useFactory: () => loadAppConfig(process.env),
    },
  ],
  exports: [APP_CONFIG],
})
export class ConfigModule {}
