import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/* Vitest does not read .env the way `next build` does, and the API route handlers throw at import
   time without DATABASE_URL (src/lib/prisma.ts:12) and JWT_SECRET (src/lib/auth.ts:4). This loads
   the same file Next would, resolved from this file rather than the working directory, so
   `npx vitest run` works from the repo root the way the review instructions state it. No value is
   ever printed: a secret must not reach the test output. Already-set variables win, so a CI env can
   override the local file. */
const envPath = fileURLToPath(new URL('../../.env', import.meta.url));

if (existsSync(envPath)) {
  for (const rawLine of readFileSync(envPath, 'utf8').split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim();
    if (!key || process.env[key] !== undefined) continue;
    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}
