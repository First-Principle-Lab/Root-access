import {
  ArticleIcon,
  FolderIcon,
  FolderOpenIcon,
  SquaresFourIcon,
  TagIcon,
  UserIcon,
} from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';
import { ADMIN_ROOT_ROUTES, isActiveAdminRoutePath } from './adminRoutes';

export { isAuthScreenPath } from './adminRoutes';

export interface AdminNavItem {
  href: string;
  label: string;
  icon: Icon;
}

const NAV_ICONS: Record<string, Icon> = {
  '/admin': SquaresFourIcon,
  '/admin/sections': FolderIcon,
  '/admin/subsections': FolderOpenIcon,
  '/admin/posts': ArticleIcon,
  '/admin/tags': TagIcon,
  '/admin/profile': UserIcon,
};

export const ADMIN_NAV_ITEMS: AdminNavItem[] = ADMIN_ROOT_ROUTES.map((route) => ({
  ...route,
  icon: NAV_ICONS[route.href],
}));

const byHref = (href: string) => ADMIN_NAV_ITEMS.find((item) => item.href === href)!;

/* Writing comes first because it is what the admin is opened for; the site structure and the
   profile change far less often. */
export const ADMIN_NAV_GROUPS: { label: string; items: AdminNavItem[] }[] = [
  { label: 'Overview', items: [byHref('/admin')] },
  { label: 'Content', items: [byHref('/admin/posts'), byHref('/admin/tags')] },
  { label: 'Structure', items: [byHref('/admin/sections'), byHref('/admin/subsections')] },
  { label: 'Site', items: [byHref('/admin/profile')] },
];

export { isActiveAdminRoutePath as isActiveNavItem };

/* Name of the section the current URL belongs to, for the mobile top bar. */
export function currentAdminLocation(pathname: string): AdminNavItem | undefined {
  return ADMIN_NAV_ITEMS.find((item) => isActiveAdminRoutePath(pathname, item.href));
}
