// src/components/public/Sidebar.tsx (UPDATED)
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { GitHubMarkIcon } from './GitHubMarkIcon';

interface TopCategory {
  id: string;
  name: string;
  isVisible: boolean;
  subsections: Array<{
    id: string;
    name: string;
    slug: string;
    icon: string;
    postCount: number;
  }>;
}

interface Profile {
  xLink: string | null;
  instagramLink: string | null;
  linkedinLink: string | null;
  email: string | null;
  resumeUrl: string | null;
  profilePicture: string | null;
}

interface LayoutData {
  admin: {
    name: string;
    profile: Profile | null;
  };
  sections: TopCategory[];
}

export function PublicSidebar() {
  const pathname = usePathname();
  const [layoutData, setLayoutData] = useState<LayoutData | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLayoutData() {
      try {
        const response = await fetch('/api/public/layout');
        
        if (response.ok) {
          const data = await response.json();
          setLayoutData(data);
        }
      } catch (error) {
        console.error('Failed to fetch layout data:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchLayoutData();
  }, []);

  const toggleSection = (sectionId: string) => {
    const newCollapsed = new Set(collapsedSections);
    if (newCollapsed.has(sectionId)) {
      newCollapsed.delete(sectionId);
    } else {
      newCollapsed.add(sectionId);
    }
    setCollapsedSections(newCollapsed);
  };

  if (loading) {
    return (
      <aside className="w-48 bg-[#0a0a0a] min-h-screen fixed left-0 top-0">
        <div className="p-6">
          <div className="animate-pulse">
            <div className="h-5 bg-neutral-800 rounded mb-8"></div>
            <div className="space-y-3">
              <div className="h-4 bg-neutral-800 rounded"></div>
              <div className="h-4 bg-neutral-800 rounded"></div>
              <div className="h-4 bg-neutral-800 rounded"></div>
            </div>
          </div>
        </div>
      </aside>
    );
  }

  if (!layoutData) {
    return null;
  }

  const hasResume = layoutData.admin.profile?.resumeUrl;
  const hasSocialLinks = Boolean(layoutData.admin.profile);

  return (
    <aside className="w-48 bg-[#0a0a0a] min-h-screen fixed left-0 top-0 flex flex-col">
      <div className="p-6 flex-1">
        {/* Admin Name with Profile Picture */}
        <div className="mb-8">
          <Link href="/" className="flex items-center gap-2 hover:opacity-70 transition">
            <div className="w-5 h-5 rounded-full bg-neutral-700 flex items-center justify-center overflow-hidden">
              {layoutData.admin.profile?.profilePicture ? (
                <img 
                  src={layoutData.admin.profile.profilePicture} 
                  alt={layoutData.admin.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <svg className="w-3 h-3 text-neutral-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                </svg>
              )}
            </div>
            <span className="text-white text-[14px] font-normal">{layoutData.admin.name}</span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="space-y-6">
          {/* Home Link */}
          <div>
            <Link 
              href="/" 
              className="flex items-center gap-2 text-[13px] text-neutral-500 hover:text-white transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              <span>Home</span>
            </Link>
          </div>

          {/* Resume Link */}
          {hasResume && (
            <div>
              <Link
                href={layoutData.admin.profile?.resumeUrl!}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-[13px] text-neutral-500 hover:text-white transition"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>Resume</span>
                <svg className="w-3 h-3 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </Link>
            </div>
          )}

          {/* Sections and Subsections */}
          {layoutData.sections.map((section) => (
            <div key={section.id}>
              <button
                onClick={() => toggleSection(section.id)}
                className="flex items-center justify-between w-full text-[13px] text-neutral-600 hover:text-neutral-400 transition mb-2.5"
              >
                <span className="font-normal">{section.name}</span>
                <svg 
                  className={`w-3 h-3 transition-transform ${collapsedSections.has(section.id) ? '-rotate-90' : ''}`}
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              {!collapsedSections.has(section.id) && (
                <ul className="space-y-2">
                  {section.subsections.map((subsection) => (
                    <li key={subsection.id}>
                      <Link
                        href={`/${subsection.slug}`}
                        className="text-[13px] text-neutral-500 hover:text-white transition flex items-center gap-2 group"
                      >
                        <span className="opacity-40 group-hover:opacity-60 transition grayscale">
                          {subsection.icon}
                        </span>
                        <span>{subsection.name}</span>
                        {subsection.postCount > 0 && (
                          <span className="text-[11px] text-neutral-700 ml-auto">
                            {subsection.postCount}
                          </span>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </nav>
      </div>

      {/* Social Links at Bottom */}
      {hasSocialLinks && (
        <div className="p-6 border-t border-neutral-900">
          <div className="flex flex-wrap gap-3">
            {layoutData.admin.profile?.email && (
              <Link
                href={`mailto:${layoutData.admin.profile.email}`}
                className="text-neutral-600 hover:text-neutral-400 transition"
                title="Email"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </Link>
            )}
            {layoutData.admin.profile?.xLink && (
              <Link
                href={layoutData.admin.profile.xLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-neutral-600 hover:text-neutral-400 transition"
                title="X (Twitter)"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
              </Link>
            )}
            {layoutData.admin.profile?.linkedinLink && (
              <Link
                href={layoutData.admin.profile.linkedinLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-neutral-600 hover:text-neutral-400 transition"
                title="LinkedIn"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                </svg>
              </Link>
            )}
            <Link
              href="https://github.com/parththirwani"
              target="_blank"
              rel="noopener noreferrer"
              className="text-neutral-600 hover:text-neutral-400 transition"
              title="GitHub"
              aria-label="GitHub"
            >
              <GitHubMarkIcon size={16} aria-hidden="true" />
            </Link>
            {layoutData.admin.profile?.instagramLink && (
              <Link
                href={layoutData.admin.profile.instagramLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-neutral-600 hover:text-neutral-400 transition"
                title="Instagram"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                </svg>
              </Link>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
