import type { Page } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3099';
const adminEmail = process.env.ADMIN_TEST_EMAIL ?? 'admin@test.local';
const adminSecret = process.env.ADMIN_TEST_SECRET ?? 'test-secret-123';

/** The isolated test account, also used by specs that drive the login form itself. */
export const adminCredentials = { email: adminEmail, secretKey: adminSecret };

/**
 * Authenticates through the real POST /api/admin/login endpoint (the same call the
 * login form makes via src/lib/api.ts) and installs the resulting httpOnly
 * `auth-token` cookie on the page/context. Never fabricates a token: an auth
 * regression must fail these tests.
 */
export async function loginAsAdmin(page: Page) {
  const response = await page.request.post(`${baseURL}/api/admin/login`, {
    data: { email: adminEmail, secretKey: adminSecret },
  });
  if (!response.ok()) {
    throw new Error(`loginAsAdmin failed: ${response.status()} ${await response.text()}`);
  }
}
