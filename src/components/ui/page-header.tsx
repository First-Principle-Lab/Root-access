import type * as React from 'react';
import { cn } from '@/src/lib/cn';

/* Page header primitive (checkpoint 4 of docs/admin-redesign-plan.md). Every admin screen
   opens with the same three things in the same places: what this screen is, what it does,
   and the one primary action. The baseline had four different title sizes and put the
   primary button wherever the person writing the page felt like it. */
interface PageHeaderProps {
  title: string;
  description?: string;
  /** Right-aligned action slot. One primary control at most (docs/admin-redesign/README.md §5). */
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, description, actions, className }: PageHeaderProps): React.ReactElement {
  return (
    <div
      className={cn(
        'mb-[var(--admin-space-6)] flex flex-wrap items-end justify-between gap-[var(--admin-space-4)]',
        className,
      )}
      data-slot="page-header"
    >
      <div className="min-w-0 flex-1">
        <h1 className="text-[length:var(--admin-text-page-title)] font-[650] leading-[var(--admin-leading-tight)] tracking-[var(--admin-tracking-title)] text-[color:var(--admin-heading)]">
          {title}
        </h1>
        {description && (
          <p className="mt-[var(--admin-space-2)] max-w-[70ch] text-[length:var(--admin-text-meta)] text-[color:var(--admin-muted)]">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-[var(--admin-space-2)]">{actions}</div>
      )}
    </div>
  );
}
