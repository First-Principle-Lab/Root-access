import { describe, expect, it } from 'vitest';
import {
  EMPTY_POST_DRAFT,
  POST_FIELD_IDS,
  buildPostPayload,
  fieldsForStyle,
  isDraftDirty,
  postEditPath,
  postToDraft,
  splitTags,
  validatePostDraft,
  type PostDraft,
} from '@/src/lib/postEditor';
import type { Post } from '@/src/types';

/* The rules the post editor enforces (checkpoint 6 of docs/admin-redesign-plan.md), tested where
   they live: a draft, a content type, an error object. The two baseline copies of this form had
   these rules written inline in JSX in two different files, so only one of them ever checked the
   project link and neither checked the image value before sending it. */

const draft = (overrides: Partial<PostDraft> = {}): PostDraft => ({
  ...EMPTY_POST_DRAFT,
  ...overrides,
});

describe('post editor field visibility by content type', () => {
  it('shows the project link and archive year only for project posts', () => {
    expect(fieldsForStyle('project').projectLink).toBe(true);
    expect(fieldsForStyle('project').archiveYear).toBe(true);
    expect(fieldsForStyle('blog').projectLink).toBe(false);
    expect(fieldsForStyle('title_only').projectLink).toBe(false);
    expect(fieldsForStyle('title_only').archiveYear).toBe(false);
  });

  it('shows the markdown writing area only where the public site renders a body', () => {
    expect(fieldsForStyle('blog').content).toBe(true);
    expect(fieldsForStyle('project').content).toBe(false);
    expect(fieldsForStyle('title_only').content).toBe(false);
  });

  it('keeps the title-only flow to a title and tags', () => {
    const fields = fieldsForStyle('title_only');
    expect(Object.values(fields).every((shown) => shown === false)).toBe(true);
  });

  it('keeps a cover image available to a writing and a project', () => {
    expect(fieldsForStyle('blog').coverImage).toBe(true);
    expect(fieldsForStyle('project').coverImage).toBe(true);
  });

  it('names a DOM id for every field so errors can be associated and focused', () => {
    expect(POST_FIELD_IDS.title).toBe('post-title');
    expect(POST_FIELD_IDS.coverImage).toBe('post-cover-image');
    expect(POST_FIELD_IDS.subsection).toBe('post-subsection');
  });
});

describe('postToDraft', () => {
  const stored = {
    title: 'Stored post',
    description: 'A description',
    content: '<p>html</p>',
    excerpt: null,
    coverImage: null,
    projectLink: null,
    archiveYear: null,
    tags: [{ id: '1', name: 'ML', slug: 'ml' }, { id: '2', name: 'RL', slug: 'rl' }] satisfies Post['tags'],
  };

  it('turns null columns into empty strings so the inputs stay controlled', () => {
    const result = postToDraft(stored);
    expect(result.excerpt).toBe('');
    expect(result.coverImage).toBe('');
    expect(result.projectLink).toBe('');
    expect(result.archiveYear).toBe('');
  });

  it('joins tag rows back into the comma-separated input value', () => {
    expect(postToDraft(stored).tags).toBe('ML, RL');
  });

  it('round-trips an empty post back to the empty draft', () => {
    const result = postToDraft({ ...stored, title: '', description: '', content: '', tags: [] });
    expect(isDraftDirty(result, EMPTY_POST_DRAFT)).toBe(false);
  });
});

describe('splitTags', () => {
  it('trims entries and drops blanks', () => {
    expect(splitTags(' a ,,  b ,')).toEqual(['a', 'b']);
  });

  it('returns nothing for an empty box', () => {
    expect(splitTags('   ')).toEqual([]);
  });
});

describe('validatePostDraft', () => {
  it('requires a title for every content type', () => {
    expect(validatePostDraft(draft(), 'title_only').title).toBeTruthy();
    expect(validatePostDraft(draft({ title: '   ' }), 'blog').title).toBeTruthy();
  });

  it('preserves the baseline rule that a writing needs content', () => {
    expect(validatePostDraft(draft({ title: 'T', description: 'D' }), 'blog').content).toBe(
      'A writing needs content in the editor.',
    );
    expect(validatePostDraft(draft({ title: 'T', description: 'D', content: 'body' }), 'blog').content).toBeUndefined();
  });

  it('preserves the baseline rule that a project needs its link', () => {
    expect(validatePostDraft(draft({ title: 'T', description: 'D' }), 'project').projectLink).toBe(
      'A project post needs its project link.',
    );
  });

  it('preserves the baseline rule that everything but a title-only entry needs a description', () => {
    expect(validatePostDraft(draft({ title: 'T', content: 'body' }), 'blog').description).toBe(
      'This subsection type needs a description.',
    );
    expect(validatePostDraft(draft({ title: 'T' }), 'title_only').description).toBeUndefined();
  });

  it('rejects a half-typed project link with the shape message, not the required message', () => {
    const errors = validatePostDraft(draft({ title: 'T', description: 'D', projectLink: 'example.com' }), 'project');
    expect(errors.projectLink).toBe('Use a full link starting with https://');
  });

  it('accepts a URL, a site path and an empty cover image but not junk', () => {
    const base = { title: 'T', description: 'D', content: 'body' };
    expect(validatePostDraft(draft({ ...base, coverImage: '/projects/cover.png' }), 'blog').coverImage).toBeUndefined();
    expect(validatePostDraft(draft({ ...base, coverImage: 'https://cdn.test/a.png' }), 'blog').coverImage).toBeUndefined();
    expect(validatePostDraft(draft({ ...base, coverImage: 'cover.png' }), 'blog').coverImage).toBe(
      'Use a full image URL or a site path starting with /',
    );
  });

  it('rejects an archive year that is not a plausible year', () => {
    const base = { title: 'T', description: 'D', projectLink: 'https://example.com/x' };
    expect(validatePostDraft(draft({ ...base, archiveYear: '99' }), 'project').archiveYear).toBeTruthy();
    expect(validatePostDraft(draft({ ...base, archiveYear: '1800' }), 'project').archiveYear).toBeTruthy();
    expect(validatePostDraft(draft({ ...base, archiveYear: '2019' }), 'project').archiveYear).toBeUndefined();
    expect(validatePostDraft(draft({ ...base, archiveYear: '' }), 'project').archiveYear).toBeUndefined();
  });

  it('reports a valid title-only entry as error-free', () => {
    expect(validatePostDraft(draft({ title: 'A quote' }), 'title_only')).toEqual({});
  });
});

describe('isDraftDirty', () => {
  it('is false for a re-created object with the same values', () => {
    const a = draft({ title: 'T', tags: 'x' });
    expect(isDraftDirty(a, { ...a })).toBe(false);
  });

  it('notices a change in any single field', () => {
    const saved = draft({ title: 'T' });
    expect(isDraftDirty(draft({ title: 'T', excerpt: 'new' }), saved)).toBe(true);
    expect(isDraftDirty(draft({ title: 'T2' }), saved)).toBe(true);
  });
});

describe('buildPostPayload', () => {
  it('sends the shapes the endpoints validate', () => {
    const payload = buildPostPayload(
      draft({ title: '  Padded title  ', tags: 'ml, rl', archiveYear: '2019', coverImage: ' /a.png ' }),
    );
    expect(payload).toEqual({
      title: 'Padded title',
      description: '',
      content: '',
      excerpt: '',
      coverImage: '/a.png',
      tags: ['ml', 'rl'],
      projectLink: '',
      archiveYear: 2019,
    });
  });

  it('sends a null year rather than an empty string', () => {
    expect(buildPostPayload(draft({ archiveYear: '  ' })).archiveYear).toBeNull();
  });

  it('keeps a stored value for a field this content type does not show', () => {
    /* Title-only posts have no description box in the editor; whatever is stored is sent back
       unchanged instead of being blanked, and the route owns the title-only rule. */
    const payload = buildPostPayload(draft({ title: 'A quote', description: 'leftover' }));
    expect(payload.description).toBe('leftover');
  });
});

describe('postEditPath', () => {
  it('addresses the post by subsection and slug', () => {
    expect(postEditPath('engineering', 'a-post')).toBe('/admin/posts/edit/engineering/a-post');
  });

  it('encodes slugs that need it', () => {
    expect(postEditPath('a b', 'c/d')).toBe('/admin/posts/edit/a%20b/c%2Fd');
  });
});
