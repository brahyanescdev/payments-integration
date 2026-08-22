/** @type {import('jest').Config} */
module.exports = {
  rootDir: '.',
  testEnvironment: 'jsdom',
  // jest-environment-jsdom defaults to the 'browser' export condition, under which
  // msw's package.json maps './node' to `null` — msw ships that entry point only
  // for the 'node'/'default' conditions. Clearing the override lets Jest fall back
  // to the conditions Node actually resolves with.
  testEnvironmentOptions: { customExportConditions: [''] },
  // msw v2's dependency chain ships pure ESM, several levels deep. Excluding
  // specific packages by name breaks under pnpm: its `.pnpm` virtual store
  // inserts an extra `node_modules` segment ('node_modules/.pnpm/pkg@1.0.0/
  // node_modules/pkg/...'), which defeats a plain 'node_modules/(?!allowed)'
  // lookahead — it matches the FIRST 'node_modules/' segment, before pnpm's
  // internal layout, and excludes everything under it regardless of the
  // package. Transforming every file sidesteps that: swc parses plain ESM/JS
  // fine, and the extra work is not noticeable at this project's size.
  transformIgnorePatterns: [],
  setupFiles: ['<rootDir>/jest.polyfills.cjs'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testMatch: ['<rootDir>/src/**/*.spec.{ts,tsx}'],
  transform: {
    '^.+\\.m?(t|j)sx?$': [
      '@swc/jest',
      {
        jsc: {
          parser: { syntax: 'typescript', tsx: true },
          transform: { react: { runtime: 'automatic' } },
          target: 'es2022',
        },
      },
    ],
  },
  moduleNameMapper: {
    // Styles carry no behaviour worth asserting; the build is what validates them.
    '\\.(css|scss)$': '<rootDir>/src/testing/style.stub.ts',
    '^@payments/shared$': '<rootDir>/../../packages/shared/src/index.ts',
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.spec.{ts,tsx}',
    '!src/main.tsx',
    // Composition root: wires the one store instance from config, same rationale
    // as excluding the backend's main.ts and *.module.ts files.
    '!src/app/store.ts',
    '!src/testing/**',
    '!src/**/index.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'text-summary', 'lcov', 'json-summary'],
  // The gate lives here so `pnpm test:cov` fails locally for the same reason CI does.
  coverageThreshold: {
    global: { branches: 80, functions: 80, lines: 80, statements: 80 },
  },
};
