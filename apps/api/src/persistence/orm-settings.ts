import { z } from 'zod';

/**
 * The only things the ORM actually needs.
 *
 * Narrower than the full application configuration on purpose: migrations and the
 * seeder have no business requiring a delivery fee or a throttle limit to run.
 * Demanding the whole config made `migration:up` fail in CI for variables it never
 * reads.
 */
export interface MikroOrmSettings {
  readonly databaseUrl: string;
  readonly debug: boolean;
}

const ormEnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

/**
 * Reads ORM settings straight from the environment, for entry points that run
 * outside the Nest container.
 *
 * @throws Error naming the offending variable.
 */
export function loadOrmSettings(source: Record<string, unknown>): MikroOrmSettings {
  const parsed = ormEnvSchema.safeParse(source);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');

    throw new Error(`Invalid database configuration:\n${details}`);
  }

  return {
    databaseUrl: parsed.data.DATABASE_URL,
    debug: parsed.data.NODE_ENV === 'development',
  };
}
