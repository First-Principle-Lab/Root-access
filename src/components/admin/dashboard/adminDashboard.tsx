'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowSquareOutIcon, CaretRightIcon, PencilSimpleIcon } from '@phosphor-icons/react';
import { adminApi, requestFailureMessage } from '@/src/lib/api';
import { contentTypeFor } from '@/src/components/admin/contentTypes';
import type { DashboardStats, PostListItem } from '@/src/types';
import { adminButtonClass } from '@/src/components/ui/admin-button';
import { AdminErrorState, AdminLoadingState } from '@/src/components/ui/admin-state';
import { FormSection } from '@/src/components/ui/form-section';
import { Notice } from '@/src/components/ui/notice';
import { PageHeader } from '@/src/components/ui/page-header';
import { StatusLabel } from '@/src/components/ui/status-label';
import { buildOverviewRows } from './overviewRows';
import { formatRelativeTime, publicPostPath } from './recentEdits';

/* Dashboard (checkpoint 5 of docs/admin-redesign-plan.md §3.1).
   What this replaced: four large statistic cards whose "Posts" number counted published rows only
   (src/app/api/admin/stats/route.ts before this change), a green "Live" button that navigated to
   the site and read like a publish switch, and a "Quick Actions" panel of four buttons that all
   did nothing but navigate to the screens the cards already linked to. What it is now: one list of
   counts the API can actually make, a draft notice for the work that is not live yet, and the last
   few things edited, each with its state and its destination. Both requests are single calls, and
   a failed one is reported instead of rendering zeros (the baseline showed `0` for everything). */

export function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentPosts, setRecentPosts] = useState<PostListItem[]>([]);
  const [editedAt, setEditedAt] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const fetchDashboard = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [statsResponse, recentResponse] = await Promise.all([
        adminApi.getStats() as Promise<DashboardStats>,
        adminApi.listPosts({ limit: 5 }) as Promise<{ posts: PostListItem[] }>,
      ]);
      setStats(statsResponse);
      setRecentPosts(recentResponse.posts);
      /* Captured here rather than during render: the relative labels need "now", and calling
         Date.now() inside the component is both impure and the exact lint error the baseline had. */
      setEditedAt(Date.now());
    } catch (err) {
      setStats(null);
      setRecentPosts([]);
      setLoadError(
        requestFailureMessage(err, 'The dashboard could not be reached. Check your connection and try again.'),
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchDashboard();
  }, []);

  const viewSite = (
    <Link
      className={adminButtonClass({ variant: 'link' })}
      href="/"
      rel="noopener"
      target="_blank"
    >
      <ArrowSquareOutIcon aria-hidden="true" className="size-4" />
      View site
    </Link>
  );

  if (loading) {
    return <AdminLoadingState label="Loading dashboard" />;
  }

  if (loadError || !stats) {
    return (
      <>
        <PageHeader
          actions={viewSite}
          description="What is live, what is waiting to be published, and what you last edited."
          title="Dashboard"
        />
        <AdminErrorState
          message={loadError || 'The dashboard returned no data.'}
          onRetry={fetchDashboard}
          title="Counts could not be loaded"
        />
      </>
    );
  }

  const rows = buildOverviewRows(stats);
  const draftsToReview = stats.drafts > 0;

  return (
    <>
      <PageHeader
        actions={viewSite}
        description="What is live, what is waiting to be published, and what you last edited."
        title="Dashboard"
      />

      {draftsToReview && (
        <Notice
          action={
            <Link className={adminButtonClass({ size: 'sm', variant: 'secondary' })} href="/admin/posts">
              Review drafts
            </Link>
          }
          className="mb-[var(--admin-space-5)]"
          tone="warning"
        >
          {stats.drafts} {stats.drafts === 1 ? 'draft is' : 'drafts are'} not on the public site yet.
        </Notice>
      )}

      <div className="flex flex-col gap-[var(--admin-space-5)]">
        <FormSection
          description="Every number is counted from the database when this page loads."
          title="Content"
        >
          <ul className="-my-[var(--admin-space-2)]">
            {rows.map((row) => (
              <li
                className="border-t border-[color:var(--admin-border)] first:border-t-0"
                key={row.key}
              >
                <Link
                  className="flex items-center gap-[var(--admin-space-3)] py-[var(--admin-space-2)] transition-colors hover:text-[color:var(--admin-heading)] focus-visible:text-[color:var(--admin-heading)]"
                  href={row.href}
                >
                  <span className="min-w-0 flex-1 truncate text-[length:var(--admin-text-body)] text-[color:var(--admin-heading)]">
                    {row.label}
                  </span>
                  <span className="hidden text-[length:var(--admin-text-micro)] text-[color:var(--admin-subtle)] sm:inline">
                    {row.hint}
                  </span>
                  <span className="text-[length:var(--admin-text-panel-title)] font-semibold tabular-nums text-[color:var(--admin-heading)]">
                    {row.value}
                  </span>
                  <CaretRightIcon aria-hidden="true" className="size-4 text-[color:var(--admin-subtle)]" />
                </Link>
              </li>
            ))}
          </ul>
        </FormSection>

        <FormSection
          actions={
            <Link className={adminButtonClass({ size: 'sm', variant: 'ghost' })} href="/admin/posts">
              <PencilSimpleIcon aria-hidden="true" className="size-4" />
              All posts
            </Link>
          }
          className="max-w-[var(--admin-shell-max)]"
          description="The five most recently saved posts, whichever subsection they live in."
          title="Recently edited"
        >
          {recentPosts.length === 0 ? (
            <p className="text-[length:var(--admin-text-meta)] text-[color:var(--admin-muted)]">
              Nothing has been saved yet.{' '}
              <Link className="underline underline-offset-4" href="/admin/posts">
                Write a post
              </Link>
              .
            </p>
          ) : (
            <ul className="-my-[var(--admin-space-2)]">
              {recentPosts.map((post) => {
                const TypeIcon = contentTypeFor(post.subsection.displayStyle).icon;
                return (
                  <li
                    className="flex flex-wrap items-center gap-x-[var(--admin-space-3)] gap-y-1 border-t border-[color:var(--admin-border)] py-[var(--admin-space-2)] first:border-t-0"
                    key={post.id}
                  >
                    <TypeIcon aria-hidden="true" className="size-4 shrink-0 text-[color:var(--admin-subtle)]" />
                    <span className="min-w-0 flex-1 truncate text-[length:var(--admin-text-body)] text-[color:var(--admin-heading)]">
                      {post.title}
                    </span>
                    <StatusLabel tone={post.published ? 'live' : 'draft'}>
                      {post.published ? 'Live' : 'Draft'}
                    </StatusLabel>
                    {editedAt !== null && (
                      <span className="text-[length:var(--admin-text-micro)] text-[color:var(--admin-subtle)]">
                        {post.subsection.name} · edited {formatRelativeTime(post.updatedAt, editedAt)}
                      </span>
                    )}
                    <span className="ml-auto flex shrink-0 items-center gap-[var(--admin-space-1)]">
                      <Link
                        aria-label={`Edit ${post.title}`}
                        className={adminButtonClass({ size: 'sm', variant: 'ghost' })}
                        href="/admin/posts"
                      >
                        Edit
                      </Link>
                      {post.published && (
                        <Link
                          aria-label={`View ${post.title} on the public site`}
                          className={adminButtonClass({ size: 'icon-sm', variant: 'ghost' })}
                          href={publicPostPath(post.subsection.slug, post.slug)}
                          rel="noopener"
                          target="_blank"
                        >
                          <ArrowSquareOutIcon aria-hidden="true" className="size-4" />
                        </Link>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </FormSection>
      </div>
    </>
  );
}
