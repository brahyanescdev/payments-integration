import { fileURLToPath } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/**
 * The shared package is consumed from TypeScript source rather than its CommonJS
 * build: `tsc`'s `__exportStar` re-exports are opaque to Rollup's static analysis,
 * which breaks tree shaking and named imports. The API keeps consuming `dist`,
 * where CommonJS is exactly what Nest expects.
 */
const sharedSource = fileURLToPath(new URL('../../packages/shared/src/index.ts', import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@payments/shared': sharedSource },
  },
  server: { port: 5173 },
  preview: { port: 4173 },
  build: { outDir: 'dist', sourcemap: true },
});
