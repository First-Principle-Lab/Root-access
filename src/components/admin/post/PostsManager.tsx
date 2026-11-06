'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { CaretLeftIcon, CaretRightIcon, MagnifyingGlassIcon, PlusIcon } from '@phosphor-icons/react';
import { adminApi, requestFailureMessage } from '@/src/lib/api';
import { setAdminQueryData, useAdminQuery } from '@/src/lib/adminQuery';
import { adminQueryKeys, invalidateAfter, loadPosts, loadSections, loadStats } from '@/src/lib/adminQueries';
import {
  buildPostListPageItems,
  buildPostListSearchParams,
  isPostFilterActive,
  type PostListRequest,
} from '@/src/lib/postFilters';
import type { PostListItem, PostListResponse } from '@/src/types';
import { AdminButton, adminButtonClass } from '@/src/components/ui/admin-button';
import { AdminInput, AdminSelect } from '@/src/components/ui/admin-field';
import { AdminEmptyState, AdminErrorState } from '@/src/components/ui/admin-state';
import { ConfirmDialog } from '@/src/components/ui/confirm-dialog';
import { Notice } from '@/src/components/ui/notice';
import { PageHeader } from '@/src/components/ui/page-header';
import { Skeleton } from '@/src/components/ui/skeleton';
import { NEW_POST_PATH } from '@/src/lib/postEditor';
import { cn } from '@/src/lib/cn';
import { PostListItemRow } from './postListItem';

/** What the filter row controls. `page` resets to 1 whenever anything else changes. */
interface PostFilterState {
  search: string;
  status: 'all' | 'published' | 'draft';
  subsection: string;
  sort: 'updated' | 'created' | 'title';
  page: number;
}

const EMPTY_POST_FILTERS: PostFilterState = {
  search: '',
  status: 'all',
  subsection: '',
  sort: 'updated',
  page: 1,
};

const PAGE_SIZE = 10;

const LIST_FAILURE =
  'The posts could not be loaded. Your search and filters are fine - the request to the server failed.';

/* The filters live in the address, so a reload or a shared link lands on the same list and the
   dashboard can link straight to the drafts. */
function filtersFromParams(params: URLSearchParams): PostFilterState {
  const status = params.get('status');
  const sort = params.get('sort');
  const page = Number(params.get('page'));
  return {
    search: params.get('search') ?? '',
    status: status === 'published' || status === 'draft' ? status : 'all',
    subsection: params.get('subsection') ?? '',
    sort: sort === 'created' || sort === 'title' ? sort : 'updated',
    page: Number.isInteger(page) && page > 1 ? page : 1,
  };
}

export function PostsManager() {
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<PostFilterState>(() => filtersFromParams(searchParams));
  /* The search box is typed into immediately but only reaches the request after a pause, so one
     keystroke does not mean one round trip. */
  const [searchDraft, setSearchDraft] = useState(filters.search);

  const request = useMemo<PostListRequest>(() => ({ ...filters, limit: PAGE_SIZE }), [filters]);
  const listKey = adminQueryKeys.posts(request);
  const list = useAdminQuery(listKey, () => loadPosts(request));
  const sectionsQuery = useAdminQuery(adminQueryKeys.sections, loadSections);
  const stats = useAdminQuery(adminQueryKeys.stats, loadStats);
  const sections = sectionsQuery.data ?? [];

  /* While a new page or filter loads, keep the last list on screen (dimmed) instead of swapping
     it for a spinner, so the page does not jump on every click. */
  const [shown, setShown] = useState<PostListResponse | undefined>(list.data);
  if (list.data && list.data !== shown) setShown(list.data);
  const listing = list.data ?? shown;
  const switching = !list.data && Boolean(shown);
  const [listedAt] = useState(() => Date.now());

  const [pendingDelete, setPendingDelete] = useState<PostListItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const query = buildPostListSearchParams({ ...filters, limit: undefined }).toString();
    const next = query ? `/admin/posts?${query}` : '/admin/posts';
    if (`${window.location.pathname}${window.location.search}` !== next) {
      window.history.replaceState(window.history.state, '', next);
    }
  }, [filters]);

  useEffect(() => {
    if (searchDraft === filters.search) return;
    const timer = setTimeout(() => setFilters((current) => ({ ...current, page: 1, search: searchDraft })), 250);
    return () => clearTimeout(timer);
  }, [searchDraft, filters.search]);

  const changeFilters = (patch: Partial<PostFilterState>) =>
    setFilters((current) => ({ ...current, page: 1, ...patch }));

  const clearFilters = () => {
    setSearchDraft('');
    setFilters((current) => ({ ...EMPTY_POST_FILTERS, sort: current.sort }));
  };

  const filtersActive = isPostFilterActive(filters);
  const total = listing?.total ?? 0;
  const pageItems = buildPostListPageItems(listing?.page ?? 1, listing?.totalPages ?? 1);

  const patchRow = (id: string, patch: Partial<PostListItem>) =>
    setAdminQueryData<PostListResponse>(listKey, (current) =>
      current && { ...current, posts: current.posts.map((row) => (row.id === id ? { ...row, ...patch } : row)) },
    );

  const handleTogglePublish = async (post: PostListItem) => {
    setActionError('');
    setNotice('');
    // Flip the row now; the server's answer follows a moment later.
    patchRow(post.id, { published: !post.published });
    try {
      await adminApi.togglePublish(post.subsection.slug, post.slug, !post.published);
      setNotice(post.published ? `“${post.title}” was unpublished.` : `“${post.title}” is live.`);
    } catch (err) {
      patchRow(post.id, { published: post.published });
      setActionError(
        `“${post.title}” is still ${post.published ? 'published' : 'a draft'}. ${requestFailureMessage(err, 'The request failed.')}`,
      );
    } finally {
      invalidateAfter.post();
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    const post = pendingDelete;
    setDeleting(true);
    setActionError('');
    try {
      await adminApi.deletePost(post.subsection.slug, post.slug);
      setAdminQueryData<PostListResponse>(listKey, (current) =>
        current && { ...current, total: current.total - 1, posts: current.posts.filter((row) => row.id !== post.id) },
      );
      setNotice(`“${post.title}” was deleted.`);
    } catch (err) {
      setActionError(`“${post.title}” was not deleted. ${requestFailureMessage(err, 'The request failed.')}`);
    } finally {
      setPendingDelete(null);
      setDeleting(false);
      invalidateAfter.post();
    }
  };

  const statusTabs: { value: PostFilterState['status']; label: string; count?: number }[] = [
    { value: 'all', label: 'All', count: stats.data?.totalPosts },
    { value: 'published', label: 'Published', count: stats.data?.published },
    { value: 'draft', label: 'Drafts', count: stats.data?.drafts },
  ];

  const listBody = () => {
    if (!listing && list.error !== undefined) {
      return (
        <AdminErrorState
          message={requestFailureMessage(list.error, LIST_FAILURE)}
          onRetry={() => void list.refresh()}
          title="Posts could not be loaded"
        />
      );
    }
    if (!listing) {
      return (
        <ul aria-busy="true" aria-label="Loading posts" className="border-t border-[color:var(--admin-border)]">
          {Array.from({ length: 8 }, (_, index) => (
            <li className="flex items-center gap-[var(--admin-space-3)] border-b border-[color:var(--admin-border)] px-[var(--admin-space-2)] py-[14px]" key={index}>
              <Skeleton className="size-2 rounded-full" />
              <Skeleton className="h-4 max-w-[340px] flex-1" />
              <Skeleton className="ml-auto h-3 w-24" />
            </li>
          ))}
        </ul>
      );
    }
    if (listing.posts.length === 0) {
      return filtersActive ? (
        <AdminEmptyState
          action={
            <AdminButton onClick={clearFilters} size="sm" variant="secondary">
              Clear filters
            </AdminButton>
          }
          description="Try a different search, or clear the filters to see every post."
          icon={MagnifyingGlassIcon}
          title="No posts match"
        />
      ) : (
        <AdminEmptyState
          action={
            <Link className={adminButtonClass({ size: 'sm', variant: 'primary' })} href={NEW_POST_PATH}>
              <PlusIcon aria-hidden="true" className="size-4" />
              New post
            </Link>
          }
          description="Write your first post. It stays a draft until you publish it."
          title="No posts yet"
        />
      );
    }

    return (
      <ul
        aria-busy={switching || undefined}
        className={cn(
          'border-t border-[color:var(--admin-border)] transition-opacity duration-[var(--admin-motion-base)]',
          switching && 'opacity-50',
        )}
        data-slot="post-list"
      >
        {listing.posts.map((post) => (
          <PostListItemRow
            key={post.id}
            now={listedAt}
            onDelete={() => {
              setActionError('');
              setNotice('');
              setPendingDelete(post);
            }}
            onTogglePublish={() => void handleTogglePublish(post)}
            post={post}
          />
        ))}
      </ul>
    );
  };

  return (
    <div>
      <PageHeader
        actions={
          <Link className={adminButtonClass({ className: 'max-[849px]:hidden', variant: 'primary', size: 'sm' })} href={NEW_POST_PATH}>
            <PlusIcon aria-hidden="true" className="size-4" weight="bold" />
            New post
          </Link>
        }
        title="Posts"
      />

      {actionError && (
        <Notice assertive className="mb-[var(--admin-space-4)]" onDismiss={() => setActionError('')} tone="error">
          {actionError}
        </Notice>
      )}
      {notice && (
        <Notice className="mb-[var(--admin-space-4)]" onDismiss={() => setNotice('')} tone="success">
          {notice}
        </Notice>
      )}
      {sectionsQuery.error !== undefined && !sectionsQuery.data && (
        <Notice className="mb-[var(--admin-space-4)]" tone="warning">
          Subsections could not be listed, so the subsection filter is empty.
        </Notice>
      )}

      <div className="mb-[var(--admin-space-3)] flex flex-wrap items-center gap-x-[var(--admin-space-4)] gap-y-[var(--admin-space-3)]" role="search">
        <div aria-label="Status" className="flex items-center gap-px rounded-[var(--admin-radius-control)] bg-[color:var(--admin-surface-2)] p-[3px]" role="radiogroup">
          {statusTabs.map((tab) => {
            const active = filters.status === tab.value;
            return (
              <button
                aria-checked={active}
                className={cn(
                  'flex h-[28px] items-center gap-[6px] rounded-[4px] px-[var(--admin-space-3)] text-[length:var(--admin-text-meta)] max-[849px]:h-9',
                  active
                    ? 'bg-[color:var(--admin-bg)] font-medium text-[color:var(--admin-heading)] shadow-[0_0_0_1px_var(--admin-border)]'
                    : 'text-[color:var(--admin-muted)] hover:text-[color:var(--admin-heading)]',
                )}
                key={tab.value}
                onClick={() => changeFilters({ status: tab.value })}
                role="radio"
                type="button"
              >
                {tab.label}
                {tab.count !== undefined && (
                  <span className="font-[family-name:var(--admin-font-mono)] text-[length:var(--admin-text-micro)] tabular-nums text-[color:var(--admin-subtle)]">
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-[var(--admin-space-2)] max-[599px]:w-full">
          <label className="relative block max-[599px]:w-full">
            <span className="sr-only">Search</span>
            <MagnifyingGlassIcon
              aria-hidden="true"
              className="pointer-events-none absolute left-[10px] top-1/2 size-4 -translate-y-1/2 text-[color:var(--admin-subtle)]"
            />
            <AdminInput
              className="w-[240px] pl-[32px] text-[length:var(--admin-text-meta)] max-[599px]:w-full"
              onChange={(e) => setSearchDraft(e.target.value)}
              placeholder="Search posts"
              type="search"
              value={searchDraft}
            />
          </label>
          {/* Optgroups carry the section -> subsection hierarchy into the filter itself. */}
          <AdminSelect
            aria-label="Subsection"
            className="min-w-[160px]"
            compact
            onChange={(e) => changeFilters({ subsection: e.target.value })}
            value={filters.subsection}
          >
            <option value="">All subsections</option>
            {sections.map((section) => (
              <optgroup key={section.id} label={section.name}>
                {(section.subsections ?? []).map((subsection) => (
                  <option key={subsection.id} value={subsection.slug}>
                    {subsection.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </AdminSelect>
          <AdminSelect
            aria-label="Order"
            className="min-w-[150px]"
            compact
            onChange={(e) => changeFilters({ sort: e.target.value as PostFilterState['sort'] })}
            value={filters.sort}
          >
            <option value="updated">Recently edited</option>
            <option value="created">Newest first</option>
            <option value="title">Title A–Z</option>
          </AdminSelect>
        </div>
      </div>

      <div className="mb-[var(--admin-space-2)] flex h-5 items-center gap-[var(--admin-space-3)] text-[length:var(--admin-text-micro)] text-[color:var(--admin-subtle)]">
        {listing && (
          <span data-slot="admin-filter-result">
            {total} {total === 1 ? 'post' : 'posts'}
          </span>
        )}
        {filtersActive && (
          <button className="underline underline-offset-4 hover:text-[color:var(--admin-heading)]" onClick={clearFilters} type="button">
            Clear filters
          </button>
        )}
      </div>

      {listBody()}

      {listing && listing.totalPages > 1 && (
        <nav
          aria-label="Posts pages"
          className="mt-[var(--admin-space-5)] flex flex-wrap items-center gap-[var(--admin-space-1)]"
          data-slot="post-list-pagination"
        >
          <AdminButton
            aria-label="Previous"
            disabled={!listing.hasPreviousPage}
            onClick={() => setFilters((current) => ({ ...current, page: current.page - 1 }))}
            size="icon-sm"
            variant="ghost"
          >
            <CaretLeftIcon aria-hidden="true" className="size-4" />
          </AdminButton>
          {pageItems.map((item, index) =>
            item === 'gap' ? (
              <span aria-hidden="true" className="px-1 text-[length:var(--admin-text-meta)] text-[color:var(--admin-subtle)]" key={`gap-${index}`}>
                …
              </span>
            ) : (
              <AdminButton
                aria-current={item === listing.page ? 'page' : undefined}
                className="min-w-8 px-2 tabular-nums"
                key={item}
                onClick={() => setFilters((current) => ({ ...current, page: item }))}
                size="sm"
                variant={item === listing.page ? 'secondary' : 'ghost'}
              >
                {item}
              </AdminButton>
            ),
          )}
          <AdminButton
            aria-label="Next"
            disabled={!listing.hasNextPage}
            onClick={() => setFilters((current) => ({ ...current, page: current.page + 1 }))}
            size="icon-sm"
            variant="ghost"
          >
            <CaretRightIcon aria-hidden="true" className="size-4" />
          </AdminButton>
          <span className="ml-auto text-[length:var(--admin-text-micro)] tabular-nums text-[color:var(--admin-subtle)]">
            {(listing.page - 1) * PAGE_SIZE + 1}–{Math.min(listing.page * PAGE_SIZE, total)} of {total}
          </span>
        </nav>
      )}

      {pendingDelete && (
        <ConfirmDialog
          busy={deleting}
          description={`It lives in ${pendingDelete.subsection.name} and is ${
            pendingDelete.published ? 'live on the public site' : 'a draft'
          }. Deleting removes it permanently; there is no undo.`}
          itemName={pendingDelete.title}
          onCancel={() => setPendingDelete(null)}
          onConfirm={handleDelete}
          title="Delete post"
        />
      )}
    </div>
  );
}
