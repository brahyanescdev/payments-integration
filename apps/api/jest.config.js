/** @type {import('jest').Config} */
module.exports = {
  rootDir: 'src',
  testEnvironment: 'node',
  // Integration specs open real database connections; the default 5s is not enough
  // for the first connection plus migrations on a cold container.
  testTimeout: 30_000,
  transform: {
    '^.+\\.ts$': [
      '@swc/jest',
      {
        jsc: {
          parser: { syntax: 'typescript', decorators: true },
          transform: { legacyDecorator: true, decoratorMetadata: true },
          target: 'es2022',
        },
      },
    ],
  },
  moduleNameMapper: {
    '^@payments/shared$': '<rootDir>/../../../packages/shared/src/index.ts',
  },
  collectCoverageFrom: [
    '**/*.ts',
    '!**/*.spec.ts',
    '!**/*.fixture.ts',
    '!testing/**',
    '!**/*.module.ts',
    // Entry points and generated schema scripts: composition and SQL, not logic.
    // They are exercised end to end by Playwright and by the migration run in CI,
    // which is the level at which they can actually fail.
    '!**/main.ts',
    '!**/*.cli.ts',
    '!persistence/seed.ts',
    '!persistence/migrations/**',
    '!**/index.ts',
  ],
  coverageDirectory: '../coverage',
  coverageReporters: ['text', 'text-summary', 'lcov', 'json-summary'],
  // The gate lives here so `pnpm test:cov` fails locally for the same reason CI does.
  coverageThreshold: {
    global: { branches: 80, functions: 80, lines: 80, statements: 80 },
  },
};
