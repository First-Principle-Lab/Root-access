import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3099';

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: '/tmp/cora/evidence/admin-playwright/test-results',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['json', { outputFile: '/tmp/cora/evidence/admin-playwright/results.json' }]],
  use: {
    baseURL,
    trace: 'off',
    video: 'off',
    reducedMotion: 'reduce',
    launchOptions: {
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
