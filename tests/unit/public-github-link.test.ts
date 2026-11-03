import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SocialLinks, type SocialProfile } from '@/src/components/public/SocialLinks';
import { DEFAULT_GITHUB_URL, resolveGithubUrl } from '@/src/lib/githubLink';

/* Checkpoint 7 of docs/admin-redesign-plan.md replaces the two hard-coded GitHub addresses in the
   public components with the profile column, and requires that the icon still resolves to
   https://github.com/parththirwani when nothing has been edited. The rule lives in
   src/lib/githubLink.ts and both public components call it, so it is asserted here twice: once as
   a pure function, and once through the real component render (renderToStaticMarkup, no test-only
   wrapper) so a wiring mistake - reading the wrong key, dropping the fallback - cannot pass. */

const render = (profile: SocialProfile) =>
  renderToStaticMarkup(createElement(SocialLinks, { compact: true, profile }));

const githubHref = (markup: string) => {
  const anchor = markup.split('</a>').find((chunk) => chunk.includes('aria-label="GitHub"'));
  return anchor?.match(/href="([^"]*)"/)?.[1];
};

describe('resolveGithubUrl', () => {
  it('gives the author address to a profile that has never set the column', () => {
    expect(resolveGithubUrl({})).toBe(DEFAULT_GITHUB_URL);
    expect(resolveGithubUrl({ githubLink: null })).toBe(DEFAULT_GITHUB_URL);
    expect(resolveGithubUrl({ githubLink: '   ' })).toBe(DEFAULT_GITHUB_URL);
    expect(resolveGithubUrl(null)).toBe(DEFAULT_GITHUB_URL);
    expect(resolveGithubUrl(undefined)).toBe(DEFAULT_GITHUB_URL);
  });

  it('gives the stored address to a profile that set it', () => {
    expect(resolveGithubUrl({ githubLink: 'https://github.com/someone-else' })).toBe(
      'https://github.com/someone-else',
    );
    expect(resolveGithubUrl({ githubLink: '  https://github.com/someone-else  ' })).toBe(
      'https://github.com/someone-else',
    );
  });

  it('keeps the pre-existing public address as the fallback itself', () => {
    expect(DEFAULT_GITHUB_URL).toBe('https://github.com/parththirwani');
  });
});

describe('SocialLinks GitHub entry', () => {
  it('still points at the author profile when the column is unset', () => {
    const markup = render({ email: 'hello@test.local', xLink: null });
    expect(markup).toContain(`href="${DEFAULT_GITHUB_URL}"`);
    expect(githubHref(markup)).toBe(DEFAULT_GITHUB_URL);
  });

  it('follows an edited value and stops pointing at the old address', () => {
    const markup = render({ githubLink: 'https://github.com/someone-else' });
    expect(markup).toContain('href="https://github.com/someone-else"');
    expect(markup).not.toContain(DEFAULT_GITHUB_URL);
  });

  it('offers GitHub with or without any other social link, as the hard-coded list did', () => {
    const markup = render({});
    expect(markup).toContain('aria-label="GitHub"');
    expect(markup.match(/aria-label="GitHub"/g)).toHaveLength(1);
  });
});
