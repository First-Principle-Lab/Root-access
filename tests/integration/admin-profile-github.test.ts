import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GET as getProfile, PATCH as patchProfile } from '@/src/app/api/admin/profile/route';
import { GET as getLayout } from '@/src/app/api/public/layout/route';
import { DEFAULT_GITHUB_URL } from '@/src/lib/githubLink';
import { prisma } from '@/src/lib/prisma';
import { anonymousJsonRequest, authedJsonRequest, authedRequest } from './helpers/session';

/* Checkpoint 7 of docs/admin-redesign-plan.md: `githubLink` is validated by the shared zod schema in
   src/schema/profileSchema.ts, written through the existing admin profile route (no second write
   path), and read back by the public layout endpoint the public sidebar reads. These call the real
   handlers against the isolated `rootaccess_admin_dev` database, so the column added by
   prisma/migrations/20261103120000_profile_github_link has to exist for them to pass at all.
   There is one shared profile row, so its `githubLink` and `bio` are captured here and put back in
   afterAll: the checkpoint 5 profile round trip and the screenshot pass read the same row. */

const EDITED_URL = 'https://github.com/edited-by-the-test-suite';
const INVALID_VALUES = ['github.com/parththirwani', 'not a url', '', 'https://'];

let row: { bio: string | null; githubLink: string | null; id: string };

async function readRow() {
  const profile = await prisma.profile.findFirst();
  if (!profile) throw new Error('the profile row disappeared');
  return profile;
}

async function patch(body: unknown, authenticated = true) {
  const request = authenticated
    ? await authedJsonRequest('/api/admin/profile', 'PATCH', body)
    : anonymousJsonRequest('/api/admin/profile', 'PATCH', body);
  const response = await patchProfile(request);
  return { body: await response.json(), status: response.status };
}

async function publicLayoutGithubLink(): Promise<string | null | undefined> {
  const layout = await getLayout(await authedRequest('/api/public/layout'));
  const body = (await layout.json()) as {
    admin: { profile: { githubLink?: string | null } | null };
  };
  return body.admin.profile?.githubLink;
}

beforeAll(async () => {
  const profile = await prisma.profile.findFirst();
  if (!profile) throw new Error('no Profile row to test against - run /tmp/cora/seed.sql first');
  row = { bio: profile.bio, githubLink: profile.githubLink, id: profile.id };
});

afterAll(async () => {
  await prisma.profile.update({
    data: { bio: row.bio, githubLink: row.githubLink },
    where: { id: row.id },
  });
});

describe('PATCH /api/admin/profile - githubLink', () => {
  it('refuses the mutation without a session and changes nothing', async () => {
    const { body, status } = await patch({ githubLink: EDITED_URL }, false);
    expect(status).toBe(401);
    expect((body as { message?: string }).message).toContain('Unauthorized');
    expect((await readRow()).githubLink).toBe(row.githubLink);
  });

  it.each(INVALID_VALUES)('rejects %j through the shared schema and stores nothing', async (value) => {
    const { body, status } = await patch({ githubLink: value });
    expect(status).toBe(400);
    expect((body as { errors?: Record<string, unknown> }).errors?.githubLink).toBeTruthy();
    expect((await readRow()).githubLink).toBe(row.githubLink);
  });

  it('accepts a valid GitHub URL and serves it back on GET /api/admin/profile', async () => {
    const updated = await patch({ githubLink: EDITED_URL });
    expect(updated.status).toBe(200);
    expect((updated.body as { profile: { githubLink: string | null } }).profile.githubLink).toBe(
      EDITED_URL,
    );

    const fetched = await getProfile(await authedRequest('/api/admin/profile'));
    const fetchedBody = (await fetched.json()) as { profile: { githubLink: string | null } };
    expect(fetchedBody.profile.githubLink).toBe(EDITED_URL);
  });

  it('hands the stored value to the public layout read the sidebar uses', async () => {
    expect(await publicLayoutGithubLink()).toBe(EDITED_URL);
  });

  it('clears to null on an explicit null, which is what the admin form sends for empty', async () => {
    const cleared = await patch({ githubLink: null });
    expect(cleared.status).toBe(200);
    expect((cleared.body as { profile: { githubLink: string | null } }).profile.githubLink).toBeNull();
    expect(await publicLayoutGithubLink()).toBeNull();
  });

  it('leaves the column alone when the payload does not mention it', async () => {
    await patch({ githubLink: EDITED_URL });
    const untouched = await patch({ bio: 'A bio written by the integration test.' });
    expect(untouched.status).toBe(200);
    expect((await readRow()).githubLink).toBe(EDITED_URL);
  });

  it('comes out of the round trip as the same profile row with its other columns intact', async () => {
    const profile = await readRow();
    expect(profile.id).toBe(row.id);
    expect(profile.email).toBe('hello@test.local');
    expect(profile.xLink).toBe('https://x.com/parththirwani');
    expect(profile.linkedinLink).toBe('https://linkedin.com/in/parththirwani');
    expect(profile.instagramLink).toBe('https://instagram.com/parththirwani');
    expect([DEFAULT_GITHUB_URL, EDITED_URL]).toContain(profile.githubLink);
  });
});
