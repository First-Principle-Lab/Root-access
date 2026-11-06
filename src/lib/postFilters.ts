import type { Prisma } from '@/prisma/generated/client';
import { postListQuerySchema, type PostListQuery } from '@/src/schema/postsSchema';

/* Server-side filtering for the single authenticated post list
   (src/app/api/admin/posts/route.ts, checkpoint 6 of docs/admin-redesign-plan.md).
   The baseline had no query contract at all: `PostsManager` requested every subsection
   (`src/components/admin/post/PostsManager.tsx:55-58`) and filtered by subsection in the
   browser, with no search, no status filter and no pagination, and it turned a failed
   subsection request into an empty list. Everything that decides *which* rows come back now
   lives here, as pure functions, so the rules are unit-testable without a database. */

export type PostListParseResult =
  | { ok: true; query: PostListQuery }
  | { ok: false; message: string };

const QUERY_KEYS = ['search', 'status', 'subsection', 'sort', 'page', 'limit'] as const;

/**
 * Reads the list query out of a URL's search params. Empty values are dropped rather than
 * validated (`?search=` means "no search", not "search for the empty string"), and anything the
 * zod schema rejects becomes a 400 with the schema's own message instead of a silent default.
 */
export function parsePostListParams(params: URLSearchParams): PostListParseResult {
  const input: Record<string, string> = {};
  for (const key of QUERY_KEYS) {
    const value = params.get(key);
    if (value !== null && value.trim() !== '') input[key] = value;
  }

  const parsed = postListQuerySchema.safeParse(input);
  if (parsed.success) return { ok: true, query: parsed.data };

  const [first] = parsed.error.issues;
  const path = first?.path.join('.') ?? 'query';
  return { ok: false, message: `Invalid ${path}: ${first?.message ?? 'check the query string'}` };
}

/**
 * Maps the validated query onto a Prisma `where`. A post belongs to exactly one subsection, so
 * the subsection filter is a relation match on its slug; the search covers the title and the
 * summary, because the list shows both.
 */
export function buildPostListWhere(query: PostListQuery): Prisma.PostWhereInput {
  const where: Prisma.PostWhereInput = {};

  if (query.status === 'published') where.published = true;
  if (query.status === 'draft') where.published = false;

  const search = query.search?.trim();
  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ];
  }

  if (query.subsection) where.subsection = { slug: query.subsection };

  return where;
}

/**
 * Every order ends on `id` so two rows sharing a timestamp (the seeded posts all carry the same
 * `updatedAt` expression) cannot swap between page 1 and page 2 and be shown twice or dropped.
 */
export function buildPostListOrderBy(query: PostListQuery): Prisma.PostOrderByWithRelationInput[] {
  const tieBreak: Prisma.PostOrderByWithRelationInput = { id: 'asc' };
  if (query.sort === 'created') return [{ createdAt: 'desc' }, tieBreak];
  if (query.sort === 'title') return [{ title: 'asc' }, tieBreak];
  return [{ updatedAt: 'desc' }, tieBreak];
}

/** What the admin client is allowed to ask the list endpoint for. */
export interface PostListRequest {
  search?: string;
  status?: PostListQuery['status'];
  subsection?: string;
  sort?: PostListQuery['sort'];
  page?: number;
  limit?: number;
}

/**
 * The client half of the same contract: it drops empty and untouched filters instead of sending
 * `?search=&status=all`, so the URL of an unfiltered list stays readable and shareable.
 */
export function buildPostListSearchParams(filters: PostListRequest): URLSearchParams {
  const params = new URLSearchParams();
  const search = filters.search?.trim();
  if (search) params.set('search', search);
  if (filters.subsection) params.set('subsection', filters.subsection);
  if (filters.status && filters.status !== 'all') params.set('status', filters.status);
  if (filters.sort && filters.sort !== 'updated') params.set('sort', filters.sort);
  if (filters.page && filters.page > 1) params.set('page', String(filters.page));
  if (filters.limit) params.set('limit', String(filters.limit));
  return params;
}

/**
 * Whether anything currently narrows the list. Drives the "Clear filters" control on
 * `AdminFilterBar`, which must not appear on an unfiltered list (an inactive control that looks
 * clickable is the mistake the baseline made with its always-present subsection select).
 * `sort` is deliberately excluded: it reorders the same rows, it does not narrow them.
 */
export function isPostFilterActive(filters: PostListRequest): boolean {
  return Boolean(
    filters.search?.trim() ||
      filters.subsection ||
      (filters.status && filters.status !== 'all'),
  );
}

/** A page in the footer, or the ellipsis standing in for the pages not shown. */
export type PostListPageItem = number | 'gap';

/**
 * Page buttons for the list footer: first page, last page, the current page and its neighbours,
 * with a gap where pages are skipped. The baseline had no pagination at all, so a real site with
 * hundreds of posts rendered them all on one screen.
 */
export function buildPostListPageItems(page: number, totalPages: number): PostListPageItem[] {
  if (totalPages <= 1) return totalPages === 1 ? [1] : [];
  const wanted = new Set<number>([1, totalPages, page, page - 1, page + 1]);
  const pages = [...wanted].filter((n) => n >= 1 && n <= totalPages).sort((a, b) => a - b);

  const items: PostListPageItem[] = [];
  pages.forEach((n, index) => {
    if (index > 0 && n - pages[index - 1] > 1) items.push('gap');
    items.push(n);
  });
  return items;
}

/** Page metadata for the list footer. An empty result is still one (empty) page. */
export function buildPostListPageInfo(total: number, page: number, limit: number) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return {
    page: Math.min(page, totalPages),
    pageSize: limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
}
