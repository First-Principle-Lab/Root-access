import { NextRequest } from 'next/server';
import { POST as loginHandler } from '@/src/app/api/admin/login/route';

/* Integration tests call the real route handlers in-process, so the session has to come from the
   real login endpoint rather than a hand-made token: `withAuth` only ever sees the `auth-token`
   cookie (src/lib/auth.ts:7), and a fabricated token would keep passing even if login broke. */
const adminEmail = process.env.ADMIN_TEST_EMAIL ?? 'admin@test.local';
const adminSecret = process.env.ADMIN_TEST_SECRET ?? 'test-secret-123';

let cachedCookie: string | null = null;

export async function adminCookieHeader(): Promise<string> {
  if (cachedCookie) return cachedCookie;

  const request = new NextRequest('http://localhost/api/admin/login', {
    body: JSON.stringify({ email: adminEmail, secretKey: adminSecret }),
    headers: { 'content-type': 'application/json' },
    method: 'POST',
  });
  const response = await loginHandler(request);
  if (!response.ok) {
    throw new Error(`login failed: ${response.status} ${await response.text()}`);
  }

  const token = response.cookies.get('auth-token')?.value;
  if (!token) throw new Error('login did not set the auth-token cookie');
  cachedCookie = `auth-token=${token}`;
  return cachedCookie;
}

/** A GET request to an admin route, authenticated with the real session cookie. */
export async function authedRequest(pathWithQuery: string): Promise<NextRequest> {
  return new NextRequest(`http://localhost${pathWithQuery}`, {
    headers: { cookie: await adminCookieHeader() },
    method: 'GET',
  });
}

/** The same request with no session at all, for the auth-required assertions. */
export function anonymousRequest(pathWithQuery: string): NextRequest {
  return new NextRequest(`http://localhost${pathWithQuery}`, { method: 'GET' });
}
