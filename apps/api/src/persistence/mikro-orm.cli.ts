/**
 * Entry point for the MikroORM CLI.
 *
 * The running application resolves configuration through the Nest container; the
 * CLI has no container, so it loads `.env` itself. Keeping this separate from
 * `mikro-orm.config.ts` means importing the builder never has the side effect of
 * reading the environment.
 */
import { existsSync } from 'node:fs';

import { config as loadEnvFile } from 'dotenv';

import { ENV_FILE_CANDIDATES } from '../config/env-file';
import { buildMikroOrmConfig } from './mikro-orm.config';
import { loadOrmSettings } from './orm-settings';

const envFile = ENV_FILE_CANDIDATES.find((candidate) => existsSync(candidate));

if (envFile !== undefined) {
  loadEnvFile({ path: envFile });
}

export default buildMikroOrmConfig(loadOrmSettings(process.env));
