import { contentTypeKey, type ContentTypeKey } from '@/src/components/admin/contentTypes';
import { postDraftSchema } from '@/src/schema/postsSchema';
import type { Post } from '@/src/types';

/* Rules for the post editor page (checkpoint 6 of docs/admin-redesign-plan.md), kept out of the
   component so they can be unit-tested (tests/unit/admin-post-editor.test.ts) and so the create and
   edit screens cannot drift apart the way `postForm.tsx` and `PostEditModal.tsx` had: the two
   baseline copies of this form disagreed about which fields a title-only post shows and only one of
   them validated the project link. */

/** Everything the editor holds while a post is unsaved. Values are strings because they are the
 *  text the person typed; `buildPostPayload` is what turns them into a request body. */
export interface PostDraft {
  title: string;
  description: string;
  content: string;
  excerpt: string;
  coverImage: string;
  tags: string;
  projectLink: string;
  archiveYear: string;
}

export type PostDraftErrors = Partial<Record<keyof PostDraft | 'subsection', string>>;

/* The DOM id of every editor control, in one place: `AdminField` needs an id for its label, a failed
   validation focuses the first offending control (so the message is not only colour), and the tests
   address the same names. Keyed by draft field, hence the snake_case-looking `cover_image`. */
export const POST_FIELD_IDS: Record<keyof PostDraft | 'subsection', string> = {
  title: 'post-title',
  description: 'post-description',
  content: 'post-content',
  excerpt: 'post-excerpt',
  coverImage: 'post-cover-image',
  tags: 'post-tags',
  projectLink: 'post-project-link',
  archiveYear: 'post-archive-year',
  subsection: 'post-subsection',
};

export const EMPTY_POST_DRAFT: PostDraft = {
  title: '',
  description: '',
  content: '',
  excerpt: '',
  coverImage: '',
  tags: '',
  projectLink: '',
  archiveYear: '',
};

/** A stored post is not a draft: tags arrive as rows, and the nullable columns arrive as null. */
export function postToDraft(post: Pick<Post, 'title' | 'description' | 'content' | 'excerpt' | 'coverImage' | 'tags' | 'projectLink' | 'archiveYear'>): PostDraft {
  return {
    title: post.title ?? '',
    description: post.description ?? '',
    content: post.content ?? '',
    excerpt: post.excerpt ?? '',
    coverImage: post.coverImage ?? '',
    tags: (post.tags ?? []).map((tag) => tag.name).join(', '),
    projectLink: post.projectLink ?? '',
    archiveYear: post.archiveYear === null || post.archiveYear === undefined ? '' : String(post.archiveYear),
  };
}

/** Which optional fields a content type actually has. `title` and `tags` are always present.
 *  The plan asks for "project URL and image fields only for project posts" and a "compact"
 *  title-only flow; the cover image stays available to a writing as well because
 *  `src/components/public/PostContent.tsx:36` renders it as the article cover, and hiding the
 *  field would strand that published capability (checkpoint 6 also says "preserve every existing
 *  post field"). A title-only post gets neither: it renders as a bare title in a plain list. */
export interface PostFieldSet {
  coverImage: boolean;
  description: boolean;
  excerpt: boolean;
  content: boolean;
  projectLink: boolean;
  archiveYear: boolean;
}

const FIELD_SETS: Record<ContentTypeKey, PostFieldSet> = {
  blog: { coverImage: true, description: true, excerpt: true, content: true, projectLink: false, archiveYear: false },
  project: { coverImage: true, description: true, excerpt: true, content: false, projectLink: true, archiveYear: true },
  title_only: { coverImage: false, description: false, excerpt: false, content: false, projectLink: false, archiveYear: false },
};

export function fieldsForStyle(style: ContentTypeKey): PostFieldSet {
  return FIELD_SETS[style];
}

/** Comma-separated input to the array the endpoints and `handleTags` expect (baseline behaviour:
 *  trim, drop empties, and let the server uppercase them). */
export function splitTags(raw: string): string[] {
  return raw
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

/** The three style rules the baseline enforced (`PostsManager.handleSubmit`) plus the shape checks
 *  the endpoints would otherwise reject with a 400 after the person pressed Save. Errors are keyed
 *  by field so the editor can hand each one to the `AdminField` it belongs to. */
export function validatePostDraft(draft: PostDraft, style: ContentTypeKey): PostDraftErrors {
  const errors: PostDraftErrors = {};

  const parsed = postDraftSchema.safeParse({
    title: draft.title,
    description: draft.description,
    content: draft.content,
    excerpt: draft.excerpt,
    coverImage: draft.coverImage,
    tags: draft.tags,
    projectLink: draft.projectLink,
    archiveYear: draft.archiveYear,
  });

  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? '');
      if (key in errors) continue;
      if (key === 'title' || key === 'description' || key === 'content' || key === 'excerpt' || key === 'coverImage' || key === 'tags' || key === 'projectLink' || key === 'archiveYear') {
        errors[key] = issue.message;
      }
    }
  }

  const fields = fieldsForStyle(style);

  if (fields.content && !draft.content.trim() && !errors.content) {
    errors.content = 'A writing needs content in the editor.';
  }
  if (fields.projectLink && !draft.projectLink.trim() && !errors.projectLink) {
    errors.projectLink = 'A project post needs its project link.';
  }
  if (fields.description && !draft.description.trim() && !errors.description) {
    errors.description = 'This subsection type needs a description.';
  }

  return errors;
}

/** Field-by-field comparison, so a re-created object with the same text is not "dirty". */
export function isDraftDirty(draft: PostDraft, saved: PostDraft): boolean {
  return (Object.keys(EMPTY_POST_DRAFT) as (keyof PostDraft)[]).some((key) => draft[key] !== saved[key]);
}

/** Request body for both endpoints. Deliberately style-agnostic apart from the year: a field the
 *  editor hides still carries the stored value, so saving a post can never blank out a column that
 *  happens to be invisible in this content type. `published` is not part of the draft (the sticky
 *  bar publishes through the PATCH endpoint) and is added by the caller. */
export function buildPostPayload(draft: PostDraft): Record<string, unknown> {
  return {
    title: draft.title.trim(),
    description: draft.description,
    content: draft.content,
    excerpt: draft.excerpt,
    coverImage: draft.coverImage.trim(),
    tags: splitTags(draft.tags),
    projectLink: draft.projectLink.trim(),
    archiveYear: draft.archiveYear.trim() === '' ? null : Number(draft.archiveYear),
  };
}

/** Editor URL for a stored post. The subsection slug is part of the address because every existing
 *  post endpoint is addressed as `/api/admin/subsections/[slug]/posts/[postSlug]`; carrying it
 *  keeps the page refreshable and linkable without inventing a second set of routes. */
export function postEditPath(subsectionSlug: string, postSlug: string): string {
  return `/admin/posts/edit/${encodeURIComponent(subsectionSlug)}/${encodeURIComponent(postSlug)}`;
}

export const NEW_POST_PATH = '/admin/posts/new';

/** Style of the subsection a post belongs to (or of the subsection picked in the create form). */
export function styleForSubsection(subsections: Array<{ slug: string; displayStyle: string }>, slug: string | null | undefined): ContentTypeKey {
  const match = subsections.find((subsection) => subsection.slug === slug);
  return contentTypeKey(match?.displayStyle);
}
