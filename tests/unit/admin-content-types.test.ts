import { describe, expect, it } from 'vitest';
import { CONTENT_TYPES, contentTypeFor, contentTypeKey } from '../../src/components/admin/contentTypes';

/* The content-type table replaced six emoji rows copied around five admin files. It has to
   answer for both spellings of a display style, because Prisma serialises the enum as `BLOG`
   while the forms and API payloads use the lower-case input value `blog` — the baseline
   carried both keys in every copy, which is the behaviour being pinned here. */
describe('contentTypeFor', () => {
  it('resolves the Prisma enum and the form input to the same row', () => {
    for (const [style, key] of [
      ['BLOG', 'blog'],
      ['blog', 'blog'],
      ['PROJECT', 'project'],
      ['project', 'project'],
      ['TITLE_ONLY', 'title_only'],
      ['title_only', 'title_only'],
    ] as const) {
      expect(contentTypeFor(style).key).toBe(key);
      expect(contentTypeKey(style)).toBe(key);
    }
  });

  it('falls back to blog for an unknown or missing style, as every baseline table did', () => {
    expect(contentTypeFor('nonsense').key).toBe('blog');
    expect(contentTypeFor(null).key).toBe('blog');
    expect(contentTypeFor(undefined).key).toBe('blog');
    expect(contentTypeFor('').key).toBe('blog');
  });

  it('gives every content type an icon and a label, so no badge can fall back to an emoji', () => {
    for (const type of Object.values(CONTENT_TYPES)) {
      /* Phosphor icons are forwardRef objects, not plain functions. */
      const icon = type.icon as unknown;
      expect(typeof icon === 'function' || (typeof icon === 'object' && icon !== null && '$$typeof' in icon)).toBe(true);
      expect(type.label.length).toBeGreaterThan(0);
      expect(type.description.length).toBeGreaterThan(0);
      expect(type.label).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
    }
  });

  it('names the three supported styles and nothing else', () => {
    expect(Object.keys(CONTENT_TYPES).sort()).toEqual(['blog', 'project', 'title_only']);
  });
});
