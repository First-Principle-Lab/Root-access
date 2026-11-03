import { cva, type VariantProps } from 'class-variance-authority';
import type { Icon } from '@phosphor-icons/react';
import type * as React from 'react';
import { cn } from '@/src/lib/cn';

/* Status label primitive (checkpoint 4 of docs/admin-redesign-plan.md). Replaces the four
   copies of `bg-green-950/50 text-green-400` / `bg-[#1a1a1a] text-[#707070]` pills that the
   baseline scattered over sections, subsections, posts and tags, and gives the content-type
   badge an icon instead of the emoji it used to carry. */
export const statusLabelVariants = cva(
  'inline-flex h-[22px] shrink-0 items-center gap-1 rounded-[var(--admin-radius-pill)] border px-[var(--admin-space-2)] text-[length:var(--admin-text-micro)] font-semibold whitespace-nowrap',
  {
    defaultVariants: { tone: 'neutral' },
    variants: {
      tone: {
        neutral: 'border-[color:var(--admin-border)] bg-[color:var(--admin-surface-2)] text-[color:var(--admin-muted)]',
        live: 'border-[color:var(--admin-success)]/35 bg-[color:var(--admin-success-bg)] text-[color:var(--admin-success)]',
        draft: 'border-[color:var(--admin-border-strong)] bg-[color:var(--admin-surface-2)] text-[color:var(--admin-muted)]',
        hidden: 'border-[color:var(--admin-warning)]/35 bg-[color:var(--admin-warning-bg)] text-[color:var(--admin-warning)]',
        danger: 'border-[color:var(--admin-danger)]/35 bg-[color:var(--admin-danger-bg)] text-[color:var(--admin-danger)]',
        info: 'border-[color:var(--admin-info)]/35 bg-[color:var(--admin-info-bg)] text-[color:var(--admin-info)]',
      },
    },
  },
);

export interface StatusLabelProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: VariantProps<typeof statusLabelVariants>['tone'];
  icon?: Icon;
}

export function StatusLabel({ tone, icon: Icon, className, children, ...props }: StatusLabelProps): React.ReactElement {
  return (
    <span className={cn(statusLabelVariants({ className, tone }))} data-slot="status-label" {...props}>
      {Icon && <Icon aria-hidden="true" className="size-3.5 shrink-0" />}
      {children}
    </span>
  );
}
