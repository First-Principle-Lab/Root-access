import { describe, expect, it } from 'vitest';
import {
  buildPostListOrderBy,
  buildPostListPageInfo,
  buildPostListPageItems,
  buildPostListSearchParams,
  buildPostListWhere,
  isPostFilterActive,
  parsePostListParams,
} from '@/src/lib/postFilters';

/* Unit coverage for the filtering and paging rules behind the single authenticated post list
   (src/app/api/admin/posts/route.ts, checkpoint 6 of docs/admin-redesign-plan.md). The integration
   specs (tests/integration/admin-post-list.test.ts) prove rows come back; these prove *why* those
   rows are the ones the filters asked for, without a database. */

describe('parsePostListParams', () => {
  it('applies the documented defaults to an empty query string', () => {
    const parsed = parsePostListParams(new URLSearchParams(''));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.query).toEqual({ status: 'all', sort: 'updated', page: 1, limit: 20 });
  });

  it('treats an empty parameter as absent rather than as a search for the empty string', () => {
    const parsed = parsePostListParams(new URLSearchParams('search=&subsection=&page=2'));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.query.search).toBeUndefined();
    expect(parsed.query.subsection).toBeUndefined();
    expect(parsed.query.page).toBe(2);
  });

  it('rejects an unknown status with a message naming the field', () => {
    const parsed = parsePostListParams(new URLSearchParams('status=live'));
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.message).toContain('status');
  });

  it('rejects a page of zero and a limit above the cap instead of silently clamping', () => {
    expect(parsePostListParams(new URLSearchParams('page=0')).ok).toBe(false);
    const tooBig = parsePostListParams(new URLSearchParams('limit=5000'));
    expect(tooBig.ok).toBe(false);
    if (tooBig.ok) return;
    expect(tooBig.message).toContain('limit');
  });

  it('coerces numeric strings, which is what a URL can only ever carry', () => {
    const parsed = parsePostListParams(new URLSearchParams('page=3&limit=5'));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.query.page).toBe(3);
    expect(parsed.query.limit).toBe(5);
  });
});

describe('buildPostListWhere', () => {
  it('produces no constraints for an unfiltered query, so the list is the whole table', () => {
    expect(buildPostListWhere({ status: 'all', sort: 'updated', page: 1, limit: 20 })).toEqual({});
  });

  it('maps the status filter onto the boolean `published` column (there is no status column)', () => {
    expect(buildPostListWhere({ status: 'published', sort: 'updated', page: 1, limit: 20 })).toEqual({
      published: true,
    });
    expect(buildPostListWhere({ status: 'draft', sort: 'updated', page: 1, limit: 20 })).toEqual({
      published: false,
    });
  });

  it('searches title and summary case-insensitively and trims the term', () => {
    const where = buildPostListWhere({ search: '  Chatter  ', status: 'all', sort: 'updated', page: 1, limit: 20 });
    expect(where.OR).toEqual([
      { title: { contains: 'Chatter', mode: 'insensitive' } },
      { description: { contains: 'Chatter', mode: 'insensitive' } },
    ]);
  });

  it('filters by the subsection relation on its slug and keeps working with every filter set', () => {
    const where = buildPostListWhere({
      search: 'x',
      status: 'draft',
      subsection: 'essays',
      sort: 'updated',
      page: 1,
      limit: 20,
    });
    expect(where).toEqual({
      published: false,
      subsection: { slug: 'essays' },
      OR: [
        { title: { contains: 'x', mode: 'insensitive' } },
        { description: { contains: 'x', mode: 'insensitive' } },
      ],
    });
  });
});

describe('buildPostListOrderBy', () => {
  it('ends every ordering on id so equal timestamps cannot move rows between pages', () => {
    for (const sort of ['updated', 'created', 'title'] as const) {
      const orderBy = buildPostListOrderBy({ status: 'all', sort, page: 1, limit: 20 });
      expect(orderBy.at(-1)).toEqual({ id: 'asc' });
    }
  });

  it('defaults to recently edited and honours the other two orders', () => {
    expect(buildPostListOrderBy({ status: 'all', sort: 'updated', page: 1, limit: 20 })[0]).toEqual({
      updatedAt: 'desc',
    });
    expect(buildPostListOrderBy({ status: 'all', sort: 'created', page: 1, limit: 20 })[0]).toEqual({
      createdAt: 'desc',
    });
    expect(buildPostListOrderBy({ status: 'all', sort: 'title', page: 1, limit: 20 })[0]).toEqual({
      title: 'asc',
    });
  });
});

describe('buildPostListSearchParams', () => {
  it('sends nothing for the untouched default filters', () => {
    expect(buildPostListSearchParams({}).toString()).toBe('');
    expect(buildPostListSearchParams({ search: '   ', status: 'all', sort: 'updated', page: 1 }).toString()).toBe('');
  });

  it('builds the query string the endpoint documents', () => {
    const params = buildPostListSearchParams({
      search: 'books',
      status: 'draft',
      subsection: 'reading',
      sort: 'title',
      page: 2,
      limit: 10,
    });
    expect(params.toString()).toBe('search=books&subsection=reading&status=draft&sort=title&page=2&limit=10');
  });
});

describe('buildPostListPageInfo', () => {
  it('reports an empty result as one empty page rather than zero pages', () => {
    expect(buildPostListPageInfo(0, 1, 10)).toEqual({
      page: 1,
      pageSize: 10,
      total: 0,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    });
  });

  it('pages 17 seeded posts at 10 per page and never reports a page past the end', () => {
    const first = buildPostListPageInfo(17, 1, 10);
    expect(first.totalPages).toBe(2);
    expect(first.hasNextPage).toBe(true);
    expect(first.hasPreviousPage).toBe(false);

    const last = buildPostListPageInfo(17, 2, 10);
    expect(last.page).toBe(2);
    expect(last.hasNextPage).toBe(false);
    expect(last.hasPreviousPage).toBe(true);

    // A deleted post can shrink the result under the requested page; clamp instead of 404-ish blank.
    expect(buildPostListPageInfo(10, 3, 10).page).toBe(1);
  });
});

describe('buildPostListPageItems', () => {
  it('shows no buttons for a single page and none at all for an empty result', () => {
    expect(buildPostListPageItems(1, 1)).toEqual([1]);
    expect(buildPostListPageItems(1, 0)).toEqual([]);
  });

  it('lists every page while the list is short', () => {
    expect(buildPostListPageItems(2, 4)).toEqual([1, 2, 3, 4]);
  });

  it('keeps the first and last page and ellipsises the gap around the current page', () => {
    expect(buildPostListPageItems(6, 12)).toEqual([1, 'gap', 5, 6, 7, 'gap', 12]);
    expect(buildPostListPageItems(1, 12)).toEqual([1, 2, 'gap', 12]);
    expect(buildPostListPageItems(12, 12)).toEqual([1, 'gap', 11, 12]);
  });
});

describe('isPostFilterActive', () => {
  it('is false for the untouched filter row, so no "Clear filters" control appears', () => {
    expect(isPostFilterActive({})).toBe(false);
    expect(isPostFilterActive({ search: ' ', status: 'all', subsection: '', sort: 'title', page: 2 })).toBe(false);
  });

  it('is true when search, status or subsection narrows the list', () => {
    expect(isPostFilterActive({ search: 'book' })).toBe(true);
    expect(isPostFilterActive({ status: 'draft' })).toBe(true);
    expect(isPostFilterActive({ subsection: 'essays' })).toBe(true);
  });
});
