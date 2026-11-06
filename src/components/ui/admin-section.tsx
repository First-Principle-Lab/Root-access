import type * as React from 'react';
import { cn } from '@/src/lib/cn';

/* An unboxed section: a small uppercase heading over a hairline, the way the public site groups
   its lists. Use it for lists and read-only groups; `FormSection` stays for forms that need a
   panel around their fields. */
interface AdminSectionProps {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function AdminSection({ title, action, children, className }: AdminSectionProps): React.ReactElement {
  return (
    <section className={cn('min-w-0', className)} data-slot="admin-section">
      <div className="mb-[var(--admin-space-1)] flex items-center justify-between gap-[var(--admin-space-3)] border-b border-[color:var(--admin-border)] pb-[var(--admin-space-2)]">
        <h2 className="text-[length:var(--admin-text-micro)] font-medium uppercase tracking-[var(--admin-tracking-eyebrow)] text-[color:var(--admin-subtle)]">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}
