'use client';

import { useEffect, useRef } from 'react';

export const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function firstFocusable(container: HTMLElement | null): HTMLElement | null {
  if (!container) return null;
  return container.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
}

/**
 * Traps Tab focus inside `containerRef` while `active`, moves focus to the first
 * focusable element on open, handles Escape, and restores focus to the element that
 * was focused before activation when the trap deactivates or unmounts. Used by the
 * admin mobile navigation drawer and (checkpoint 4) the confirmation dialog.
 *
 * The initial focus is re-asserted for a short window instead of being called once:
 * a pointer click on the trigger re-focuses itself *after* React's passive effects
 * have run, and (measured in the pinned Chromium 1248 with this suite's
 * `prefers-reduced-motion: reduce`) a single synchronous or requestAnimationFrame
 * `focus()` on the freshly revealed panel loses that race and is dropped without a
 * focusin event. Polling until the caret is really inside the panel is what makes
 * "opening the navigation moves focus into it" true for keyboard and pointer users
 * alike, and it keeps focus inside the panel for the rest of its lifetime.
 */
export function useFocusTrap<T extends HTMLElement>(
  active: boolean,
  containerRef: React.RefObject<T | null>,
  options: { onEscape?: () => void } = {}
) {
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const { onEscape } = options;

  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;

    const activeElement = document.activeElement;
    previouslyFocusedRef.current = activeElement instanceof HTMLElement ? activeElement : null;

    const focusables = () => Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      if (container.contains(document.activeElement) || attempts > 20) {
        window.clearInterval(timer);
        return;
      }
      focusables()[0]?.focus();
    }, 32);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onEscape?.();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const current = document.activeElement;
      if (!container.contains(current)) {
        event.preventDefault();
        first.focus();
        return;
      }
      /* The panel owns every Tab press while it is open, in both directions. Stepping only at the
         two boundaries and otherwise letting the browser move focus is not a trap: between the
         drawer's last-but-one item and the next item in DOM order (the top bar and the page behind
         it) focus is genuinely outside for one keypress, and the boundary handler only pulls it
         back on the following keydown. Measured in the pinned Chromium with this suite: roughly one
         run in six read `document.activeElement` in that window and the shell's mobile-navigation
         test failed on it. Cycling through the container's own focusables removes the window, so
         "Escape or Tab, focus never leaves the panel" holds after every single press. */
      const index = items.indexOf(current as HTMLElement);
      const next = event.shiftKey ? (items[index - 1] ?? last) : (items[index + 1] ?? first);
      event.preventDefault();
      next.focus();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocusedRef.current?.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, containerRef]);
}
