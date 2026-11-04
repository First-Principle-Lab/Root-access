import { describe, expect, it } from 'vitest';
import { buildOverviewRows } from '../../src/components/admin/dashboard/overviewRows';
import { formatRelativeTime, publicPostPath } from '../../src/components/admin/dashboard/recentEdits';
import type { DashboardStats } from '@/src/types';

/* The dashboard is allowed to show only counts the stats endpoint can actually make
   (src/app/api/admin/stats/route.ts). These pin the two rules the old screen got wrong: drafts are
   a number of their own (the baseline's single "Posts" card counted published rows only, so five
   seeded drafts were invisible), and a hidden count is reported as a hidden count. */
const STATS: DashboardStats = {
  drafts: 5,
  hiddenSections: 0,
  hiddenSubsections: 1,
  published: 12,
  sections: 6,
  subsections: 7,
  tags: 4,
  totalPosts: 17,
};

const row = (key: string) => {
  const found = buildOverviewRows(STATS).find((candidate) => candidate.key === key);
  if (!found) throw new Error(`no overview row for ${key}`);
  return found;
};

describe('buildOverviewRows', () => {
  it('reads every value straight out of the stats payload', () => {
    const values = Object.fromEntries(buildOverviewRows(STATS).map((r) => [r.key, r.value]));
    expect(values).toEqual({
      drafts: 5,
      published: 12,
      sections: 6,
      subsections: 7,
      tags: 4,
    });
  });

  it('labels the drafts row as work that is not public', () => {
    expect(row('drafts').hint).toBe('not on the public site');
    expect(row('published').hint).toBe('12 on the public site');
  });

  it('shows a hidden count when there is one and says so plainly when there is not', () => {
    expect(row('subsections').hint).toBe('1 hidden');
    expect(row('sections').hint).toBe('all visible');
  });

  it('links each row to the screen that edits it', () => {
    expect(row('published').href).toBe('/admin/posts');
    expect(row('sections').href).toBe('/admin/sections');
    expect(row('subsections').href).toBe('/admin/subsections');
    expect(row('tags').href).toBe('/admin/tags');
  });
});

const NOW = Date.parse('2026-03-05T12:00:00.000Z');

describe('formatRelativeTime', () => {
  it('stays vague for the recent past and exact once a week has passed', () => {
    expect(formatRelativeTime(new Date(NOW - 30_000).toISOString(), NOW)).toBe('just now');
    expect(formatRelativeTime(new Date(NOW - 5 * 60_000).toISOString(), NOW)).toBe('5 min ago');
    expect(formatRelativeTime(new Date(NOW - 3 * 3_600_000).toISOString(), NOW)).toBe('3 hours ago');
    expect(formatRelativeTime(new Date(NOW - 60 * 60_000).toISOString(), NOW)).toBe('1 hour ago');
    expect(formatRelativeTime(new Date(NOW - 2 * 86_400_000).toISOString(), NOW)).toBe('2 days ago');
    expect(formatRelativeTime(new Date(NOW - 86_400_000).toISOString(), NOW)).toBe('1 day ago');
    expect(formatRelativeTime(new Date(NOW - 9 * 86_400_000).toISOString(), NOW)).toContain('2026');
  });

  it('never invents a date for a missing or unreadable timestamp', () => {
    for (const value of [null, undefined, '', 'not a date']) {
      expect(formatRelativeTime(value, NOW)).toBe('no date');
    }
  });
});

describe('publicPostPath', () => {
  it('matches the public article route (src/app/(site)/[slug]/[postSlug]/page.tsx)', () => {
    expect(publicPostPath('writing', 'hello-world')).toBe('/writing/hello-world');
  });
});
