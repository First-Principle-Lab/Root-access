'use client';

import { CircleNotchIcon } from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';
import { motion, useReducedMotion } from 'motion/react';
import { useState } from 'react';
import { cn } from '@/src/lib/cn';

/* The admin's one save dock, on the `morphing-action-dock` pattern (CoDesign-Spa27/skecher-ui,
   pulled in with shadcn): a compact floating pill of icon actions with the sliding indicator
   pill following the hovered / focused item, and the save state as a signal dot instead of a
   text band. The registry component itself is a `DockItem` demo that cannot host real actions,
   so it lent the engine — `motion` springs, sliding indicator, reduced-motion fallbacks — and
   the chrome is admin tokens.

   Contracts the e2e suite relies on, preserved through the icon-only conversion:
   - every action keeps its accessible name (`aria-label` = the old visible label), because the
     suite clicks 'Save changes', 'Publish', 'Unpublish', 'Save profile' ... by name (23 sites);
   - the state dot carries `data-slot="editor-save-state"` + the full state line as its `title`,
     and a screen-reader text node inside a `role="status"` region announces changes politely —
     the visible state assertions were rewritten to the title attribute (a text band the suite
     could see anytime forced this interface to be a wide, mostly-empty strip). */

const spring = { type: 'spring' as const, duration: 0.46, bounce: 0.16 } as const;

export interface SaveDockAction {
  /** Stable key for the dock's indicator tracking. */
  id: string;
  /** The accessible name — keep it in sync with the e2e role-click sites. */
  label: string;
  icon: Icon;
  /** `True` swaps in the spinner and blocks the action while the request is in flight. */
  loading?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  /** `submit` keeps form submission working (Save changes / Save profile). */
  type?: 'submit' | 'button';
}

interface SaveDockProps {
  /** Colour of the state dot; an unsaved page glows, a clean one rests. */
  dirty: boolean;
  /** Full state sentence, shown on hover/focus over the dot and announced to readers. */
  status: string;
  actions: SaveDockAction[];
}

export function SaveDock({ dirty, status, actions }: SaveDockProps): React.ReactElement {
  const shouldReduceMotion = useReducedMotion();
  // The hovered/focused button's box, measured from the DOM: the registry dock hardcodes its
  // 38px items and 42px step, which spills past our token-sized (36px / 44px touch) buttons.
  // Leaving keeps the last box so the next hover fades in in place instead of growing from 0.
  const [indicator, setIndicator] = useState({ x: 0, width: 0, visible: false });
  const [snap, setSnap] = useState(false);
  const track = (event: React.SyntheticEvent<HTMLButtonElement>) => {
    const { offsetLeft, offsetWidth } = event.currentTarget;
    const jump = !indicator.visible;
    setIndicator({ x: offsetLeft, width: offsetWidth, visible: true });
    if (jump) setSnap(true);
  };
  const hide = () => setIndicator((current) => ({ ...current, visible: false }));

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-4 z-20 flex justify-center px-[var(--admin-gutter)] min-[850px]:left-[var(--admin-sidebar-w)] min-[850px]:px-6"
      data-slot="editor-save-bar"
    >
      {/* The dock. */}
      <div
        className="pointer-events-auto flex w-max max-w-full items-center gap-[var(--admin-space-2)] rounded-full border border-[color:var(--admin-border-strong)] bg-[color-mix(in_srgb,var(--admin-bg)_92%,transparent)] p-[var(--admin-space-1)] shadow-[0_18px_50px_-16px_rgb(0_0_0/0.55)] backdrop-blur-md"
        data-slot="save-dock"
      >
        <div
          className="relative flex items-center gap-1"
          data-slot="save-dock-actions"
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) hide();
          }}
          onPointerLeave={hide}
        >
          {/* The morphing indicator: the registry dock's sliding dark pill behind the active icon. */}
          <motion.div
            animate={{
              opacity: indicator.visible ? 1 : 0,
              x: indicator.x,
              width: indicator.width,
            }}
            aria-hidden="true"
            className="absolute inset-y-0 left-0 rounded-full bg-[color:var(--admin-active)] ring-1 ring-inset ring-[color:var(--admin-border)]"
            initial={false}
            style={{ willChange: 'transform' }}
            onAnimationComplete={() => setSnap(false)}
            transition={
              shouldReduceMotion || snap
                ? { x: { duration: 0 }, width: { duration: 0 }, opacity: { duration: 0.14 } }
                : spring
            }
          />
          {actions.map((action) => {
            const Icon = action.icon;
            const blocked = Boolean(action.loading) || Boolean(action.disabled);
            return (
              <button
                aria-label={action.label}
                className={cn(
                  'group/action relative z-10 flex size-[var(--admin-control-h)] max-[849px]:size-[var(--admin-touch-h)] items-center justify-center rounded-full outline-none disabled:cursor-not-allowed disabled:opacity-50',
                  'text-[color:var(--admin-muted)] hover:text-[color:var(--admin-heading)] aria-disabled:opacity-50',
                )}
                data-loading={action.loading || undefined}
                disabled={blocked}
                key={action.id}
                onClick={action.onClick}
                onFocus={track}
                onPointerEnter={track}
                title={action.label}
                type={action.type ?? 'button'}
              >
                {action.loading ? (
                  <CircleNotchIcon
                    aria-hidden="true"
                    className="size-[18px] animate-spin text-[color:var(--admin-heading)]"
                  />
                ) : (
                  <Icon aria-hidden="true" className="size-[18px]" weight="regular" />
                )}
                <span className="sr-only">{action.label}</span>
              </button>
            );
          })}
        </div>

        <span aria-hidden="true" className="mx-[var(--admin-space-1)] h-5 w-px bg-[color:var(--admin-border-strong)]" />

        <span
          className="group relative flex size-[var(--admin-control-h)] items-center justify-center max-[849px]:size-[var(--admin-touch-h)]"
          data-slot="editor-save-state"
          title={status}
        >
          <span
            className="absolute bg-[color:var(--admin-subtle)] text-[length:var(--admin-text-micro)] text-[color:var(--admin-subtle)] sr-only"
            role="status"
          >
            {status}
          </span>
          <motion.span
            animate={dirty ? { opacity: 1, scale: 1 } : { opacity: 0.65, scale: 1 }}
            aria-hidden="true"
            className={cn(
              'block size-2 rounded-full',
              dirty ? 'bg-[color:var(--admin-warning)]' : 'bg-[color:var(--admin-success)]',
            )}
            initial={false}
            transition={shouldReduceMotion ? { duration: 0.12 } : spring}
          />
        </span>
      </div>
    </div>
  );
}
