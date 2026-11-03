import { ArrowSquareOutIcon, RocketIcon } from '@phosphor-icons/react';
import { Post } from '@/src/types';

interface PostCardProps {
  post: Post;
}

export function PostCard({ post }: PostCardProps) {
  const tags = post.tags ?? [];

  return (
    <a
      href={post.projectLink || '#'}
      target="_blank"
      rel="noopener noreferrer"
      className="block group"
    >
      <div className="bg-[#101010] rounded-2xl border border-[#1a1a1a] p-6 hover:border-[#2a2a2a] transition-all duration-200 h-full flex flex-col">
        <div className="flex items-start justify-between mb-4">
          <div className="w-10 h-10 rounded-xl bg-[#1a1a1a] flex items-center justify-center text-lg">
            {post.coverImage ? (
              <img src={post.coverImage} alt="" className="w-full h-full object-cover rounded-xl" />
            ) : (
              <RocketIcon aria-hidden="true" className="size-5 text-[color:var(--admin-subtle)]" />
            )}
          </div>
          <ArrowSquareOutIcon aria-hidden="true" className="size-4 shrink-0 text-[color:var(--admin-subtle)] transition group-hover:text-[color:var(--admin-heading)]" />
        </div>
        
        <h3 className="text-[15px] font-normal text-white mb-2 group-hover:text-neutral-300 transition">
          {post.title}
        </h3>
        
        <p className="text-[13px] text-neutral-500 leading-relaxed mb-4 flex-1">
          {post.description}
        </p>
        
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-2 border-t border-[#1a1a1a]">
            {tags.slice(0, 3).map(tag => (
              <span
                key={tag.name}
                className="px-2 py-1 text-[11px] rounded bg-[#1a1a1a] text-neutral-600"
              >
                {tag.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </a>
  );
}