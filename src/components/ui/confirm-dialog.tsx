'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/src/lib/cn';
import { AdminButton } from '@/src/components/ui/admin-button';
import { useFocusTrap } from '@/src/hooks/useFocusTrap';

/* One accessible confirmation dialog for every destructive admin action
   (checkpoint 4 of docs/admin-redesign-plan.md; plan §3.5 "Replace browser confirm() calls
   with one accessible confirmation dialog that names the item and consequence").

   - `role="dialog"` + `aria-modal`, labelled by its title and described by the consequence.
   - Focus is trapped by the same hook the mobile drawer uses and is restored to the control
     that opened it when the dialog closes (src/hooks/useFocusTrap.ts).
   - Initial focus goes to Cancel, so Enter on an un-read dialog does not delete anything.
   - Mounted only while open; the caller keeps the pending target in state, so "cancel changes
     nothing" is the default: no request is issued unless Confirm is pressed. */
export interface ConfirmDialogProps {
  /** Short action title, e.g. `Delete section`. */
  title: string;
  /** The specific thing being acted on, announced in the accessible name. */
  itemName: string;
  /** What will happen, including the public consequence where there is one. */
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Keeps the dialog open and the confirm button busy while the caller awaits the request. */
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  itemName,
  description,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps): React.ReactElement {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const titleId = 'admin-confirm-title';
  const descriptionId = 'admin-confirm-description';

  useFocusTrap(true, panelRef, { onEscape: onCancel });

  // Destructive dialogs should not scroll the list behind them.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-[color:var(--admin-scrim)] p-[var(--admin-space-4)] sm:items-center">
      <div
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className={cn(
          'w-full max-w-[420px] rounded-[var(--admin-radius-panel)] border border-[color:var(--admin-border)] bg-[color:var(--admin-surface)] p-[var(--admin-panel-pad)] shadow-[var(--admin-shadow-drawer)]',
        )}
        data-slot="confirm-dialog"
        ref={panelRef}
        role="dialog"
      >
        <h2
          className="text-[length:var(--admin-text-panel-title)] font-semibold leading-[var(--admin-leading-tight)] tracking-[var(--admin-tracking-title)] text-[color:var(--admin-heading)]"
          id={titleId}
        >
          {title}
          <span className="mt-1 block text-[length:var(--admin-text-meta)] font-normal text-[color:var(--admin-muted)]">
            {itemName}
          </span>
        </h2>
        <p className="mt-[var(--admin-space-3)] text-[length:var(--admin-text-meta)] leading-[var(--admin-leading-body)] text-[color:var(--admin-muted)]" id={descriptionId}>
          {description}
        </p>
        <div className="mt-[var(--admin-space-5)] flex flex-wrap justify-end gap-[var(--admin-space-2)]">
          <AdminButton onClick={onCancel} variant="secondary">
            {cancelLabel}
          </AdminButton>
          <AdminButton
            aria-busy={busy || undefined}
            disabled={busy}
            onClick={onConfirm}
            variant="danger-solid"
          >
            {confirmLabel}
          </AdminButton>
        </div>
      </div>
    </div>
  );
}
