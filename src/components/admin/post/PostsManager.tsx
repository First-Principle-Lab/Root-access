'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { MagnifyingGlassIcon, PlusIcon } from '@phosphor-icons/react';
import { adminApi, requestFailureMessage } from '@/src/lib/api';
import { buildPostListPageItems, isPostFilterActive, type PostListRequest } from '@/src/lib/postFilters';
import type { PostListItem, PostListResponse, TopCategory } from '@/src/types';
import { AdminButton, adminButtonClass } from '@/src/components/ui/admin-button';
import { AdminField, AdminInput, AdminSelect } from '@/src/components/ui/admin-field';
import { AdminFilterBar } from '@/src/components/ui/admin-filter-bar';
import { AdminEmptyState, AdminErrorState, AdminLoadingState } from '@/src/components/ui/admin-state';
import { ConfirmDialog } from '@/src/components/ui/confirm-dialog';
import { Notice } from '@/src/components/ui/notice';
import { PageHeader } from '@/src/components/ui/page-header';
import { NEW_POST_PATH } from '@/src/lib/postEditor';
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

/* Ten rows fits a 1440x900 screen without scrolling past the fold and makes the seeded 17 posts
   two pages, so pagination is exercised by the real data rather than by a fixture. */
const PAGE_SIZE = 10;

const LIST_FAILURE =
  'The posts could not be loaded. Your search and filters are fine - the request to the server failed.';

/* Posts screen (checkpoints 5 and 6 of docs/admin-redesign-plan.md).
   The baseline fetched the sections list and then one request per subsection
   (`allSubsections.map(sub => adminApi.getPosts(sub.slug).catch(() => ({ posts: [] })))`), so nine
   round trips built one list and any failed request looked like an empty subsection. It is now one
   authenticated list request (src/app/api/admin/posts/route.ts) whose filtering, ordering and
   paging happen on the server; the sections request that remains only fills the subsection filter
   and the create form. A failed list is an error state with a retry, never an empty list. */
export function PostsManager() {
  const [sections, setSections] = useState<TopCategory[]>([]);
  const [filters, setFilters] = useState<PostFilterState>(EMPTY_POST_FILTERS);
  /* The search box is typed into immediately but only reaches the request after a pause, so one
     keystroke does not mean one round trip. */
  const [searchDraft, setSearchDraft] = useState('');

  const [posts, setPosts] = useState<PostListItem[]>([]);
  const [pageInfo, setPageInfo] = useState({ page: 1, totalPages: 1, total: 0, hasNextPage: false, hasPreviousPage: false });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reloadToken, setReloadToken] = useState(0);
  /* "Now" for the rows' relative dates, captured once per list load: `Date.now()` during render is
     impure (react-hooks/purity) and per-row would give every row a different timestamp. */
  const [listedAt, setListedAt] = useState<number | null>(null);

  const [pendingDelete, setPendingDelete] = useState<PostListItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [busySlug, setBusySlug] = useState('');
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = (await adminApi.getSections()) as { sections: TopCategory[] };
        if (active) setSections(res.sections);
      } catch (err) {
        /* The list itself still loads; only the subsection filter is degraded, and saying so is
           better than an empty select that implies the site has no subsections. */
        if (active) {
          setSections([]);
          setActionError(
            `Subsections could not be listed, so the subsection filter is empty. ${requestFailureMessage(err, 'The request failed.')}`,
          );
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  /* The sections tree only fills the subsection filter below (grouped by section); the posts
     themselves come from the single list endpoint. */

  // Only the committed filters decide the request, and the object identity changes with them.
  const request = useMemo<PostListRequest>(
    () => ({ ...filters, limit: PAGE_SIZE }),
    [filters],
  );

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError('');
    (async () => {
      try {
        const res = (await adminApi.listPosts(request)) as PostListResponse;
        if (!active) return;
        setPosts(res.posts);
        setListedAt(Date.now());
        setPageInfo({
          page: res.page,
          totalPages: res.totalPages,
          total: res.total,
          hasNextPage: res.hasNextPage,
          hasPreviousPage: res.hasPreviousPage,
        });
      } catch (err) {
        if (!active) return;
        setPosts([]);
        setLoadError(requestFailureMessage(err, LIST_FAILURE));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [request, reloadToken]);

  useEffect(() => {
    if (searchDraft === filters.search) return;
    const timer = setTimeout(() => setFilters((current) => ({ ...current, page: 1, search: searchDraft })), 300);
    return () => clearTimeout(timer);
  }, [searchDraft, filters.search]);

  const changeFilters = (patch: Partial<PostFilterState>) =>
    setFilters((current) => ({ ...current, page: 1, ...patch }));

  const filtersActive = isPostFilterActive(filters);
  const pageItems = buildPostListPageItems(pageInfo.page, pageInfo.totalPages);

  const reloadList = () => setReloadToken((token) => token + 1);

  const handleTogglePublish = async (post: PostListItem) => {
    setActionError('');
    setNotice('');
    setBusySlug(post.slug);
    try {
      await adminApi.togglePublish(post.subsection.slug, post.slug, !post.published);
      setNotice(
        post.published
          ? `“${post.title}” is no longer on the public site.`
          : `“${post.title}” is live on the public site.`,
      );
      reloadList();
    } catch (err) {
      // Reported where it happened instead of in a modal that blocks the list (the
      // baseline used window.alert, PostsManager.tsx:155 in the pre-change tree).
      setActionError(
        `“${post.title}” is still ${post.published ? 'published' : 'a draft'}. ${requestFailureMessage(err, 'The request failed.')}`,
      );
    } finally {
      setBusySlug('');
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    setActionError('');
    try {
      await adminApi.deletePost(pendingDelete.subsection.slug, pendingDelete.slug);
      const title = pendingDelete.title;
      setPendingDelete(null);
      setNotice(`“${title}” was deleted.`);
      reloadList();
    } catch (err) {
      setActionError(
        `“${pendingDelete.title}” was not deleted. ${requestFailureMessage(err, 'The request failed.')}`,
      );
      setPendingDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  const listBody = () => {
    if (loading) return <AdminLoadingState label="Loading posts" />;
    if (loadError) {
      return (
        <AdminErrorState
          message={loadError}
          onRetry={reloadList}
          retryLabel="Try again"
          title="Posts could not be loaded"
        />
      );
    }
    if (posts.length === 0) {
      return filtersActive ? (
        <AdminEmptyState
          description="Nothing matches the current search and filters. Clear them to see every post again."
          icon={MagnifyingGlassIcon}
          title="No posts match these filters"
          action={
            <AdminButton
              onClick={() => {
                setSearchDraft('');
                setFilters(EMPTY_POST_FILTERS);
              }}
              size="sm"
              variant="secondary"
            >
              Clear filters
            </AdminButton>
          }
        />
      ) : (
        <AdminEmptyState
          description="Nothing is published yet. The first post can be written here."
          title="No posts yet"
          action={
            <Link className={adminButtonClass({ size: 'sm', variant: 'primary' })} href={NEW_POST_PATH}>
              <PlusIcon aria-hidden="true" className="size-4" />
              New post
            </Link>
          }
        />
      );
    }

    return (
      <ul
        className="flex flex-col overflow-hidden rounded-[var(--admin-radius-panel)] border border-[color:var(--admin-border)] bg-[color:var(--admin-surface)]"
        data-slot="post-list"
      >
        {posts.map((post) => (
          <PostListItemRow
            busy={busySlug === post.slug}
            key={post.id}
            onDelete={() => {
              setActionError('');
              setNotice('');
              setPendingDelete(post);
            }}
            onTogglePublish={() => void handleTogglePublish(post)}
            now={listedAt}
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
          /* Create is the editor page too, so there is one writing surface instead of the
             baseline's inline form plus modal. */
          <Link className={adminButtonClass({ variant: 'primary' })} href={NEW_POST_PATH}>
            <PlusIcon aria-hidden="true" className="size-4" />
            New post
          </Link>
        }
        description="Every post across the site, newest edited first. Nothing here is visible to readers until you publish it."
        title="Posts"
      />

      {actionError && (
        <Notice
          assertive
          className="mb-[var(--admin-space-4)]"
          onDismiss={() => setActionError('')}
          tone="error"
        >
          {actionError}
        </Notice>
      )}

      {notice && (
        <Notice className="mb-[var(--admin-space-4)]" onDismiss={() => setNotice('')} tone="success">
          {notice}
        </Notice>
      )}

      {/* Subsection filter */}
      <AdminFilterBar
        onClear={
          filtersActive
            ? () => {
                setSearchDraft('');
                setFilters(EMPTY_POST_FILTERS);
              }
            : undefined
        }
        result={`${pageInfo.total} ${pageInfo.total === 1 ? 'post' : 'posts'}`}
      >
        <AdminField className="min-w-[200px] max-w-[280px] flex-1" id="post-search" label="Search">
          <AdminInput
            onChange={(e) => setSearchDraft(e.target.value)}
            placeholder="Title or summary"
            type="search"
            value={searchDraft}
          />
        </AdminField>
        <AdminField className="min-w-[150px]" id="post-filter-status" label="Status">
          <AdminSelect
            compact
            onChange={(e) => changeFilters({ status: e.target.value as PostFilterState['status'] })}
            value={filters.status}
          >
            <option value="all">All statuses</option>
            <option value="published">Published</option>
            <option value="draft">Drafts</option>
          </AdminSelect>
        </AdminField>
        {/* Optgroups carry the section -> subsection hierarchy into the filter itself. */}
        <AdminField className="min-w-[190px]" id="post-filter-subsection" label="Subsection">
          <AdminSelect
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
        </AdminField>
        <AdminField className="min-w-[170px]" id="post-sort" label="Order">
          <AdminSelect
            compact
            onChange={(e) => changeFilters({ sort: e.target.value as PostFilterState['sort'] })}
            value={filters.sort}
          >
            <option value="updated">Recently edited</option>
            <option value="created">Newest first</option>
            <option value="title">Title A–Z</option>
          </AdminSelect>
        </AdminField>
      </AdminFilterBar>

      {/* Posts List */}
      {listBody()}

      {/* Page buttons, only when there is more than one page of results. */}
      {!loading && !loadError && pageInfo.totalPages > 1 && (
        <nav
          aria-label="Posts pages"
          className="mt-[var(--admin-space-5)] flex flex-wrap items-center gap-[var(--admin-space-2)]"
          data-slot="post-list-pagination"
        >
          <AdminButton
            disabled={!pageInfo.hasPreviousPage}
            onClick={() => setFilters((current) => ({ ...current, page: current.page - 1 }))}
            size="sm"
            variant="secondary"
          >
            Previous
          </AdminButton>
          {pageItems.map((item, index) =>
            item === 'gap' ? (
              <span
                aria-hidden="true"
                className="px-1 text-[length:var(--admin-text-meta)] text-[color:var(--admin-subtle)]"
                key={`gap-${index}`}
              >
                …
              </span>
            ) : (
              <AdminButton
                aria-current={item === pageInfo.page ? 'page' : undefined}
                key={item}
                onClick={() => setFilters((current) => ({ ...current, page: item }))}
                size="sm"
                variant={item === pageInfo.page ? 'primary' : 'secondary'}
              >
                {item}
              </AdminButton>
            ),
          )}
          <AdminButton
            disabled={!pageInfo.hasNextPage}
            onClick={() => setFilters((current) => ({ ...current, page: current.page + 1 }))}
            size="sm"
            variant="secondary"
          >
            Next
          </AdminButton>
          <span className="ml-auto text-[length:var(--admin-text-micro)] text-[color:var(--admin-subtle)]">
            Page {pageInfo.page} of {pageInfo.totalPages}
          </span>
        </nav>
      )}

      {/* Deleting a post is unrecoverable (there is no trash), so the row control opens the
          shared confirmation dialog instead of window.confirm, and it says where the post
          lives so the person can tell two same-titled posts apart. */}
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
