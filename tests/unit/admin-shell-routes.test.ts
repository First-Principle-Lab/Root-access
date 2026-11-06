import { describe, expect, it } from 'vitest';
import {
  ADMIN_AUTH_SCREEN_PATHS,
  ADMIN_ROOT_ROUTES,
  isActiveAdminRoutePath,
  isAuthScreenPath,
} from '../../src/components/admin/shell/adminRoutes';

/* The shell derives "current location" (aria-current) and "am I an auth screen"
   (whether the shell renders at all) from these two helpers, so the two rules that
   can produce a wrong answer on a real URL are pinned here. */

describe('isActiveAdminRoutePath', () => {
  it('marks only the exact dashboard URL as Dashboard', () => {
    expect(isActiveAdminRoutePath('/admin', '/admin')).toBe(true);
    for (const child of ['/admin/posts', '/admin/sections', '/admin/profile']) {
      expect(isActiveAdminRoutePath(child, '/admin')).toBe(false);
    }
  });

  it('marks a section root active for its own route and its children', () => {
    expect(isActiveAdminRoutePath('/admin/posts', '/admin/posts')).toBe(true);
    expect(isActiveAdminRoutePath('/admin/posts/new', '/admin/posts')).toBe(true);
    expect(isActiveAdminRoutePath('/admin/posts/abc-123', '/admin/posts')).toBe(true);
  });

  it('never matches a sibling route that merely shares a prefix', () => {
    expect(isActiveAdminRoutePath('/admin/subsections', '/admin/sections')).toBe(false);
    expect(isActiveAdminRoutePath('/admin/sections-archive', '/admin/sections')).toBe(false);
    expect(isActiveAdminRoutePath('/admin/tags', '/admin/profile')).toBe(false);
  });

  it('gives exactly one active entry for every shell route in the app', () => {
    const shellPaths = ADMIN_ROOT_ROUTES.map((route) => route.href);
    for (const path of shellPaths) {
      const active = ADMIN_ROOT_ROUTES.filter((route) => isActiveAdminRoutePath(path, route.href));
      expect(active.map((route) => route.href)).toEqual([path]);
    }
  });
});

describe('isAuthScreenPath', () => {
  it('covers the two auth screens that exist on this branch', () => {
    for (const path of ADMIN_AUTH_SCREEN_PATHS) {
      expect(isAuthScreenPath(path)).toBe(true);
    }
    expect(ADMIN_AUTH_SCREEN_PATHS).toEqual(['/admin/login', '/admin/signup']);
  });

  it('does not treat shell routes (or look-alikes) as auth screens', () => {
    for (const route of ADMIN_ROOT_ROUTES) {
      expect(isAuthScreenPath(route.href)).toBe(false);
    }
    expect(isAuthScreenPath('/admin/login-history')).toBe(false);
    expect(isAuthScreenPath('/login')).toBe(false);
  });
});
