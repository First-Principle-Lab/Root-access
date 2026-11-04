'use client';

import { cva, type VariantProps } from 'class-variance-authority';
import type * as React from 'react';
import { cn } from '@/src/lib/cn';
import { CircleNotchIcon } from '@phosphor-icons/react';

/* Admin button primitive (checkpoint 4 of docs/admin-redesign-plan.md).
   Deliberately NOT the public `src/components/ui/button.tsx`: that one paints the
   public shadcn scale (`bg-primary`, `ring-ring`, `rounded-lg` from `--radius`,
   `focus-visible:ring-2`) and would double up with the unlayered admin focus ring in
   src/app/admin/admin.css:175. Every value here is an `--admin-*` token, so the button
   follows the admin theme like the shell does (docs/admin-redesign/README.md §4). */
export const adminButtonVariants = cva(
  'inline-flex shrink-0 cursor-pointer items-center justify-center gap-[var(--admin-space-2)] whitespace-nowrap rounded-[var(--admin-radius-control)] border border-transparent font-medium outline-none transition-colors duration-[var(--admin-motion-fast)] disabled:cursor-not-allowed disabled:opacity-50 data-[loading=true]:cursor-progress',
  {
    defaultVariants: { size: 'default', variant: 'secondary' },
    variants: {
      size: {
        /* 36px desktop control, 44px touch target under the 850px nav breakpoint. */
        default: 'h-[var(--admin-control-h)] max-[849px]:min-h-[var(--admin-touch-h)] px-[var(--admin-space-4)] text-[length:var(--admin-text-body)]',
        sm: 'h-8 max-[849px]:min-h-[var(--admin-touch-h)] px-[var(--admin-space-3)] text-[length:var(--admin-text-micro)]',
        lg: 'h-10 px-[var(--admin-space-5)] text-[length:var(--admin-text-body)]',
        icon: 'size-[var(--admin-control-h)] max-[849px]:size-[var(--admin-touch-h)]',
        'icon-sm': 'size-8 max-[849px]:size-[var(--admin-touch-h)]',
      },
      variant: {
        primary:
          'border-transparent bg-[color:var(--admin-primary-bg)] text-[color:var(--admin-primary-text)] hover:bg-[color:var(--admin-primary-hover)]',
        secondary:
          'border-[color:var(--admin-border-strong)] bg-[color:var(--admin-bg)] text-[color:var(--admin-heading)] hover:border-[color:var(--admin-heading)] hover:bg-[color:var(--admin-hover)]',
        ghost:
          'border-transparent bg-transparent text-[color:var(--admin-muted)] hover:bg-[color:var(--admin-hover)] hover:text-[color:var(--admin-heading)]',
        danger:
          'border-[color:var(--admin-danger)]/40 bg-[color:var(--admin-danger-bg)] text-[color:var(--admin-danger)] hover:bg-[color:var(--admin-danger)]/20',
        'danger-solid':
          'border-transparent bg-[color:var(--admin-danger)] text-[color:var(--admin-bg)] hover:opacity-90',
        link: 'border-transparent text-[color:var(--admin-muted)] underline-offset-4 hover:text-[color:var(--admin-heading)] hover:underline',
      },
    },
  },
);

export interface AdminButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'aria-disabled' | 'aria-busy'> {
  variant?: VariantProps<typeof adminButtonVariants>['variant'];
  size?: VariantProps<typeof adminButtonVariants>['size'];
  /* Keeps the label visible (docs/admin-redesign/README.md §4 "Button states") and marks
     the control busy so assistive tech announces the wait instead of a dead button. */
  loading?: boolean;
}

export function AdminButton({
  className,
  variant,
  size,
  loading = false,
  disabled,
  children,
  type = 'button',
  ...props
}: AdminButtonProps): React.ReactElement {
  return (
    <button
      aria-busy={loading || undefined}
      aria-disabled={(loading || disabled) || undefined}
      className={cn(adminButtonVariants({ className, size, variant }))}
      data-loading={loading ? 'true' : undefined}
      data-slot="admin-button"
      disabled={loading || disabled}
      type={type}
      {...props}
    >
      {loading && <CircleNotchIcon aria-hidden="true" className="size-4 shrink-0 animate-spin" data-slot="admin-button-spinner" />}
      {children}
    </button>
  );
}

/* The same visual language for navigational controls. Exported as class names (the shadcn
   `buttonVariants` pattern) so `<Link>` and `<a>` can wear the button skin without a
   `<button>` inside a link. */
export function adminButtonClass(
  options?: VariantProps<typeof adminButtonVariants> & { className?: string },
): string {
  const { className, ...variants } = options ?? {};
  return cn(adminButtonVariants({ className, ...variants }));
}
