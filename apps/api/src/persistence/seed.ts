/**
 * Populates the catalogue with fictional products.
 *
 * ```bash
 * pnpm --filter @payments/api seed
 * ```
 *
 * Idempotent by SKU: running it twice updates the existing rows instead of
 * duplicating them, so it is safe to re-run against a database that already has
 * orders against those products. Stock is only reset for rows the seeder creates —
 * overwriting it would silently undo real reservations.
 *
 * The data itself lives in `products.seed.json` rather than in this file: the
 * seeder is code, the catalogue is content.
 */
import { existsSync } from 'node:fs';

import { MikroORM } from '@mikro-orm/postgresql';
import { config as loadEnvFile } from 'dotenv';

import { ENV_FILE_CANDIDATES } from '../config/env-file';
import { ProductEntity } from '../modules/catalog/infrastructure/persistence/product.entity';
import { buildMikroOrmConfig } from './mikro-orm.config';
import { loadOrmSettings } from './orm-settings';
import seedData from './products.seed.json';

interface SeedProduct {
  id: string;
  sku: string;
  name: string;
  description: string;
  priceInCents: number;
  imagePath: string;
  stock: number;
}

function applySeedValues(row: ProductEntity, product: SeedProduct, currency: string): void {
  row.sku = product.sku;
  row.name = product.name;
  row.description = product.description;
  row.priceInCents = product.priceInCents;
  row.currency = currency;
  // Paths are relative to the SPA origin: images are served from the same
  // CloudFront distribution as the app, so they need no extra DNS lookup, no TLS
  // handshake and no `img-src` exception in the content security policy.
  row.imageUrl = product.imagePath;
}

async function seed(): Promise<void> {
  const envFile = ENV_FILE_CANDIDATES.find((candidate) => existsSync(candidate));

  if (envFile !== undefined) {
    loadEnvFile({ path: envFile });
  }

  const orm = await MikroORM.init(buildMikroOrmConfig(loadOrmSettings(process.env)));
  const em = orm.em.fork();

  let created = 0;
  let updated = 0;

  for (const product of seedData.products as SeedProduct[]) {
    const existing = await em.findOne(ProductEntity, { sku: product.sku });

    if (existing === null) {
      const row = new ProductEntity();
      row.id = product.id;
      applySeedValues(row, product, seedData.currency);
      row.stock = product.stock;
      em.persist(row);
      created += 1;
      continue;
    }

    applySeedValues(existing, product, seedData.currency);
    updated += 1;
  }

  await em.flush();
  await orm.close();

  console.warn(`Seed complete: ${created} product(s) created, ${updated} updated.`);
}

seed().catch((error: unknown) => {
  console.error('Seed failed:', error);
  process.exitCode = 1;
});
