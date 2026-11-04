'use client';

import { cva, type VariantProps } from 'class-variance-authority';
import { CheckCircleIcon, InfoIcon, WarningCircleIcon } from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';
import type * as React from 'react';
import { XIcon } from '@phosphor-icons/react';
import { cn } from '@/src/lib/cn';

/* Notice primitive (checkpoint 4 of docs/admin-redesign-plan.md). Replaces the browser
   `alert()` calls and the four hand-rolled `bg-red-950/50` error boxes. An error notice is a
   live region, so a failed save is announced without moving the caret. */
const noticeVariants = cva(
  'flex items-start gap-[var(--admin-space-2)] rounded-[var(--admin-radius-control)] border px-[var(--admin-space-3)] py-[var(--admin-space-3)] text-[length:var(--admin-text-meta)] leading-[var(--admin-leading-body)]',
  {
    defaultVariants: { tone: 'info' },
    variants: {
      tone: {
        error: 'border-[color:var(--admin-danger)]/35 bg-[color:var(--admin-danger-bg)] text-[color:var(--admin-danger)]',
        success: 'border-[color:var(--admin-success)]/35 bg-[color:var(--admin-success-bg)] text-[color:var(--admin-success)]',
        warning: 'border-[color:var(--admin-warning)]/35 bg-[color:var(--admin-warning-bg)] text-[color:var(--admin-warning)]',
        info: 'border-[color:var(--admin-border)] bg-[color:var(--admin-surface-2)] text-[color:var(--admin-muted)]',
      },
    },
  },
);

const TONE_ICON: Record<NonNullable<VariantProps<typeof noticeVariants>['tone']>, Icon> = {
  error: WarningCircleIcon,
  success: CheckCircleIcon,
  warning: WarningCircleIcon,
  info: InfoIcon,
};

interface NoticeProps {
  tone?: VariantProps<typeof noticeVariants>['tone'];
  children: React.ReactNode;
  /** Renders the live-region role: `assertive` for a failure the user must see. */
  assertive?: boolean;
  action?: React.ReactNode;
  onDismiss?: () => void;
  className?: string;
  id?: string;
}

export function Notice({
  tone = 'info',
  children,
  assertive,
  action,
  onDismiss,
  className,
  id,
}: NoticeProps): React.ReactElement {
  const ToneIcon = TONE_ICON[tone ?? 'info'];
  const isProblem = tone === 'error' || tone === 'warning';

  return (
    <div
      aria-live={assertive ? 'assertive' : 'polite'}
      className={cn(noticeVariants({ className, tone }))}
      data-slot="notice"
      id={id}
      role={isProblem ? 'alert' : 'status'}
    >
      <ToneIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 flex-1">{children}</div>
      {action && <div className="shrink-0">{action}</div>}
      {onDismiss && (
        <button
          aria-label="Dismiss message"
          className="-mr-1 shrink-0 cursor-pointer rounded-[var(--admin-radius-control)] p-1 opacity-70 transition hover:opacity-100"
          onClick={onDismiss}
          type="button"
        >
          <XIcon aria-hidden="true" className="size-4" />
        </button>
      )}
    </div>
  );
}
