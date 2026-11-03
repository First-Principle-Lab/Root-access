import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
    exclude: ['tests/e2e/**', 'node_modules/**', '.next/**'],
    reporters: ['default', 'json'],
    outputFile: { json: '/tmp/cora/evidence/admin-playwright/vitest-results.json' },
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
