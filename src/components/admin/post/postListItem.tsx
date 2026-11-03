'use client';

import Link from 'next/link';
import { ArrowSquareOutIcon, TrashIcon } from '@phosphor-icons/react';
import type { PostListItem } from '@/src/types';
import { ContentTypeBadge } from '@/src/components/admin/contentTypeBadge';
import { adminButtonClass, AdminButton } from '@/src/components/ui/admin-button';
import { StatusLabel } from '@/src/components/ui/status-label';
import { formatRelativeTime, publicPostPath } from '@/src/components/admin/dashboard/recentEdits';

interface PostListItemRowProps {
  post: PostListItem;
  /** "Now" in epoch ms, captured once per list load by the screen. */
  now: number | null;
  busy?: boolean;
  onEdit: (post: PostListItem) => void;
  onTogglePublish: (post: PostListItem) => void;
  onDelete: (post: PostListItem) => void;
}

/* One row of the posts list (checkpoints 5 and 6 of docs/admin-redesign-plan.md). The baseline row
   was hand-painted with the old dark-only palette, its tag chips sat below the 12px type floor and
   its actions did not say which post they would change; it also only ever knew the subsection name,
   so the section above it was invisible. Everything is a token or a primitive now, the hierarchy is
   spelled out as "section / subsection", and every action carries the post title for assistive tech
   while staying short on screen. */
export function PostListItemRow({
  busy = false,
  now,
  post,
  onDelete,
  onEdit,
  onTogglePublish,
}: PostListItemRowProps): React.ReactElement {
  const hierarchy = [post.subsection.topCategory?.name, post.subsection.name].filter(Boolean).join(' / ');

  return (
    <li
      className="flex flex-wrap items-center gap-x-[var(--admin-space-4)] gap-y-[var(--admin-space-2)] border-t border-[color:var(--admin-border)] bg-[color:var(--admin-surface)] px-[var(--admin-space-4)] py-[var(--admin-space-3)] transition-colors first:border-t-0 hover:bg-[color:var(--admin-hover)] focus-within:bg-[color:var(--admin-hover)] sm:px-[var(--admin-space-5)]"
      data-slot="post-row"
      data-published={post.published ? 'true' : 'false'}
    >
      <div className="min-w-[220px] flex-1 basis-[320px]">
        <div className="flex flex-wrap items-center gap-x-[var(--admin-space-2)] gap-y-1">
          <span className="min-w-0 max-w-full truncate text-[length:var(--admin-text-body)] font-medium text-[color:var(--admin-heading)]">
            {post.title}
          </span>
          <StatusLabel tone={post.published ? 'live' : 'draft'}>
            {post.published ? 'Live' : 'Draft'}
          </StatusLabel>
          <ContentTypeBadge displayStyle={post.subsection.displayStyle} />
        </div>
        <p className="mt-0.5 truncate text-[length:var(--admin-text-micro)] text-[color:var(--admin-subtle)]">
          {hierarchy}
          {now !== null && <> · edited {formatRelativeTime(post.updatedAt, now)}</>}
          {post.subsection.displayStyle === 'PROJECT' && post.projectLink && (
            <>
              {' · '}
              <a
                className="text-[color:var(--admin-info)] underline underline-offset-4 transition-colors hover:text-[color:var(--admin-heading)]"
                href={post.projectLink}
                rel="noopener noreferrer"
                target="_blank"
              >
                project link
              </a>
            </>
          )}
        </p>
        {post.tags.length > 0 && (
          <ul className="mt-[var(--admin-space-2)] flex flex-wrap gap-[var(--admin-space-1)]">
            {post.tags.slice(0, 4).map((tag) => (
              <li key={tag.id}>
                <StatusLabel>{tag.name}</StatusLabel>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="ml-auto flex flex-wrap items-center justify-end gap-[var(--admin-space-1)]">
        {post.published && (
          <Link
            aria-label={`View ${post.title} on the public site`}
            className={adminButtonClass({
              className: 'hidden min-[600px]:inline-flex',
              size: 'icon-sm',
              variant: 'ghost',
            })}
            href={publicPostPath(post.subsection.slug, post.slug)}
            rel="noopener noreferrer"
            target="_blank"
          >
            <ArrowSquareOutIcon aria-hidden="true" className="size-4" />
          </Link>
        )}
        <AdminButton onClick={() => onEdit(post)} size="sm" variant="secondary">
          Edit
          <span className="sr-only"> {post.title}</span>
        </AdminButton>
        <AdminButton loading={busy} onClick={() => onTogglePublish(post)} size="sm" variant="ghost">
          {post.published ? 'Unpublish' : 'Publish'}
          <span className="sr-only"> {post.title}</span>
        </AdminButton>
        <AdminButton
          aria-label={`Delete ${post.title}`}
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
