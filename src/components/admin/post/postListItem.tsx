import { ArrowSquareOutIcon } from '@phosphor-icons/react';
import { Post } from '@/src/types';
import { contentTypeFor } from '@/src/components/admin/contentTypes';
import { StatusLabel } from '@/src/components/ui/status-label';

interface PostListItemProps {
  post: Post;
  onTogglePublish: (post: Post) => void;
  onDelete: (post: Post) => void;
  onEdit: (post: Post) => void;
}

export function PostListItem({ post, onTogglePublish, onDelete, onEdit }: PostListItemProps) {
  return (
    <div className="bg-[#101010] p-4 sm:p-5 rounded-xl border border-[#1a1a1a] hover:border-[#2a2a2a] transition">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <h3 className="text-[15px] text-white font-medium truncate">{post.title}</h3>
            <ContentTypeBadge displayStyle={post.subsection.displayStyle} />
            <StatusLabel tone={post.published ? 'live' : 'draft'}>{post.published ? 'Published' : 'Draft'}</StatusLabel>
          </div>
          <div className="text-[13px] text-[#707070] mb-1">
            {post.subsection.name} • {post.views} views
            {post.subsection.displayStyle === 'PROJECT' && post.projectLink && (
              <span className="ml-2">
                •{' '}
                <a
                  className="inline-flex items-center gap-1 text-[color:var(--admin-info)] underline underline-offset-4 hover:text-[color:var(--admin-heading)]"
                  href={post.projectLink}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  View project
                  <ArrowSquareOutIcon aria-hidden="true" className="size-3.5" />
                </a>
              </span>
            )}
          </div>
          {post.tags && post.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {post.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag.id}
                  className="px-2 py-0.5 bg-[#1a1a1a] text-[#707070] rounded text-[11px]"
                >
                  {tag.name}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0 flex-wrap sm:flex-nowrap">
          <button
            onClick={() => onEdit(post)}
            className="px-3 py-1.5 text-[13px] bg-[#1a1a1a] text-white hover:bg-[#2a2a2a] rounded-lg transition touch-manipulation"
          >
            Edit
          </button>
          <button
            onClick={() => onTogglePublish(post)}
            className="px-3 py-1.5 text-[13px] text-[#707070] hover:text-white transition touch-manipulation"
          >
            {post.published ? 'Unpublish' : 'Publish'}
          </button>
          <button
            onClick={() => onDelete(post)}
            className="px-3 py-1.5 text-[13px] text-red-400 hover:text-red-300 transition touch-manipulation"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

/* The content-type badge is the one piece of this row the posts screen will keep across the
   redesign, so it reads the shared table in src/components/admin/contentTypes.ts instead of
   the per-file copy of six emoji strings this file used to carry. */
function ContentTypeBadge({ displayStyle }: { displayStyle: string }): React.ReactElement {
  const type = contentTypeFor(displayStyle);
  const TypeIcon = type.icon;
  return (
    <span className="inline-flex items-center gap-1 text-[length:var(--admin-text-micro)] text-[color:var(--admin-subtle)]">
      <TypeIcon aria-hidden="true" className="size-3.5" />
      {type.label}
    </span>
  );
}
