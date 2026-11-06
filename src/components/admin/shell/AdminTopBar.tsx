'use client';

import Link from 'next/link';
import { ListIcon, PlusIcon, XIcon } from '@phosphor-icons/react';
import { NEW_POST_PATH } from '@/src/lib/postEditor';
import { currentAdminLocation } from './adminNav';

interface AdminTopBarProps {
  pathname: string;
  menuOpen: boolean;
  onToggleMenu: () => void;
}

/* Small screens only: on desktop the sidebar is always visible and carries everything this bar
   would, so a second bar would just repeat the page title. */
export function AdminTopBar({ pathname, menuOpen, onToggleMenu }: AdminTopBarProps) {
  const current = currentAdminLocation(pathname);
  const label = current?.label ?? 'Admin';

  return (
    <header className="min-[850px]:hidden fixed inset-x-0 top-0 z-50 flex h-[var(--admin-header-h)] items-center gap-[var(--admin-space-2)] border-b border-[color:var(--admin-border)] bg-[color:var(--admin-bg)]/85 px-[var(--admin-gutter)] backdrop-blur-md">
      <button
        type="button"
        onClick={onToggleMenu}
        aria-expanded={menuOpen}
        aria-controls="admin-nav-drawer"
        aria-label={menuOpen ? 'Close admin navigation' : 'Open admin navigation'}
        className="-ml-2 flex size-[var(--admin-touch-h)] shrink-0 items-center justify-center rounded-[var(--admin-radius-control)] text-[color:var(--admin-heading)] hover:bg-[color:var(--admin-hover)]"
      >
        {menuOpen ? <XIcon className="size-5" aria-hidden="true" /> : <ListIcon className="size-5" aria-hidden="true" />}
      </button>

      {/* The screen's own h1 says the same thing, so this is a location label, not a heading. */}
      <p
        className="min-w-0 flex-1 truncate text-[length:var(--admin-text-body)] font-semibold text-[color:var(--admin-heading)]"
        data-admin-location=""
      >
        {label}
      </p>

      <Link
        href={NEW_POST_PATH}
        aria-label="New post"
        className="-mr-2 flex size-[var(--admin-touch-h)] shrink-0 items-center justify-center rounded-[var(--admin-radius-control)] text-[color:var(--admin-heading)] hover:bg-[color:var(--admin-hover)]"
      >
        <PlusIcon className="size-5" aria-hidden="true" />
      </Link>
    </header>
  );
}
