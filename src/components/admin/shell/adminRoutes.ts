export interface AdminRoute {
  href: string;
  label: string;
}

/* The seven admin routes on the current tree. The six shell routes below share the
   shell; the two auth screens are rendered without it. */
export const ADMIN_ROOT_ROUTES: AdminRoute[] = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/sections', label: 'Sections' },
  { href: '/admin/subsections', label: 'Subsections' },
  { href: '/admin/posts', label: 'Posts' },
  { href: '/admin/tags', label: 'Tags' },
  { href: '/admin/profile', label: 'Profile' },
];

export const ADMIN_AUTH_SCREEN_PATHS = ['/admin/login', '/admin/signup'];

/**
 * Which nav entry a URL belongs to. `/admin` is exact so the Dashboard does not
 * light up on every admin route, while section roots also match their future
 * children (`/admin/posts/[slug]`).
 */
export function isActiveAdminRoutePath(pathname: string, href: string): boolean {
  return href === '/admin' ? pathname === '/admin' : pathname === href || pathname.startsWith(`${href}/`);
}

export function isAuthScreenPath(pathname: string): boolean {
  return ADMIN_AUTH_SCREEN_PATHS.includes(pathname);
}
