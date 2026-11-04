import type * as React from 'react';
import { cn } from '@/src/lib/cn';

/* Filter row primitive (checkpoint 5 of docs/admin-redesign-plan.md: "keep page titles, primary
   actions, filters, and row actions in consistent positions"). One place owns where filters sit on
   a content screen - under the page header, above the list, labelled, with the result count on the
   same line - so Subsections, Posts and Tags read as the same screen with different data. */
interface AdminFilterBarProps {
  /** `AdminField`s with compact controls inside. */
  children: React.ReactNode;
  /** What the filters currently return, e.g. "3 of 7 subsections". */
  result?: React.ReactNode;
  /** Only when a filter is active: a control that returns the list to the whole set. */
  onClear?: () => void;
  clearLabel?: string;
  className?: string;
}

export function AdminFilterBar({
  children,
  result,
  onClear,
  clearLabel = 'Clear filters',
  className,
}: AdminFilterBarProps): React.ReactElement {
  return (
    <div
      className={cn(
        'mb-[var(--admin-space-5)] flex flex-wrap items-end gap-[var(--admin-space-3)] border-b border-[color:var(--admin-border)] pb-[var(--admin-space-4)]',
        className,
      )}
      data-slot="admin-filter-bar"
      role="search"
    >
      {children}
      {(result || onClear) && (
        <div className="ml-auto flex items-center gap-[var(--admin-space-3)] pb-[var(--admin-space-1)]">
          {result && (
            <p
              className="text-[length:var(--admin-text-micro)] text-[color:var(--admin-subtle)]"
              data-slot="admin-filter-result"
            >
              {result}
            </p>
          )}
          {onClear && (
            <button
              className="cursor-pointer text-[length:var(--admin-text-micro)] text-[color:var(--admin-muted)] underline underline-offset-4 transition-colors hover:text-[color:var(--admin-heading)]"
              onClick={onClear}
              type="button"
            >
              {clearLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
