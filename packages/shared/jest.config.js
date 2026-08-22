/** @type {import('jest').Config} */
module.exports = {
  rootDir: 'src',
  testEnvironment: 'node',
  transform: { '^.+\\.ts$': ['@swc/jest'] },
  collectCoverageFrom: ['**/*.ts', '!**/*.spec.ts', '!**/*.fixture.ts', '!**/index.ts'],
  coverageDirectory: '../coverage',
  coverageReporters: ['text', 'text-summary', 'lcov', 'json-summary'],
  // The gate lives here so `pnpm test:cov` fails locally for the same reason CI does.
  coverageThreshold: {
    global: { branches: 80, functions: 80, lines: 80, statements: 80 },
  },
};
