import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/* The API integration tests import the real `route.ts` handlers, which read DATABASE_URL and
   JWT_SECRET at module scope (src/lib/prisma.ts:12, src/lib/auth.ts:4). Vitest does not load
   .env the way `next build` does, so one setup file does it and the `@/*` alias from
   tsconfig.json is mirrored here; without both, importing a route throws immediately. */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
  test: {
    setupFiles: ['./tests/setup/loadTestEnv.ts'],
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
    exclude: ['tests/e2e/**', 'node_modules/**', '.next/**'],
    reporters: ['default', 'json'],
    outputFile: { json: '/tmp/cora/evidence/admin-playwright/vitest-results.json' },
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
