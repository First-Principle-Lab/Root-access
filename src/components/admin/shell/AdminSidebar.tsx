'use client';

import Link from 'next/link';
import { ArrowSquareOutIcon, SignOutIcon } from '@phosphor-icons/react';
import { ADMIN_NAV_ITEMS, isActiveNavItem } from './adminNav';

interface AdminSidebarProps {
  pathname: string;
  onNavigate?: () => void;
  onLogout: () => void;
  /* The drawer copy stays permanently mounted (it is the aria-controls target of the
     hamburger on every route); `hidden` takes it out of layout, tab order, and the
     accessibility tree while closed. */
  hidden?: boolean;
}

export function AdminSidebar({ pathname, onNavigate, onLogout, hidden = false }: AdminSidebarProps) {
  return (
    <div className={`h-full flex-col gap-[var(--admin-space-4)] border-r border-[color:var(--admin-border)] bg-[color:var(--admin-surface)] p-[var(--admin-space-4)] ${hidden ? 'hidden' : 'flex'}`}>
      <Link
        href="/admin"
        onClick={onNavigate}
        aria-label="Admin home"
        className="flex h-[var(--admin-header-h)] shrink-0 items-center gap-2 text-[length:var(--admin-text-panel-title)] font-medium tracking-[var(--admin-tracking-title)] text-[color:var(--admin-heading)]"
      >
        Admin
        <span className="text-[length:var(--admin-text-micro)] uppercase tracking-[var(--admin-tracking-eyebrow)] text-[color:var(--admin-subtle)]">
          {isActiveNavItem(pathname, '/admin') ? 'dashboard' : 'editing'}
        </span>
      </Link>

      <nav aria-label="Admin sections" className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto py-2">
        {ADMIN_NAV_ITEMS.map((item) => {
          const isActive = isActiveNavItem(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={isActive ? 'page' : undefined}
              className={`flex min-h-[var(--admin-control-h)] items-center gap-[var(--admin-space-2)] rounded-[var(--admin-radius-control)] px-[var(--admin-space-3)] py-2 text-[length:var(--admin-text-meta)] transition ${
                isActive
                  ? 'bg-[color:var(--admin-surface-2)] font-medium text-[color:var(--admin-heading)]'
                  : 'text-[color:var(--admin-muted)] hover:bg-[color:var(--admin-hover)] hover:text-[color:var(--admin-heading)]'
              }`}
            >
              <Icon className="size-4 shrink-0" aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="flex shrink-0 flex-col gap-1 border-t border-[color:var(--admin-border)] pt-[var(--admin-space-3)]">
        <Link
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-[var(--admin-control-h)] items-center gap-[var(--admin-space-2)] rounded-[var(--admin-radius-control)] px-[var(--admin-space-3)] py-2 text-[length:var(--admin-text-meta)] text-[color:var(--admin-muted)] transition hover:bg-[color:var(--admin-hover)] hover:text-[color:var(--admin-heading)]"
        >
          <ArrowSquareOutIcon className="size-4 shrink-0" aria-hidden="true" />
          <span>View site</span>
        </Link>
        <button
          type="button"
          onClick={onLogout}
          className="flex min-h-[var(--admin-control-h)] w-full items-center gap-[var(--admin-space-2)] rounded-[var(--admin-radius-control)] px-[var(--admin-space-3)] py-2 text-left text-[length:var(--admin-text-meta)] text-[color:var(--admin-muted)] transition hover:bg-[color:var(--admin-hover)] hover:text-[color:var(--admin-heading)]"
        >
          <SignOutIcon className="size-4 shrink-0" aria-hidden="true" />
          <span>Log out</span>
        </button>
      </div>
    </div>
  );
}
