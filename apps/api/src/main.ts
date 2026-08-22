import 'reflect-metadata';

import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';

import { APP_CONFIG, type AppConfig } from './config/app.config';
import { AppModule } from './app.module';

/**
 * Process entry point.
 *
 * Configuration is resolved through the DI container, so an invalid environment
 * aborts the boot here — before the server ever accepts a request.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get<AppConfig>(APP_CONFIG);

  app.use(helmet());
  app.enableCors({
    origin: [...config.corsAllowedOrigins],
    credentials: false,
  });
  app.setGlobalPrefix(config.globalPrefix);
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );

  const openApi = new DocumentBuilder()
    .setTitle('Payments checkout API')
    .setDescription('Card checkout onboarding: catalog, transactions, customers and deliveries.')
    .setVersion(config.version)
    .build();
  SwaggerModule.setup(
    `${config.globalPrefix}/docs`,
    app,
    SwaggerModule.createDocument(app, openApi),
  );

  await app.listen(config.port);
  new Logger('Bootstrap').log(`API listening on port ${config.port} under /${config.globalPrefix}`);
}

void bootstrap();
