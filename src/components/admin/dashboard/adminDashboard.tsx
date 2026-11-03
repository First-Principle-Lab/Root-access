'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArticleIcon, FolderIcon, FolderOpenIcon, TagIcon } from '@phosphor-icons/react';
import { ContentLoader } from '../../ui/Spinner';

interface Stats {
  sections: number;
  subsections: number;
  posts: number;
  tags: number;
}

export function AdminDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats>({
    sections: 0,
    subsections: 0,
    posts: 0,
    tags: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const response = await fetch('/api/admin/stats', {
          credentials: 'include',
        });

        if (response.ok) {
          const data = await response.json();
          setStats(data);
        }
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  /* Same icon per destination as the sidebar (src/components/admin/shell/adminNav.tsx:25), so
     the card and the nav entry for a destination look like the same thing. The four emoji this
     replaced were chrome, not data. */
  const cards = [
    { label: 'Sections', value: stats.sections, href: '/admin/sections', icon: FolderIcon },
    { label: 'Subsections', value: stats.subsections, href: '/admin/subsections', icon: FolderOpenIcon },
    { label: 'Posts', value: stats.posts, href: '/admin/posts', icon: ArticleIcon },
    { label: 'Tags', value: stats.tags, href: '/admin/tags', icon: TagIcon },
  ];

  if (loading) {
    return <ContentLoader />;
  }

  return (
    <div>
      <h1 className="text-2xl sm:text-[28px] font-normal text-white mb-6 sm:mb-8">Dashboard</h1>

      <button
        onClick={() => router.push('/')}
        className="mb-6 sm:mb-8 w-full sm:w-auto px-3 sm:px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-500 transition text-xs sm:text-[13px] font-medium touch-manipulation flex items-center justify-center gap-2"
      >
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
        </span>
        Live
      </button>

      {/* Stats Grid - Responsive */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
        {cards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="bg-[#101010] p-4 sm:p-6 rounded-xl border border-[#1a1a1a] hover:border-[#2a2a2a] transition group"
          >
            <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
              <card.icon aria-hidden="true" className="size-5 opacity-60 transition group-hover:opacity-90" />
              <div className="text-xs sm:text-[13px] text-[#707070] group-hover:text-[#e5e5e5] transition">
                {card.label}
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-light text-white">
              {card.value}
            </div>
          </Link>
        ))}
      </div>

      {/* Quick Actions - Responsive */}
      <div className="bg-[#101010] p-4 sm:p-6 rounded-xl border border-[#1a1a1a]">
        <h2 className="text-base sm:text-[18px] font-normal text-white mb-3 sm:mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-2 sm:gap-3">
          <Link
            href="/admin/sections"
            className="px-3 sm:px-4 py-2 bg-white text-[#0a0a0a] rounded-lg hover:opacity-90 transition text-xs sm:text-[13px] font-medium touch-manipulation"
          >
            Create Section
          </Link>
          <Link
            href="/admin/subsections"
            className="px-3 sm:px-4 py-2 bg-[#1a1a1a] text-white rounded-lg hover:bg-[#2a2a2a] transition text-xs sm:text-[13px] font-medium touch-manipulation"
          >
            Create Subsection
          </Link>
          <Link
            href="/admin/posts"
            className="px-3 sm:px-4 py-2 bg-[#1a1a1a] text-white rounded-lg hover:bg-[#2a2a2a] transition text-xs sm:text-[13px] font-medium touch-manipulation"
          >
            Create Post
          </Link>
          <Link
            href="/"
            target="_blank"
            className="px-3 sm:px-4 py-2 bg-[#1a1a1a] text-white rounded-lg hover:bg-[#2a2a2a] transition text-xs sm:text-[13px] font-medium touch-manipulation"
          >
            View Site →
          </Link>
        </div>
      </div>
    </div>
  );
}