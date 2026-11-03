'use client';

import { ArrowsClockwiseIcon, CircleNotchIcon } from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';
import { cn } from '@/src/lib/cn';
import { AdminButton } from '@/src/components/ui/admin-button';

/* Loading / empty / error states (checkpoint 4 of docs/admin-redesign-plan.md).
   The baseline rendered `ContentLoader` (a white arc on a #2a2a2a ring from
   src/components/ui/Spinner.tsx) for every admin screen and, for a failed list request,
   simply showed an empty list — the failure was invisible. `AdminErrorState` is the one place
   an admin list can say "this did not load" and offer a retry. */

export function AdminLoadingState({ label = 'Loading', className }: { label?: string; className?: string }): React.ReactElement {
  return (
    <div
      aria-busy="true"
      className={cn('flex items-center justify-center gap-[var(--admin-space-2)] py-[var(--admin-space-12)] text-[color:var(--admin-muted)]', className)}
      data-slot="admin-loading-state"
      role="status"
    >
      <CircleNotchIcon aria-hidden="true" className="size-4 animate-spin" />
      <span className="text-[length:var(--admin-text-meta)]">{label}</span>
    </div>
  );
}

interface AdminEmptyStateProps {
  title: string;
  description?: string;
  icon?: Icon;
  action?: React.ReactNode;
  className?: string;
}

export function AdminEmptyState({ title, description, icon: Icon, action, className }: AdminEmptyStateProps): React.ReactElement {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-[var(--admin-space-2)] rounded-[var(--admin-radius-panel)] border border-[color:var(--admin-border)] bg-[color:var(--admin-surface)] px-[var(--admin-space-5)] py-[var(--admin-space-12)] text-center',
        className,
      )}
      data-slot="admin-empty-state"
    >
      {Icon && <Icon aria-hidden="true" className="size-5 text-[color:var(--admin-subtle)]" />}
      <p className="text-[length:var(--admin-text-body)] font-medium text-[color:var(--admin-heading)]">{title}</p>
      {description && (
        <p className="max-w-[46ch] text-[length:var(--admin-text-meta)] text-[color:var(--admin-muted)]">{description}</p>
      )}
      {action && <div className="mt-[var(--admin-space-2)]">{action}</div>}
    </div>
  );
}

interface AdminErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}

export function AdminErrorState({
  title = 'Could not load',
  message,
  onRetry,
  retryLabel = 'Try again',
  className,
}: AdminErrorStateProps): React.ReactElement {
  return (
    <div
      className={cn(
        'flex flex-col items-start gap-[var(--admin-space-3)] rounded-[var(--admin-radius-panel)] border border-[color:var(--admin-danger)]/35 bg-[color:var(--admin-danger-bg)] p-[var(--admin-panel-pad)]',
        className,
      )}
      data-slot="admin-error-state"
      role="alert"
    >
      <div>
        <p className="text-[length:var(--admin-text-panel-title)] font-medium text-[color:var(--admin-heading)]">{title}</p>
        <p className="mt-1 text-[length:var(--admin-text-meta)] text-[color:var(--admin-muted)]">{message}</p>
      </div>
      {onRetry && (
        <AdminButton onClick={onRetry} size="sm" variant="secondary">
          <ArrowsClockwiseIcon aria-hidden="true" className="size-4" />
          {retryLabel}
        </AdminButton>
      )}
    </div>
  );
}
