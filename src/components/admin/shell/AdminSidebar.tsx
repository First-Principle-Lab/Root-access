'use client';

import Link from 'next/link';
import { ArrowUpRightIcon, PlusIcon, SignOutIcon } from '@phosphor-icons/react';
import { useAdminQuery } from '@/src/lib/adminQuery';
import { adminQueryKeys, loadProfile, loadStats, prefetchAdminRoute } from '@/src/lib/adminQueries';
import { NEW_POST_PATH } from '@/src/lib/postEditor';
import { ADMIN_NAV_GROUPS, isActiveNavItem } from './adminNav';
import { AdminThemeToggle } from './AdminThemeToggle';

interface AdminSidebarProps {
  pathname: string;
  onNavigate?: () => void;
  onLogout: () => void;
  /* The drawer copy stays permanently mounted (it is the aria-controls target of the
     hamburger on every route); `hidden` takes it out of layout, tab order, and the
     accessibility tree while closed. */
  hidden?: boolean;
}

function initialsOf(name: string | undefined) {
  if (!name) return '';
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('');
}

export function AdminSidebar({ pathname, onNavigate, onLogout, hidden = false }: AdminSidebarProps) {
  const { data: profile } = useAdminQuery(adminQueryKeys.profile, loadProfile);
  const { data: stats } = useAdminQuery(adminQueryKeys.stats, loadStats);

  return (
    <div
      className={`admin-sidebar h-full flex-col border-r border-[color:var(--admin-border)] bg-[color:var(--admin-surface)] ${hidden ? 'hidden' : 'flex'}`}
    >
      <Link
        href="/admin"
        onClick={onNavigate}
        aria-label="Admin home"
        className="mx-[var(--admin-space-3)] mt-[var(--admin-space-3)] flex shrink-0 items-center gap-[var(--admin-space-3)] rounded-[var(--admin-radius-control)] px-[var(--admin-space-2)] py-[var(--admin-space-2)] hover:bg-[color:var(--admin-hover)]"
      >
        <span className="relative flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[color:var(--admin-surface-2)] text-[length:var(--admin-text-micro)] font-semibold text-[color:var(--admin-heading)] ring-1 ring-[color:var(--admin-border)]">
          {profile?.profilePicture ? (
            // eslint-disable-next-line @next/next/no-img-element -- a 32px avatar from Cloudinary; next/image would need the remote host configured for no gain
            <img alt="" className="size-full object-cover" src={profile.profilePicture} />
          ) : (
            initialsOf(profile?.name)
          )}
        </span>
        <span className="min-w-0 leading-tight">
          <span className="block truncate text-[length:var(--admin-text-body)] font-semibold text-[color:var(--admin-heading)]">
            {profile?.name ?? 'Root Access'}
          </span>
          <span className="block text-[length:var(--admin-text-micro)] text-[color:var(--admin-subtle)]">Admin</span>
        </span>
      </Link>

      <div className="px-[var(--admin-space-3)] pt-[var(--admin-space-4)]">
        <Link
          href={NEW_POST_PATH}
          onClick={onNavigate}
          className="flex h-[var(--admin-control-h)] w-full items-center justify-center gap-[var(--admin-space-2)] rounded-[var(--admin-radius-control)] bg-[color:var(--admin-primary-bg)] text-[length:var(--admin-text-meta)] font-medium text-[color:var(--admin-primary-text)] hover:bg-[color:var(--admin-primary-hover)] max-[849px]:h-[var(--admin-touch-h)]"
        >
          <PlusIcon aria-hidden="true" className="size-4" weight="bold" />
          New post
        </Link>
      </div>

      <nav aria-label="Admin sections" className="flex min-h-0 flex-1 flex-col gap-[var(--admin-space-5)] overflow-y-auto px-[var(--admin-space-3)] py-[var(--admin-space-5)]">
        {ADMIN_NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="mb-[var(--admin-space-1)] px-[var(--admin-space-2)] text-[length:var(--admin-text-micro)] font-medium uppercase tracking-[var(--admin-tracking-eyebrow)] text-[color:var(--admin-subtle)]">
              {group.label}
            </p>
            <ul className="flex flex-col gap-px">
              {group.items.map((item) => {
                const isActive = isActiveNavItem(pathname, item.href);
                const Icon = item.icon;
                const count = item.href === '/admin/posts' && stats && stats.drafts > 0 ? stats.drafts : null;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      onFocus={() => prefetchAdminRoute(item.href)}
                      onPointerEnter={() => prefetchAdminRoute(item.href)}
                      aria-current={isActive ? 'page' : undefined}
                      className={`group flex min-h-[34px] items-center gap-[var(--admin-space-2)] rounded-[var(--admin-radius-control)] px-[var(--admin-space-2)] text-[length:var(--admin-text-meta)] max-[849px]:min-h-[var(--admin-touch-h)] ${
                        isActive
                          ? 'bg-[color:var(--admin-active)] font-medium text-[color:var(--admin-heading)]'
                          : 'text-[color:var(--admin-muted)] hover:bg-[color:var(--admin-hover)] hover:text-[color:var(--admin-heading)]'
                      }`}
                    >
                      <Icon
                        className={`size-4 shrink-0 ${isActive ? 'text-[color:var(--admin-heading)]' : 'text-[color:var(--admin-subtle)] group-hover:text-[color:var(--admin-heading)]'}`}
                        weight={isActive ? 'fill' : 'regular'}
                        aria-hidden="true"
                      />
                      <span className="flex-1">{item.label}</span>
                      {count !== null && (
                        <span
                          className="font-[family-name:var(--admin-font-mono)] text-[length:var(--admin-text-micro)] tabular-nums text-[color:var(--admin-subtle)]"
                          title={`${count} ${count === 1 ? 'draft' : 'drafts'}`}
                        >
                          <span className="sr-only">, </span>
                          {count}
                          <span className="sr-only"> {count === 1 ? 'draft' : 'drafts'}</span>
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="flex shrink-0 items-center gap-[var(--admin-space-1)] border-t border-[color:var(--admin-border)] px-[var(--admin-space-3)] py-[var(--admin-space-3)]">
        <Link
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-8 flex-1 items-center gap-[var(--admin-space-1)] rounded-[var(--admin-radius-control)] px-[var(--admin-space-2)] text-[length:var(--admin-text-meta)] text-[color:var(--admin-muted)] hover:bg-[color:var(--admin-hover)] hover:text-[color:var(--admin-heading)] max-[849px]:h-[var(--admin-touch-h)]"
        >
          <span>View site</span>
          <ArrowUpRightIcon className="size-3.5 shrink-0" aria-hidden="true" />
        </Link>
        <AdminThemeToggle />
        <button
          type="button"
          onClick={onLogout}
          aria-label="Log out"
          title="Log out"
          className="flex size-8 shrink-0 items-center justify-center rounded-[var(--admin-radius-control)] text-[color:var(--admin-muted)] hover:bg-[color:var(--admin-hover)] hover:text-[color:var(--admin-heading)] max-[849px]:size-[var(--admin-touch-h)]"
        >
          <SignOutIcon className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
