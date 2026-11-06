'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowUpRightIcon } from '@phosphor-icons/react';
import { requestFailureMessage } from '@/src/lib/api';
import { useAdminQuery } from '@/src/lib/adminQuery';
import {
  DASHBOARD_RECENT_REQUEST,
  adminQueryKeys,
  loadPosts,
  loadStats,
} from '@/src/lib/adminQueries';
import { postEditPath } from '@/src/lib/postEditor';
import type { PostListItem } from '@/src/types';
import type { PostListRequest } from '@/src/lib/postFilters';
import { adminButtonClass } from '@/src/components/ui/admin-button';
import { AdminErrorState } from '@/src/components/ui/admin-state';
import { PageHeader } from '@/src/components/ui/page-header';
import { AdminSection } from '@/src/components/ui/admin-section';
import { Skeleton } from '@/src/components/ui/skeleton';
import { StatusDot } from '@/src/components/ui/status-label';
import { buildOverviewRows } from './overviewRows';
import { formatRelativeTime, publicPostPath } from './recentEdits';

const DRAFTS_REQUEST: PostListRequest = { status: 'draft', limit: 5 };

export function AdminDashboard() {
  const stats = useAdminQuery(adminQueryKeys.stats, loadStats);
  const recent = useAdminQuery(adminQueryKeys.posts(DASHBOARD_RECENT_REQUEST), () => loadPosts(DASHBOARD_RECENT_REQUEST));
  const drafts = useAdminQuery(adminQueryKeys.posts(DRAFTS_REQUEST), () => loadPosts(DRAFTS_REQUEST));
  /* "Now" for the relative dates, taken once when the screen mounts; Date.now() during render
     is impure. */
  const [now] = useState(() => Date.now());

  const viewSite = (
    <Link className={adminButtonClass({ variant: 'secondary', size: 'sm' })} href="/" rel="noopener" target="_blank">
      View site
      <ArrowUpRightIcon aria-hidden="true" className="size-3.5" />
    </Link>
  );

  const failed = stats.error !== undefined && stats.data === undefined;

  return (
    <>
      <PageHeader actions={viewSite} title="Dashboard" />

      {failed ? (
        <AdminErrorState
          message={requestFailureMessage(stats.error, 'The dashboard could not be reached. Check your connection and try again.')}
          onRetry={() => {
            void stats.refresh();
            void recent.refresh();
            void drafts.refresh();
          }}
          title="Counts could not be loaded"
        />
      ) : (
        <>
          <ul aria-label="Content counts" className="grid grid-cols-2 overflow-hidden rounded-[var(--admin-radius-panel)] border border-[color:var(--admin-border)] min-[600px]:grid-cols-3 min-[1000px]:grid-cols-5">
            {stats.data
              ? buildOverviewRows(stats.data).map((row) => (
                  <li className="-mb-px -mr-px border-b border-r border-[color:var(--admin-border)]" key={row.key}>
                  <Link
                    className="flex h-full flex-col gap-[var(--admin-space-1)] p-[var(--admin-space-4)] hover:bg-[color:var(--admin-hover)]"
                    href={row.href}
                  >
                    <span className="text-[length:var(--admin-text-micro)] font-medium uppercase tracking-[var(--admin-tracking-eyebrow)] text-[color:var(--admin-subtle)]">
                      {row.label}
                    </span>
                    <span className="block text-[28px] font-semibold leading-none tracking-[var(--admin-tracking-title)] tabular-nums text-[color:var(--admin-heading)]">
                      {row.value}
                    </span>
                    <span className="truncate text-[length:var(--admin-text-micro)] text-[color:var(--admin-muted)]">{row.hint}</span>
                  </Link>
                  </li>
                ))
              : Array.from({ length: 5 }, (_, index) => (
                  <li
                    className="-mb-px -mr-px flex flex-col gap-[var(--admin-space-2)] border-b border-r border-[color:var(--admin-border)] p-[var(--admin-space-4)]"
                    key={index}
                  >
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-7 w-10" />
                    <Skeleton className="h-3 w-20" />
                  </li>
                ))}
          </ul>

          <div className="mt-[var(--admin-space-8)] grid gap-[var(--admin-space-8)] min-[1000px]:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <AdminSection
              action={
                <Link className="text-[length:var(--admin-text-meta)] text-[color:var(--admin-muted)] hover:text-[color:var(--admin-heading)]" href="/admin/posts">
                  All posts
                </Link>
              }
              title="Recently edited"
            >
              <PostRows
                empty={
                  <>
                    Nothing has been saved yet.{' '}
                    <Link className="text-[color:var(--admin-heading)] underline underline-offset-4" href="/admin/posts/new">
                      Write a post
                    </Link>
                  </>
                }
                now={now}
                posts={recent.data?.posts}
              />
            </AdminSection>

            <AdminSection
              action={
                drafts.data && drafts.data.total > 0 ? (
                  <Link
                    className="text-[length:var(--admin-text-meta)] text-[color:var(--admin-muted)] hover:text-[color:var(--admin-heading)]"
                    href="/admin/posts?status=draft"
                  >
                    {drafts.data.total} in total
                  </Link>
                ) : undefined
              }
              title="Drafts"
            >
              <PostRows compact empty="No drafts. Everything you have written is live." now={now} posts={drafts.data?.posts} />
            </AdminSection>
          </div>
        </>
      )}
    </>
  );
}

function PostRows({
  posts,
  now,
  empty,
  compact = false,
}: {
  posts: PostListItem[] | undefined;
  now: number;
  empty: React.ReactNode;
  compact?: boolean;
}) {
  if (!posts) {
    return (
      <ul aria-busy="true" aria-label="Loading posts">
        {Array.from({ length: compact ? 3 : 5 }, (_, index) => (
          <li className="flex items-center gap-[var(--admin-space-3)] border-t border-[color:var(--admin-border)] py-[var(--admin-space-3)] first:border-t-0" key={index}>
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-3 w-16" />
          </li>
        ))}
      </ul>
    );
  }

  if (posts.length === 0) {
    return <p className="py-[var(--admin-space-3)] text-[length:var(--admin-text-meta)] text-[color:var(--admin-muted)]">{empty}</p>;
  }

  return (
    <ul>
      {posts.map((post) => (
        <li className="group relative flex items-center gap-[var(--admin-space-3)] border-t border-[color:var(--admin-border)] py-[var(--admin-space-3)] first:border-t-0" key={post.id}>
          {!compact && <StatusDot tone={post.published ? 'live' : 'draft'} />}
          <div className="min-w-0 flex-1">
            <Link
              aria-label={`Edit ${post.title}`}
              className="block truncate text-[length:var(--admin-text-body)] font-medium text-[color:var(--admin-heading)] after:absolute after:inset-0 after:content-['']"
              href={postEditPath(post.subsection.slug, post.slug)}
            >
              {post.title}
            </Link>
            <p className="truncate text-[length:var(--admin-text-micro)] text-[color:var(--admin-subtle)]">
              {post.subsection.name} · {formatRelativeTime(post.updatedAt, now)}
            </p>
          </div>
          {post.published && (
            <Link
              aria-label={`View ${post.title} on the public site`}
              className={adminButtonClass({
                className: 'relative z-10 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 max-[849px]:opacity-100',
                size: 'icon-sm',
                variant: 'ghost',
              })}
              href={publicPostPath(post.subsection.slug, post.slug)}
              rel="noopener"
              target="_blank"
            >
              <ArrowUpRightIcon aria-hidden="true" className="size-4" />
            </Link>
          )}
        </li>
      ))}
    </ul>
  );
}
