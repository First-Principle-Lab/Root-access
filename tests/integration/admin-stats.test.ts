import { describe, expect, it } from 'vitest';
import { GET } from '@/src/app/api/admin/stats/route';
import { prisma } from '@/src/lib/prisma';
import { anonymousRequest, authedRequest } from './helpers/session';

/* Checkpoint 5 of docs/admin-redesign-plan.md: "no metric the API cannot supply accurately". The
   dashboard reads this endpoint, so the counts are checked here against the same tables, with the
   draft count that the old endpoint left out entirely (it ran a single
   `prisma.post.count({ where: { published: true } })` and reported it as "Posts", which hid the
   five seeded drafts from the dashboard). */

interface StatsBody {
  sections: number;
  hiddenSections: number;
  subsections: number;
  hiddenSubsections: number;
  published: number;
  drafts: number;
  totalPosts: number;
  tags: number;
  message?: string;
}

async function stats(authenticated = true) {
  const response = await GET(authenticated ? await authedRequest('/api/admin/stats') : anonymousRequest('/api/admin/stats'));
  return { body: (await response.json()) as StatsBody, status: response.status };
}

describe('GET /api/admin/stats', () => {
  it('refuses a request with no session cookie', async () => {
    const { body, status } = await stats(false);
    expect(status).toBe(401);
    expect(body.message).toBe('Unauthorized');
  });

  it('answers with counts that match the database row for row', async () => {
    const { body, status } = await stats();
    expect(status).toBe(200);

    const [sections, hiddenSections, subsections, hiddenSubsections, published, drafts, tags] =
      await Promise.all([
        prisma.topCategory.count(),
        prisma.topCategory.count({ where: { isVisible: false } }),
        prisma.subsection.count(),
        prisma.subsection.count({ where: { isVisible: false } }),
        prisma.post.count({ where: { published: true } }),
        prisma.post.count({ where: { published: false } }),
        prisma.tag.count(),
      ]);

    expect(body).toMatchObject({
      drafts,
      hiddenSections,
      hiddenSubsections,
      published,
      sections,
      subsections,
      tags,
    });
    expect(body.published).toBeGreaterThan(0);
    expect(body.drafts).toBeGreaterThan(0);
  });

  it('splits posts into published and drafts instead of reporting one of them as "Posts"', async () => {
    const { body } = await stats();
    const allPosts = await prisma.post.count();

    expect(body.totalPosts).toBe(allPosts);
    expect(body.published + body.drafts).toBe(allPosts);
    // The bug this replaced: the single number the old endpoint returned was published-only.
    expect(body.published).not.toBe(body.totalPosts);
  });

  it('does not report more hidden rows than there are rows', async () => {
    const { body } = await stats();
    expect(body.hiddenSections).toBeLessThanOrEqual(body.sections);
    expect(body.hiddenSubsections).toBeLessThanOrEqual(body.subsections);
  });
});
