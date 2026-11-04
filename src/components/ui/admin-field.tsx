'use client';

import { CaretDownIcon } from '@phosphor-icons/react';
import * as React from 'react';
import { cn } from '@/src/lib/cn';

/* Admin form primitives (checkpoint 4 of docs/admin-redesign-plan.md). One place owns the
   label / hint / error wiring so an error message is always programmatically associated with
   the field it describes (acceptance row "Accessibility" in docs/admin-redesign-plan.md:58).
   The control reads its wiring from context instead of `cloneElement`, so a control works
   either inside an AdminField or standalone. */

interface AdminFieldContextValue {
  controlId: string;
  hintId?: string;
  errorId?: string;
  invalid: boolean;
}

const AdminFieldContext = React.createContext<AdminFieldContextValue | null>(null);

/** Merged onto the control element: `id`, `aria-invalid`, `aria-describedby`. */
export function useAdminFieldProps<T extends Record<string, unknown>>(props: T): T & {
  id?: string;
  'aria-invalid'?: boolean | 'false' | 'true' | 'grammar' | 'spelling';
  'aria-describedby'?: string;
} {
  const field = React.useContext(AdminFieldContext);
  if (!field) return props;
  const describedBy = [props['aria-describedby'], field.hintId, field.errorId].filter(Boolean).join(' ');
  return {
    ...props,
    id: (props.id as string | undefined) ?? field.controlId,
    'aria-invalid': field.invalid ? true : undefined,
    'aria-describedby': describedBy || undefined,
  };
}

const controlClasses =
  'w-full rounded-[var(--admin-radius-control)] border bg-[color:var(--admin-input-bg)] px-[var(--admin-space-3)] text-[length:var(--admin-text-body)] text-[color:var(--admin-heading)] outline-none transition-colors duration-[var(--admin-motion-fast)] placeholder:text-[color:var(--admin-subtle)]';

function controlBorder(invalid: boolean): string {
  return invalid
    ? 'border-[color:var(--admin-danger)]'
    : 'border-[color:var(--admin-border-strong)] hover:border-[color:var(--admin-heading)]';
}

interface AdminFieldProps {
  label: string;
  /** Omit to get a generated id; pass one when a test or a `label htmlFor` must be stable. */
  id?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
  /** Sits on the label row, right-aligned: a counter, an optional marker, a small action. */
  aside?: React.ReactNode;
  children: React.ReactNode;
}

export function AdminField({
  label,
  id,
  hint,
  error,
  required,
  className,
  aside,
  children,
}: AdminFieldProps): React.ReactElement {
  const generated = React.useId();
  const controlId = id ?? `admin-field-${generated}`;
  const hintId = hint ? `${controlId}-hint` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;

  return (
    <div className={cn('flex flex-col gap-[var(--admin-field-gap)]', className)} data-slot="admin-field">
      <div className="flex items-baseline justify-between gap-[var(--admin-space-2)]">
        <label
          className="text-[length:var(--admin-text-meta)] font-medium text-[color:var(--admin-heading)]"
          htmlFor={controlId}
        >
          {label}
          {required && <span aria-hidden="true" className="ml-1 text-[color:var(--admin-danger)]">*</span>}
        </label>
        {aside}
      </div>
      <AdminFieldContext.Provider value={{ controlId, errorId, hintId, invalid: Boolean(error) }}>
        {children}
      </AdminFieldContext.Provider>
      {hint && !error && (
        <p className="text-[length:var(--admin-text-micro)] text-[color:var(--admin-subtle)]" id={hintId}>
          {hint}
        </p>
      )}
      {error && (
        <p className="text-[length:var(--admin-text-micro)] text-[color:var(--admin-danger)]" id={errorId} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function AdminInput({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>): React.ReactElement {
  const fieldProps = useAdminFieldProps(props);
  return (
    <input
      {...fieldProps}
      className={cn(controlClasses, controlBorder(fieldProps['aria-invalid'] === true), 'h-[var(--admin-control-h)]', className)}
      data-slot="admin-input"
    />
  );
}

export function AdminTextarea({
  className,
  rows = 4,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>): React.ReactElement {
  const fieldProps = useAdminFieldProps(props);
  return (
    <textarea
      {...fieldProps}
      className={cn(
        controlClasses,
        controlBorder(fieldProps['aria-invalid'] === true),
        'min-h-[var(--admin-textarea-min-h)] resize-y py-[var(--admin-space-3)] leading-[var(--admin-leading-editor)]',
        className,
      )}
      data-slot="admin-textarea"
      rows={rows}
    />
  );
}

interface AdminSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  /* Compact select for filter rows: keeps the native control (keyboard, screen reader,
     mobile picker) and only replaces the skin. */
  compact?: boolean;
}

export function AdminSelect({ className, compact = false, children, ...props }: AdminSelectProps): React.ReactElement {
  const fieldProps = useAdminFieldProps(props);
  return (
    <span className={cn('relative block', compact ? 'inline-flex' : 'w-full')} data-slot="admin-select-wrap">
      <select
        {...fieldProps}
        className={cn(
          controlClasses,
          controlBorder(fieldProps['aria-invalid'] === true),
          'h-[var(--admin-control-h)] appearance-none pr-[var(--admin-space-8)]',
          compact && 'w-auto min-w-[180px] text-[length:var(--admin-text-meta)]',
          className,
        )}
        data-slot="admin-select"
      >
        {children}
      </select>
      <CaretDownIcon
        aria-hidden="true"
        className="pointer-events-none absolute right-[var(--admin-space-3)] top-1/2 size-4 -translate-y-1/2 text-[color:var(--admin-muted)]"
      />
    </span>
  );
}

export function AdminCheckbox({
  className,
  label,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }): React.ReactElement {
  /* The label element wraps the input, so it names the control directly; nothing from the
     field context is applied here. */
  return (
    <label
      className="flex cursor-pointer items-center gap-[var(--admin-space-2)] text-[length:var(--admin-text-meta)] text-[color:var(--admin-heading)]"
      data-slot="admin-checkbox"
    >
      <input
        {...props}
        /* Native box + `accent-color`: an appearance-none box needs its own tick glyph,
           which is one more thing to get wrong for no visual gain. */
        className={cn(
          'size-4 shrink-0 cursor-pointer accent-[color:var(--admin-primary-bg)] outline-none',
          className,
        )}
        type="checkbox"
      />
      {label}
    </label>
  );
}
