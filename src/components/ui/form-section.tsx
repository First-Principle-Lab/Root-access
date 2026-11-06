import type * as React from 'react';
import { cn } from '@/src/lib/cn';

/* Panel grouping primitive (checkpoint 4 of docs/admin-redesign-plan.md). The create/edit
   forms on Sections, Tags and Profile were one flat stack of inputs; this gives them a titled
   panel, and it is what the Profile screen is regrouped into identity / contact / social
   blocks with in checkpoint 8. */
interface FormSectionProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function FormSection({ title, description, actions, children, className }: FormSectionProps): React.ReactElement {
  return (
    <section
      className={cn(
        'rounded-[var(--admin-radius-panel)] border border-[color:var(--admin-border)] bg-[color:var(--admin-surface)] p-[var(--admin-panel-pad)]',
        className,
      )}
      data-slot="form-section"
    >
      <div className="mb-[var(--admin-space-4)] flex flex-wrap items-start justify-between gap-[var(--admin-space-3)]">
        <div className="min-w-0">
          <h2 className="text-[length:var(--admin-text-panel-title)] font-semibold leading-[var(--admin-leading-tight)] tracking-[var(--admin-tracking-title)] text-[color:var(--admin-heading)]">
            {title}
          </h2>
          {description && (
            <p className="mt-[var(--admin-space-1)] text-[length:var(--admin-text-meta)] text-[color:var(--admin-muted)]">
              {description}
            </p>
          )}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-[var(--admin-space-2)]">{actions}</div>}
      </div>
      {children}
    </section>
  );
}
