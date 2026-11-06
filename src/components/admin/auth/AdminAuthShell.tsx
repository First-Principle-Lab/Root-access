'use client';

import Link from 'next/link';
import { ArrowLeftIcon, CircleNotchIcon } from '@phosphor-icons/react';
import { AdminThemeToggle } from '../shell/AdminThemeToggle';

export function AdminAuthShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen min-h-dvh flex-col bg-[color:var(--admin-bg)]">
      <header className="flex h-[var(--admin-header-h)] items-center justify-between border-b border-[color:var(--admin-border)] px-[var(--admin-gutter)]">
        <Link href="/" className="text-[length:var(--admin-text-panel-title)] font-medium tracking-[var(--admin-tracking-title)] text-[color:var(--admin-heading)]">
          Root Access <span className="ml-2 text-[length:var(--admin-text-micro)] uppercase tracking-[var(--admin-tracking-eyebrow)] text-[color:var(--admin-subtle)]">admin</span>
        </Link>
        <AdminThemeToggle />
      </header>

      <main className="flex flex-1 items-center justify-center px-[var(--admin-gutter)] py-[var(--admin-space-12)]">
        <div className="w-full max-w-[420px]">
          <div className="mb-[var(--admin-space-6)]">
            <p className="mb-[var(--admin-space-2)] text-[length:var(--admin-text-micro)] font-medium uppercase tracking-[var(--admin-tracking-eyebrow)] text-[color:var(--admin-muted)]">Admin access</p>
            <h1 className="text-[length:var(--admin-text-page-title)] font-semibold leading-[var(--admin-leading-tight)] tracking-[var(--admin-tracking-title)] text-[color:var(--admin-heading)]">{title}</h1>
            <p className="mt-[var(--admin-space-2)] text-[length:var(--admin-text-meta)] text-[color:var(--admin-muted)]">{description}</p>
          </div>
          <div className="rounded-[var(--admin-radius-panel)] border border-[color:var(--admin-border)] bg-[color:var(--admin-surface)] p-[var(--admin-panel-pad)] sm:p-[var(--admin-space-6)]">
            {children}
          </div>
          <Link href="/" className="mt-[var(--admin-space-6)] inline-flex items-center gap-[var(--admin-space-2)] text-[length:var(--admin-text-meta)] text-[color:var(--admin-muted)] hover:text-[color:var(--admin-heading)]">
            <ArrowLeftIcon aria-hidden="true" className="size-4" /> Back to site
          </Link>
        </div>
      </main>
    </div>
  );
}

export function AdminAuthLoading() {
  return (
    <div className="flex min-h-screen min-h-dvh items-center justify-center bg-[color:var(--admin-bg)] text-[color:var(--admin-heading)]" role="status" aria-label="Loading admin access">
      <CircleNotchIcon aria-hidden="true" className="size-6 animate-spin" />
    </div>
  );
}
