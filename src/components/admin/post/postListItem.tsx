'use client';

import Link from 'next/link';
import { ArrowUpRightIcon, TrashIcon } from '@phosphor-icons/react';
import type { PostListItem } from '@/src/types';
import { contentTypeFor } from '@/src/components/admin/contentTypes';
import { adminButtonClass, AdminButton } from '@/src/components/ui/admin-button';
import { StatusDot } from '@/src/components/ui/status-label';
import { formatRelativeTime, publicPostPath } from '@/src/components/admin/dashboard/recentEdits';
import { postEditPath } from '@/src/lib/postEditor';

interface PostListItemRowProps {
  post: PostListItem;
  /** "Now" in epoch ms, captured once by the screen. */
  now: number | null;
  busy?: boolean;
  onTogglePublish: (post: PostListItem) => void;
  onDelete: (post: PostListItem) => void;
}

/* One row of the posts list. The whole row opens the editor (the title link stretches over it);
   the row actions sit above that link and fade in on hover or focus, and stay visible on touch
   screens where there is no hover. Every action carries the post title for assistive tech. */
export function PostListItemRow({
  busy = false,
  now,
  post,
  onDelete,
  onTogglePublish,
}: PostListItemRowProps): React.ReactElement {
  const TypeIcon = contentTypeFor(post.subsection.displayStyle).icon;
  const hierarchy = [post.subsection.topCategory?.name, post.subsection.name].filter(Boolean).join(' / ');

  return (
    <li
      className="group relative flex items-center gap-[var(--admin-space-3)] border-b border-[color:var(--admin-border)] px-[var(--admin-space-2)] py-[var(--admin-space-3)] hover:bg-[color:var(--admin-hover)] focus-within:bg-[color:var(--admin-hover)]"
      data-published={post.published ? 'true' : 'false'}
      data-slot="post-row"
    >
      <StatusDot tone={post.published ? 'live' : 'draft'} />

      <div className="min-w-0 flex-1">
        <Link
          aria-label={`Edit ${post.title}`}
          className="block truncate text-[length:var(--admin-text-body)] font-medium text-[color:var(--admin-heading)] outline-none after:absolute after:inset-0 after:content-[''] focus-visible:after:outline focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-[color:var(--admin-heading)]"
          href={postEditPath(post.subsection.slug, post.slug)}
        >
          {post.title}
        </Link>
        <p className="mt-0.5 flex min-w-0 items-center gap-[6px] text-[length:var(--admin-text-micro)] text-[color:var(--admin-subtle)]">
          <TypeIcon aria-hidden="true" className="size-3.5 shrink-0" />
          <span className="truncate">
            {hierarchy}
            {post.tags.length > 0 && (
              <span className="font-[family-name:var(--admin-font-mono)]">
                {' · '}
                {post.tags
                  .slice(0, 3)
                  .map((tag) => `#${tag.name.toLowerCase()}`)
                  .join(' ')}
              </span>
            )}
          </span>
        </p>
      </div>

      {now !== null && (
        <span className="hidden shrink-0 text-[length:var(--admin-text-micro)] tabular-nums text-[color:var(--admin-subtle)] min-[700px]:block min-[850px]:group-hover:hidden min-[850px]:group-focus-within:hidden">
          {formatRelativeTime(post.updatedAt, now)}
        </span>
      )}

      <div className="relative z-10 flex shrink-0 items-center gap-[2px] min-[850px]:hidden min-[850px]:group-hover:flex min-[850px]:group-focus-within:flex">
        <AdminButton loading={busy} onClick={() => onTogglePublish(post)} size="sm" variant="ghost">
          {post.published ? 'Unpublish' : 'Publish'}
          <span className="sr-only"> {post.title}</span>
        </AdminButton>
        {post.published && (
          <Link
            aria-label={`View ${post.title} on the public site`}
            className={adminButtonClass({ className: 'max-[599px]:hidden', size: 'icon-sm', variant: 'ghost' })}
            href={publicPostPath(post.subsection.slug, post.slug)}
            rel="noopener noreferrer"
            target="_blank"
          >
            <ArrowUpRightIcon aria-hidden="true" className="size-4" />
          </Link>
        )}
        <AdminButton
          aria-label={`Delete ${post.title}`}
          className="hover:bg-[color:var(--admin-danger-bg)] hover:text-[color:var(--admin-danger)]"
          onClick={() => onDelete(post)}
          size="icon-sm"
          variant="ghost"
        >
          <TrashIcon aria-hidden="true" className="size-4" />
        </AdminButton>
      </div>
    </li>
  );
}
