'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { adminApi } from '@/src/lib/api';
import { useAuth } from '@/src/contexts/authContext';
import { useFocusTrap } from '@/src/hooks/useFocusTrap';
import { FullScreenLoader } from '../ui/Spinner';
import { isAuthScreenPath } from './shell/adminNav';
import { AdminSidebar } from './shell/AdminSidebar';
import { AdminTopBar } from './shell/AdminTopBar';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, isLoading, checkAuth } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [navPathname, setNavPathname] = useState(pathname);
  const drawerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isAuthScreenPath(pathname)) {
      return;
    }

    if (!isLoading && !isAuthenticated) {
      router.push('/admin/login');
    }
  }, [isAuthenticated, isLoading, pathname, router]);

  // "Adjust state during render" (react.dev): the drawer must never survive a
  // navigation, without the set-state-in-effect lint this would trigger.
  if (navPathname !== pathname) {
    setNavPathname(pathname);
    if (mobileMenuOpen) setMobileMenuOpen(false);
  }

  useEffect(() => {
    if (!mobileMenuOpen) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  useFocusTrap(mobileMenuOpen, drawerRef, {
    onEscape: () => setMobileMenuOpen(false),
  });

  const handleLogout = async () => {
    try {
      await adminApi.logout();
      await checkAuth();
      router.push('/admin/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  if (isLoading) {
    return <FullScreenLoader />;
  }

  if (!isAuthenticated) {
    return null;
  }

  // The token/cursor scope itself is the single `.admin-shell` element rendered by
  // src/app/admin/layout.tsx (the route-level layout, which also covers /admin/login and
  // /admin/signup); this div is only the authenticated chrome inside it, so it must not
  // repeat that class or every admin page would nest two shells.
  return (
    <div className="admin-layout min-h-screen">
      <a
        href="#admin-main"
        className="fixed left-2 top-2 z-[60] rounded-[var(--admin-radius-control)] bg-[color:var(--admin-surface)] px-[var(--admin-space-3)] py-2 text-[length:var(--admin-text-meta)] text-[color:var(--admin-heading)] shadow-[var(--admin-shadow-drawer)] [-webkit-transform:translateY(-200%)] [transform:translateY(-200%)] focus:[-webkit-transform:none] focus:[transform:none]"
      >
        Skip to main content
      </a>

      <AdminTopBar
        pathname={pathname}
        menuOpen={mobileMenuOpen}
        onToggleMenu={() => setMobileMenuOpen((open) => !open)}
        onLogout={handleLogout}
      />

      <aside className="max-[849px]:hidden fixed bottom-0 left-0 top-[var(--admin-header-h)] z-20 w-[var(--admin-sidebar-w)]">
        <AdminSidebar pathname={pathname} onLogout={handleLogout} />
      </aside>

      <div
        aria-hidden="true"
        onClick={() => setMobileMenuOpen(false)}
        className={`min-[850px]:hidden fixed inset-x-0 bottom-0 top-[var(--admin-header-h)] z-30 bg-[color:var(--admin-scrim)] transition-opacity duration-[var(--admin-motion-drawer)] ${
          mobileMenuOpen ? '' : 'invisible opacity-0'
        }`}
      />
      <div
        id="admin-nav-drawer"
        ref={drawerRef}
        role={mobileMenuOpen ? 'dialog' : undefined}
        aria-modal={mobileMenuOpen ? true : undefined}
        aria-label="Admin navigation"
        className={`min-[850px]:hidden fixed bottom-0 left-0 top-[var(--admin-header-h)] z-40 w-[min(20rem,85vw)] ${mobileMenuOpen ? '' : 'invisible'}`}
      >
        <AdminSidebar
          pathname={pathname}
          hidden={!mobileMenuOpen}
          onNavigate={() => setMobileMenuOpen(false)}
          onLogout={handleLogout}
        />
      </div>

      <main
        id="admin-main"
        tabIndex={-1}
        className="min-h-screen pt-[var(--admin-header-h)] outline-none min-[850px]:pl-[var(--admin-sidebar-w)]"
      >
        <div className="px-[var(--admin-gutter)] py-[var(--admin-space-6)]">{children}</div>
      </main>
    </div>
  );
}
