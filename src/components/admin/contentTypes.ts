import { ArticleIcon, PushPinIcon, RocketIcon } from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';

/* Content-type chrome for the admin (checkpoint 4 of docs/admin-redesign-plan.md).
   The baseline carried this same table, with emoji glyphs, in five files
   (`postListItem`, `postForm`, `PostEditModal`, `SubSection`, `adminDashboard`), which is why
   a content type could and did disagree with itself about its own label. One table, Phosphor
   icons, both key spellings: Prisma serialises the enum upper-case (`BLOG`) while the forms
   and the API payloads use the lower-case input values (`blog`), so `contentTypeFor`
   normalises instead of duplicating every row. */

export type ContentTypeKey = 'blog' | 'project' | 'title_only';

export interface ContentType {
  key: ContentTypeKey;
  icon: Icon;
  /** Short label for dense rows and badges. */
  label: string;
  /** One-line explanation of what the style renders on the public site. */
  description: string;
}

export const CONTENT_TYPES: Record<ContentTypeKey, ContentType> = {
  blog: {
    key: 'blog',
    icon: ArticleIcon,
    label: 'Blog',
    description: 'Timeline of full articles',
  },
  project: {
    key: 'project',
    icon: RocketIcon,
    label: 'Project',
    description: 'Grid of cards with an external link',
  },
  title_only: {
    key: 'title_only',
    icon: PushPinIcon,
    label: 'Title only',
    description: 'Plain list of titles',
  },
};

const KEY_BY_STYLE: Record<string, ContentTypeKey> = {
  blog: 'blog',
  BLOG: 'blog',
  project: 'project',
  PROJECT: 'project',
  title_only: 'title_only',
  TITLE_ONLY: 'title_only',
};

/** Unknown or missing styles fall back to the blog row, as every baseline table did. */
export function contentTypeFor(displayStyle: string | null | undefined): ContentType {
  const key = displayStyle ? KEY_BY_STYLE[displayStyle] : undefined;
  return CONTENT_TYPES[key ?? 'blog'];
}

/** Lower-case form value for a Prisma enum (or an already-lower-case input). */
export function contentTypeKey(displayStyle: string | null | undefined): ContentTypeKey {
  return contentTypeFor(displayStyle).key;
}
