'use client';

import { ListIcon, SignOutIcon, XIcon } from '@phosphor-icons/react';
import { ThemeToggleButton } from '../../spaceui/theme-toggle';
import { currentAdminLocation } from './adminNav';

interface AdminTopBarProps {
  pathname: string;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onLogout: () => void;
}

export function AdminTopBar({ pathname, menuOpen, onToggleMenu, onLogout }: AdminTopBarProps) {
  const current = currentAdminLocation(pathname);
  const label = current?.label ?? 'Admin';

  return (
    <header className="fixed inset-x-0 top-0 z-50 flex h-[var(--admin-header-h)] items-center gap-[var(--admin-space-2)] border-b border-[color:var(--admin-border)] bg-[color:var(--admin-surface)] pl-[var(--admin-gutter)] pr-[var(--admin-gutter)]">
      <button
        type="button"
        onClick={onToggleMenu}
        aria-expanded={menuOpen}
        aria-controls="admin-nav-drawer"
        aria-label={menuOpen ? 'Close admin navigation' : 'Open admin navigation'}
        className="min-[850px]:hidden -ml-2 flex size-[var(--admin-touch-h)] shrink-0 items-center justify-center rounded-[var(--admin-radius-control)] text-[color:var(--admin-heading)] transition hover:bg-[color:var(--admin-hover)]"
      >
        {menuOpen ? <XIcon className="size-5" aria-hidden="true" /> : <ListIcon className="size-5" aria-hidden="true" />}
      </button>

      {/* The visible page title (the screen's own `h1`, e.g. "Tags") says this same thing, so
          this is the location label rather than a second heading: an admin route has exactly
          one `h1`, which is what the heading-based screen-reader outline needs. */}
      <p
        className="min-w-0 truncate text-[length:var(--admin-text-panel-title)] font-medium tracking-[var(--admin-tracking-title)] text-[color:var(--admin-heading)]"
        data-admin-location=""
      >
        {label}
      </p>

      <div className="ml-auto flex items-center gap-[var(--admin-space-1)]">
        <ThemeToggleButton buttonVariant="ghost" size="icon" title="Toggle color scheme" />
        <button
          type="button"
          onClick={onLogout}
          className="flex h-[var(--admin-control-h)] items-center gap-[var(--admin-space-1)] rounded-[var(--admin-radius-control)] px-[var(--admin-space-2)] text-[length:var(--admin-text-meta)] text-[color:var(--admin-muted)] transition hover:bg-[color:var(--admin-hover)] hover:text-[color:var(--admin-heading)]"
        >
          <SignOutIcon className="size-4 shrink-0" aria-hidden="true" />
          <span>Log out</span>
        </button>
      </div>
    </header>
  );
}
