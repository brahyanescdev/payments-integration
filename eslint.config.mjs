import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import boundaries from 'eslint-plugin-boundaries';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

/**
 * Selectors that catch raw environment access. Configuration must be read once,
 * validated, and exposed as a typed object — see `apps/<app>/src/config`. Reading
 * `process.env` or `import.meta.env` anywhere else is how hardcoded values and
 * silent misconfiguration creep back in, so the build rejects it.
 */
const NO_RAW_ENV_ACCESS = [
  {
    selector: 'MemberExpression[object.name="process"][property.name="env"]',
    message: 'Read configuration from the typed config module instead of process.env.',
  },
  {
    selector: 'MemberExpression[object.type="MetaProperty"][property.name="env"]',
    message: 'Read configuration from the typed config module instead of import.meta.env.',
  },
];

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      '**/cdk.out/**',
      '**/playwright-report/**',
      '**/test-results/**',
      'docs/evidence/**',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.node },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      'no-restricted-syntax': ['error', ...NO_RAW_ENV_ACCESS],
      // Clarity guardrails: a function that outgrows these is doing too much.
      complexity: ['error', { max: 10 }],
      'max-lines-per-function': ['error', { max: 60, skipBlankLines: true, skipComments: true }],
      'max-depth': ['error', 3],
      eqeqeq: ['error', 'always'],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },

  /**
   * Hexagonal dependency rule, enforced rather than documented.
   * domain -> nothing outside itself; application -> domain; infrastructure -> everything.
   */
  {
    files: ['apps/api/src/**/*.ts'],
    plugins: { boundaries },
    settings: {
      'boundaries/include': ['apps/api/src/**/*.ts'],
      'boundaries/elements': [
        {
          type: 'domain',
          pattern: 'apps/api/src/modules/*/domain/**/*',
          mode: 'full',
          capture: ['module'],
        },
        {
          type: 'application',
          pattern: 'apps/api/src/modules/*/application/**/*',
          mode: 'full',
          capture: ['module'],
        },
        {
          type: 'infrastructure',
          pattern: 'apps/api/src/modules/*/infrastructure/**/*',
          mode: 'full',
          capture: ['module'],
        },
        // Shared persistence wiring: same privileges as any other adapter, it just
        // lives outside a single module because it composes all of them.
        { type: 'infrastructure', pattern: 'apps/api/src/persistence/**/*', mode: 'full' },
        {
          type: 'module-root',
          pattern: 'apps/api/src/modules/*/*.ts',
          mode: 'full',
          capture: ['module'],
        },
        { type: 'shared', pattern: 'apps/api/src/shared/**/*', mode: 'full' },
        { type: 'config', pattern: 'apps/api/src/config/**/*', mode: 'full' },
        { type: 'bootstrap', pattern: 'apps/api/src/*.ts', mode: 'full' },
      ],
    },
    rules: {
      'boundaries/element-types': [
        'error',
        {
          default: 'disallow',
          rules: [
            { from: ['domain'], allow: ['domain', 'shared'] },
            { from: ['application'], allow: ['domain', 'application', 'shared'] },
            {
              from: ['infrastructure'],
              allow: ['domain', 'application', 'infrastructure', 'shared', 'config'],
            },
            // Nest modules are the composition root: they are allowed to see every
            // layer precisely so no other file has to.
            { from: ['module-root'], allow: ['*'] },
            { from: ['shared'], allow: ['shared', 'domain'] },
            { from: ['config'], allow: ['config', 'shared'] },
            { from: ['bootstrap'], allow: ['*'] },
          ],
        },
      ],
      'boundaries/external': [
        'error',
        {
          default: 'allow',
          rules: [
            {
              from: ['domain'],
              disallow: ['@nestjs/*', '@mikro-orm/*', 'express', 'axios', 'pg'],
              message:
                'The domain layer must stay free of framework, ORM and transport dependencies.',
            },
            {
              from: ['application'],
              disallow: ['@nestjs/*', '@mikro-orm/*', 'express', 'pg'],
              message:
                'Use cases are plain classes wired by the Nest module; they must not import Nest, persistence or transport libraries.',
            },
          ],
        },
      ],
    },
  },

  // Raw environment access is confined to config modules and to the entry points
  // that bootstrap configuration before any container exists: the ORM CLI, the
  // seeder, tooling scripts and the integration-test harness.
  {
    files: [
      'apps/*/src/config/**/*.ts',
      'apps/*/src/testing/**/*.ts',
      'apps/api/src/persistence/seed.ts',
      '**/jest.global-setup.ts',
      '**/*.cli.ts',
      '**/*.config.ts',
      '**/*.config.js',
      'scripts/**/*.{ts,mts}',
    ],
    rules: { 'no-restricted-syntax': 'off' },
  },

  // Developer CLIs: writing to stdout is their output, not stray debugging.
  {
    files: ['scripts/**/*.{ts,mts}'],
    rules: { 'no-console': 'off' },
  },

  // Tests describe scenarios; length and console noise limits get in the way there.
  {
    files: ['**/*.spec.ts', '**/*.spec.tsx', '**/*.test.ts', '**/*.test.tsx', 'e2e/**/*.ts'],
    rules: {
      'max-lines-per-function': 'off',
      'no-restricted-syntax': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },

  prettier,
);
