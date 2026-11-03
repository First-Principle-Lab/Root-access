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

/* Nav entries match the previous emoji sidebar (📊 📁 📂 📝 🏷️ 👤) one-for-one with
   Phosphor icons (docs/admin-redesign-plan.md: "Replace emoji used as navigation or
   content type icons with the existing Phosphor icon family"). Route paths and the
   auth-exempt routes live in ./adminRoutes so the mapping is unit-testable. */
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

export { isActiveAdminRoutePath as isActiveNavItem };

/* Name of the section the current URL belongs to, for the top bar. */
export function currentAdminLocation(pathname: string): AdminNavItem | undefined {
  return ADMIN_NAV_ITEMS.find((item) => isActiveAdminRoutePath(pathname, item.href));
}

