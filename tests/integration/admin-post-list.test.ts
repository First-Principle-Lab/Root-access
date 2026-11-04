import { describe, expect, it } from 'vitest';
import { GET } from '@/src/app/api/admin/posts/route';
import { prisma } from '@/src/lib/prisma';
import { anonymousRequest, authedRequest } from './helpers/session';

/* Prisma's unsafe raw query speaks Postgres placeholders (`$1`), not the `?` of the pg driver. */
async function countBySql(where: string, ...values: unknown[]): Promise<number> {
  const rows = await prisma.$queryRawUnsafe<[{ count: bigint | number }]>(
    `SELECT count(*)::int AS count FROM "Post" p JOIN "Subsection" s ON s.id = p."subsectionId" WHERE ${where}`,
    ...values,
  );
  return Number(rows[0].count);
}

/* Checkpoint 6 of docs/admin-redesign-plan.md asks for an API integration test of the new list
   endpoint covering filtering, pagination, auth and the error path. These call the route handler
   itself against the isolated `rootaccess_admin_dev` database (the same one `npx next start`
   serves), so no HTTP server is needed and nothing is stubbed: the SQL, the zod query schema and
   `withAuth` are all exercised for real. Expected counts are read back with raw SQL instead of the
   endpoint's own where-builder, so a wrong filter cannot agree with itself.
   Run recipe: `npm run build`, start the server (not required here), then `npx vitest run` - the
   setup file loads .env so DATABASE_URL and JWT_SECRET match the app's. */

interface PostRow {
  id: string;
  title: string;
  slug: string;
  published: boolean;
  updatedAt: string;
  subsection: { name: string; slug: string; displayStyle: string };
  content?: string;
}

interface ListBody {
  posts: PostRow[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  message?: string;
}

async function list(pathWithQuery: string, authenticated = true) {
  const request = authenticated ? await authedRequest(pathWithQuery) : anonymousRequest(pathWithQuery);
  const response = await GET(request);
  return { body: (await response.json()) as ListBody, status: response.status };
}


describe('GET /api/admin/posts', () => {
  it('refuses a request with no session cookie', async () => {
    const { body, status } = await list('/api/admin/posts', false);
    expect(status).toBe(401);
    expect(body.message).toBe('Unauthorized');
  });

  it('answers with the whole seeded list plus page metadata when no filter is given', async () => {
    const { body, status } = await list('/api/admin/posts');
    const expected = await countBySql('true');

    expect(status).toBe(200);
    expect(body.total).toBe(expected);
    expect(body.posts).toHaveLength(expected);
    expect(body).toMatchObject({ hasNextPage: false, hasPreviousPage: false, page: 1, totalPages: 1 });
    // The list ships row metadata, not the markdown body of every post.
    expect(body.posts[0]).not.toHaveProperty('content');
    expect(body.posts[0]).toMatchObject({
      slug: expect.any(String),
      title: expect.any(String),
      updatedAt: expect.any(String),
    });
    expect(body.posts[0]?.subsection?.slug).toBeTruthy();
  });

  it('filters by publication state, and the two halves add up to the whole', async () => {
    const published = await list('/api/admin/posts?status=published');
    const drafts = await list('/api/admin/posts?status=draft');

    expect(published.status).toBe(200);
    expect(published.body.posts.length).toBeGreaterThan(0);
    expect(published.body.posts.every((post) => post.published)).toBe(true);
    expect(drafts.body.posts.length).toBeGreaterThan(0);
    expect(drafts.body.posts.every((post) => !post.published)).toBe(true);

    expect(published.body.total).toBe(await countBySql('p.published = true'));
    expect(drafts.body.total).toBe(await countBySql('p.published = false'));

    const all = await list('/api/admin/posts');
    expect(published.body.total + drafts.body.total).toBe(all.body.total);
  });

  it('filters by subsection slug and keeps sibling subsections out of the result', async () => {
    const projects = await list('/api/admin/posts?subsection=projects');
    expect(projects.status).toBe(200);
    expect(projects.body.posts.length).toBeGreaterThan(0);
    expect(projects.body.posts.every((post) => post.subsection.slug === 'projects')).toBe(true);
    expect(projects.body.total).toBe(await countBySql('s.slug = $1', 'projects'));

    /* The two subsections of the "Writing" section are the point: the filter is per-subsection,
       so a sibling under the same parent must not leak in. */
    const engineering = await list('/api/admin/posts?subsection=engineering');
    const essays = await list('/api/admin/posts?subsection=essays');
    const engineeringIds = new Set(engineering.body.posts.map((post) => post.id));
    for (const post of essays.body.posts) expect(engineeringIds.has(post.id)).toBe(false);
  });

  it('searches title and summary, case-insensitively, and reports an honest total', async () => {
    const byTitle = await list('/api/admin/posts?search=TRUNCATION');
    expect(byTitle.status).toBe(200);
    expect(byTitle.body.posts.map((post) => post.slug)).toContain(
      'very-long-post-title-truncation-check',
    );
    expect(byTitle.body.total).toBe(byTitle.body.posts.length);

    const byPhrase = await list('/api/admin/posts?search=Truncate%20Gracefully');
    expect(byPhrase.body.posts.map((post) => post.slug)).toContain(
      'very-long-post-title-truncation-check',
    );

    const nothing = await list('/api/admin/posts?search=zzzz-no-such-post');
    expect(nothing.status).toBe(200);
    expect(nothing.body.posts).toEqual([]);
    expect(nothing.body.total).toBe(0);
    expect(nothing.body.totalPages).toBe(1);
  });

  it('combines filters instead of letting one overwrite another', async () => {
    const { body, status } = await list('/api/admin/posts?status=draft&subsection=engineering');
    expect(status).toBe(200);
    expect(body.total).toBe(await countBySql('p.published = false AND s.slug = $1', 'engineering'));
    expect(
      body.posts.every((post) => !post.published && post.subsection.slug === 'engineering'),
    ).toBe(true);
  });

  it('paginates without dropping or repeating a row, even on tied timestamps', async () => {
    const first = await list('/api/admin/posts?limit=5&page=1');
    const second = await list('/api/admin/posts?limit=5&page=2');
    const all = await list('/api/admin/posts');

    expect(first.body.pageSize).toBe(5);
    expect(first.body.posts).toHaveLength(5);
    expect(first.body.hasNextPage).toBe(true);
    expect(second.body.hasPreviousPage).toBe(true);

    const seeded = all.body.total;
    expect(first.body.totalPages).toBe(Math.ceil(seeded / 5));

    const seen = new Set<string>();
    for (let page = 1; page <= first.body.totalPages; page += 1) {
      const { body } = await list(`/api/admin/posts?limit=5&page=${page}`);
      for (const post of body.posts) {
        expect(seen.has(post.id)).toBe(false);
        seen.add(post.id);
      }
    }
    expect(seen.size).toBe(seeded);
  });

  it('rejects a malformed query with a 400 that names the parameter', async () => {
    for (const query of ['status=everything', 'page=0', 'limit=5000', 'page=abc']) {
      const { body, status } = await list(`/api/admin/posts?${query}`);
      expect(status).toBe(400);
      expect(body.message).toContain('Invalid');
    }
  });

  it('treats an empty filter value as "no filter" rather than an error', async () => {
    const { body, status } = await list('/api/admin/posts?subsection=&search=&status=all');
    expect(status).toBe(200);
    expect(body.posts.length).toBe(await countBySql('true'));
  });
});
