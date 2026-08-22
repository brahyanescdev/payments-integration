/** @type {import('jest').Config} */
module.exports = {
  rootDir: 'src',
  testEnvironment: 'node',
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
    '!**/*.module.ts',
    '!**/main.ts',
    '!**/index.ts',
  ],
  coverageDirectory: '../coverage',
  coverageReporters: ['text', 'text-summary', 'lcov', 'json-summary'],
  // The gate lives here so `pnpm test:cov` fails locally for the same reason CI does.
  coverageThreshold: {
    global: { branches: 80, functions: 80, lines: 80, statements: 80 },
  },
};
