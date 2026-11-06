'use client';

import { MoonIcon, SunIcon } from '@phosphor-icons/react';
import { useSyncExternalStore } from 'react';
import { useThemeToggle } from '../../spaceui/theme-toggle';

const subscribe = () => () => {};

/* The one theme control for the whole admin, on the mobile-graph breakpoints through the auth
   screens. It stays on the next-themes path (src/components/spaceui/theme-toggle.tsx), so the
   state and the view-transition animation are only ever implemented once, but the chrome is the
   admin's: a Phosphor icon on an flat token surface, not the public shadcn pill whose colours
   come from the oklch scale rather than --admin-*.

   `isDark` reads `resolvedTheme` in an effect, so pre-mount it is `false` whether the visitor is
   in light or dark; a bare icon button would then paint the wrong glyph and announce the wrong
   target for a beat. The mounted check (the same `useSyncExternalStore` pattern
   `ThemeToggleButton` uses) renders a neutral state until first client render confirms the
   theme, which also keeps the server HTML and the first hydration frame identical. */
export function AdminThemeToggle({ className = '' }: { className?: string }) {
  const { isDark, toggleTheme } = useThemeToggle();
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);

  return (
    <button
      aria-label="Toggle color scheme"
      className={`flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-[var(--admin-radius-control)] text-[color:var(--admin-muted)] hover:bg-[color:var(--admin-hover)] hover:text-[color:var(--admin-heading)] max-[849px]:size-[var(--admin-touch-h)] ${className}`}
      onClick={toggleTheme}
      suppressHydrationWarning
      title={mounted ? (isDark ? 'Dark theme' : 'Light theme') : 'Theme'}
      type="button"
    >
      {mounted && isDark ? (
        <SunIcon className="size-4" aria-hidden="true" />
      ) : (
        <MoonIcon className="size-4" aria-hidden="true" />
      )}
    </button>
  );
}
