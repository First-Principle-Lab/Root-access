import { expect, test, type Page } from '@playwright/test';
import { adminCredentials, loginAsAdmin } from './helpers/adminAuth';

/* Checkpoint 10 (docs/admin-redesign-plan.md, "Acceptance tests"): the acceptance rows that had no
   committed automated proof before this iteration.

   - "Regression - Login/logout and route protection still work"  -> the first block.
   - "Content lifecycle ... Verify public pages reflect only published content and expected
     visibility rules" -> the second block.
   - "Structure and profile - create/edit/hide sections and subsections; ... resume. Verify public
     links and content remain correct." -> the third block.
   - "Responsive layout - At 375, 768, and 1440 px, no horizontal page overflow" and the remaining
     accessibility clauses the other specs do not cover ("icons have names", "focus is visible",
     "check contrast") -> the fourth block.

   README 4.10 maps every acceptance row to the named command, test or screenshot that proves it. */

const adminMain = (page: Page) => page.locator('main#admin-main');

const SCREENS = [
  { path: '/admin', title: 'Dashboard' },
  { path: '/admin/sections', title: 'Sections' },
  { path: '/admin/subsections', title: 'Subsections' },
  { path: '/admin/posts', title: 'Posts' },
  { path: '/admin/tags', title: 'Tags' },
  { path: '/admin/profile', title: 'Profile' },
] as const;

const WIDTHS = [1440, 768, 375] as const;

const overflow = (page: Page) =>
  page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );

type LayoutResponse = {
  admin: { name: string; profile: { resumeUrl: string | null } | null };
  sections: {
    id: string;
    name: string;
    subsections: { name: string; slug: string; postCount: number }[];
  }[];
};

/** The public navigation read. Route handlers are uncached, so this is the live shape of the
   published structure; the public pages themselves sit behind the site's 60s ISR window. */
async function publicLayout(page: Page): Promise<LayoutResponse> {
  const response = await page.request.get('/api/public/layout');
  expect(response.ok()).toBe(true);
  return (await response.json()) as LayoutResponse;
}

const publicSlugs = (layout: LayoutResponse) =>
  layout.sections.flatMap((section) => section.subsections.map((sub) => sub.slug));

function row(page: Page, name: string) {
  return adminMain(page).locator('li').filter({ has: page.getByText(name, { exact: true }) });
}

async function cookieNames(page: Page) {
  return (await page.context().cookies()).map((cookie) => cookie.name);
}

/* The public pages are ISR with `revalidate = 60` and a long stale-while-revalidate, so an address
   this suite itself publishes (or a run that stopped mid-publish) can be served from a stale
   artifact for a few minutes. Anything about a draft therefore converges instead of asserting on
   the first response; the published and unknown-address checks below are stable and immediate. */
async function expectStatus(page: Page, path: string, status: number) {
  await expect
    .poll(async () => (await page.request.get(path, { timeout: 15_000 })).status(), {
      intervals: [3_000],
      message: `${path} should be ${status}`,
      timeout: 150_000,
    })
    .toBe(status);
}

async function expectBodyWithout(page: Page, path: string, text: string) {
  await expect
    .poll(
      async () => !(await (await page.request.get(path, { timeout: 15_000 })).text()).includes(text),
      { intervals: [3_000], message: `${path} should not mention ${text}`, timeout: 150_000 }
    )
    .toBe(true);
}

test.describe('acceptance - login, logout and route protection', () => {
  test('the admin is unreachable without a session, and the form signs in and out', async ({
    page,
  }) => {
    await page.context().clearCookies();

    for (const path of ['/admin', '/admin/posts', '/admin/profile']) {
      await page.goto(path);
      await expect(page, `${path} is not protected`).toHaveURL(/\/admin\/login$/);
    }
    expect(await cookieNames(page)).not.toContain('auth-token');

    // the login screen still works end to end through its own form
    await page.getByLabel('Email').fill(adminCredentials.email);
    await page.getByLabel('Secret Key').fill(adminCredentials.secretKey);
    await page.getByRole('button', { name: 'Login', exact: true }).click();
    await expect(page).toHaveURL(/\/admin$/);
    expect(await cookieNames(page)).toContain('auth-token');
    await expect(adminMain(page).getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();

    // the admin API answers with the session
    expect((await page.request.get('/api/admin/stats')).status()).toBe(200);

    // logout clears the cookie and the protection closes again
    await page.getByRole('button', { name: 'Log out' }).first().click();
    await expect(page).toHaveURL(/\/admin\/login$/);
    expect(await cookieNames(page)).not.toContain('auth-token');
    await page.goto('/admin/posts');
    await expect(page).toHaveURL(/\/admin\/login$/);
  });

  test('an unauthenticated admin API request is a 401, and the signup check still answers', async ({
    page,
  }) => {
    await page.context().clearCookies();

    for (const path of [
      '/api/admin/posts',
      '/api/admin/stats',
      '/api/admin/profile',
      '/api/admin/sections',
      '/api/admin/tags',
    ]) {
      expect((await page.request.get(path)).status(), path).toBe(401);
    }

    const signup = await page.request.get('/api/admin/check-signup');
    expect(signup.status()).toBe(200);
    expect(((await signup.json()) as { allowSignup: boolean }).allowSignup).toBe(false);
  });
});

test.describe('acceptance - the public site serves only published, visible content', () => {
  test('home and the archives exclude drafts and the hidden section and subsection', async ({
    page,
  }) => {
    await loginAsAdmin(page);

    // the seed truth, read from the endpoint the posts screen itself uses
    const drafts = (await (
      await page.request.get('/api/admin/posts?status=draft&limit=50')
    ).json()) as { posts: { slug: string; title: string; subsection: { slug: string } }[] };
    expect(drafts.posts.length).toBeGreaterThan(0);

    const home = await page.request.get('/');
    expect(home.status()).toBe(200);
    const homeHtml = await home.text();

    const layout = await publicLayout(page);
    expect(layout.sections.map((s) => s.name)).not.toContain('Draft Playground');
    expect(publicSlugs(layout)).not.toContain('scratch');
    expect(homeHtml).not.toContain('Draft Playground');
    expect(homeHtml).not.toContain('/scratch');

    // no draft is advertised on the home page, not even a draft of a featured project
    for (const draft of drafts.posts) {
      await expectBodyWithout(page, '/', draft.title);
    }

    // an archive lists its published posts and none of the drafts
    const archive = await page.request.get('/engineering');
    expect(archive.status()).toBe(200);
    expect(await archive.text()).toContain('How GNHF schedules long agent runs');
    for (const draft of drafts.posts) {
      await expectBodyWithout(page, '/engineering', draft.title);
    }

    // a draft address is a 404, and so is a hidden subsection and everything under it
    await expectStatus(page, '/books/a-pattern-language', 404);
    await expectStatus(page, '/essays/retrieval-caching-draft', 404);
    await expectStatus(page, '/scratch/hidden-scratch-note', 404);
    expect((await page.request.get('/scratch')).status()).toBe(404);

    // a published post is served, and an unknown address still 404s
    expect((await page.request.get('/engineering/gnhf-scheduling')).status()).toBe(200);
    expect((await page.request.get('/not-a-real-subsection')).status()).toBe(404);
  });

  test('the project, publication, book and quote lists keep their published content', async ({
    page,
  }) => {
    const expected: [string, string][] = [
      ['/projects', 'ChatterStack'],
      ['/publications', 'The cost of a cold start'],
      ['/books', 'The Pragmatic Programmer'],
      ['/quotes', 'Premature optimisation'],
    ];

    for (const [path, text] of expected) {
      const response = await page.request.get(path);
      expect(response.status(), path).toBe(200);
      expect(await response.text(), path).toContain(text);
    }

    // project and publication cards carry their outbound links
    const projects = await (await page.request.get('/projects')).text();
    expect(projects).toMatch(/href="https:\/\/[a-z0-9.-]+\.[a-z]{2,}/i);
  });

  // The public pages are revalidated on a 60s window, so this test polls instead of asserting
  // immediately; it is the only spec that pays that wait, and it is the acceptance table's
  // "refresh after every saved action ... public pages reflect only published content" row.
  test('publishing a draft from the posts screen puts it on the public site, and unpublishing takes it off', async ({
    page,
  }) => {
    test.setTimeout(240_000);
    await loginAsAdmin(page);

    const { posts } = (await (
      await page.request.get('/api/admin/posts?status=draft&limit=50')
    ).json()) as {
      posts: { slug: string; title: string; subsection: { slug: string; displayStyle: string } }[];
    };
    const draft = posts.find(
      (post) => post.subsection.displayStyle === 'BLOG' && post.subsection.slug !== 'scratch'
    );
    if (!draft) throw new Error('the seed needs a publishable draft in a visible blog subsection');
    const archive = `/${draft.subsection.slug}`;

    const archiveLists = async () => (await (await page.request.get(archive)).text()).includes(draft.title);
    const settle = async (wanted: boolean) => {
      await expect
        .poll(archiveLists, { timeout: 150_000, intervals: [4_000] })
        .toBe(wanted);
    };

    expect(await archiveLists(), `${draft.slug} is on the public site before it is published`).toBe(
      false
    );

    await page.goto('/admin/posts');
    await page.getByLabel('Status').selectOption('draft');
    await page.getByLabel('Search').fill(draft.title);
    const postRow = row(page, draft.title);
    await expect(postRow).toHaveCount(1);

    await postRow.getByRole('button', { name: 'Publish' }).click();
    await expect(page.locator('[data-slot="notice"]').first()).toBeVisible();
    await page.reload();
    await expect(row(page, draft.title).getByText('Live')).toBeVisible();
    await settle(true);

    await page.getByLabel('Status').selectOption('all');
    await page.getByLabel('Search').fill(draft.title);
    await row(page, draft.title).getByRole('button', { name: 'Unpublish' }).click();
    await expect(page.locator('[data-slot="notice"]').first()).toBeVisible();
    await page.reload();
    await expect(row(page, draft.title).getByText('Draft')).toBeVisible();
    await settle(false);

    // the database is exactly as it was found
    expect(((await (await page.request.get('/api/admin/posts?status=draft&limit=50')).json()) as {
      total: number;
    }).total).toBe(posts.length);
  });
});

test.describe('acceptance - structure and profile lifecycle through the admin UI', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('a section is created, hidden, shown and deleted, and the public structure follows', async ({
    page,
  }) => {
    const name = `Acceptance ${Date.now()}`;
    let id: string | undefined;

    await loginAsAdmin(page);
    try {
      await page.goto('/admin/sections');
      await expect(adminMain(page).getByRole('heading', { level: 1, name: 'Sections' })).toBeVisible();

      await adminMain(page).getByRole('button', { name: 'New section' }).click();
      await page.getByLabel('Section name').fill(name);
      await page.getByRole('button', { name: 'Create section' }).click();
      await expect(row(page, name)).toBeVisible();

      id = (await publicLayout(page)).sections.find((s) => s.name === name)?.id;
      expect(id, 'the new section never reached the public structure').toBeTruthy();

      // hide it: the row says so and the public structure drops it
      await adminMain(page).getByRole('button', { name: `Edit ${name}` }).click();
      await expect(page.getByRole('heading', { name: 'Edit section' })).toBeVisible();
      await page.getByRole('checkbox', { name: 'Visible on the public site' }).uncheck();
      await page.getByRole('button', { name: 'Save changes' }).click();
      await expect(row(page, name).getByText('Hidden')).toBeVisible();
      expect((await publicLayout(page)).sections.map((s) => s.name)).not.toContain(name);

      // show it again
      await adminMain(page).getByRole('button', { name: `Edit ${name}` }).click();
      await page.getByRole('checkbox', { name: 'Visible on the public site' }).check();
      await page.getByRole('button', { name: 'Save changes' }).click();
      await expect(row(page, name).getByText('Visible')).toBeVisible();
      expect((await publicLayout(page)).sections.map((s) => s.name)).toContain(name);

      // delete it through the dialog that guards the row
      await adminMain(page).getByRole('button', { name: `Delete ${name}` }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await dialog.getByRole('button', { name: 'Delete' }).click();
      await expect(adminMain(page).getByText(name, { exact: true })).toHaveCount(0);
      id = undefined;
    } finally {
      if (id) await page.request.delete(`/api/admin/sections/${id}`);
    }
  });

  test('hiding a subsection drops it from the public structure and showing it puts it back', async ({
    page,
  }) => {
    await loginAsAdmin(page);

    try {
      await page.goto('/admin/subsections');
      await page.getByLabel('Search').fill('Essays');
      await expect(row(page, 'Essays')).toHaveCount(1);

      await row(page, 'Essays').getByRole('button', { name: 'Edit Essays' }).click();
      await page.getByRole('checkbox', { name: 'Visible on the public site' }).uncheck();
      await page.getByRole('button', { name: 'Save changes' }).click();
      await expect(row(page, 'Essays').getByText('Hidden')).toBeVisible();
      expect(publicSlugs(await publicLayout(page))).not.toContain('essays');

      await row(page, 'Essays').getByRole('button', { name: 'Edit Essays' }).click();
      await page.getByRole('checkbox', { name: 'Visible on the public site' }).check();
      await page.getByRole('button', { name: 'Save changes' }).click();
      await expect(row(page, 'Essays').getByText('Visible')).toBeVisible();
      expect(publicSlugs(await publicLayout(page))).toContain('essays');
    } finally {
      await page.request.patch('/api/admin/subsections/essays', { data: { isVisible: true } });
    }
  });

  test('a resume link saves, survives a reload, reaches the public profile read and is restored', async ({
    page,
  }) => {
    await loginAsAdmin(page);
    const stored = (await (await page.request.get('/api/admin/profile')).json()) as {
      profile: { resumeUrl: string | null };
    };
    const original = stored.profile.resumeUrl;
    const replacement = `https://example.com/resume-${Date.now()}.pdf`;

    try {
      await page.goto('/admin/profile');
      await page.getByLabel('Resume link').fill(replacement);
      await page.getByRole('button', { name: 'Save profile' }).click();
      await expect(page.locator('[data-slot="editor-save-state"]')).toHaveAttribute('title', 'Everything on this page is saved.');

      await page.reload();
      await expect(page.getByLabel('Resume link')).toHaveValue(replacement);
      expect((await publicLayout(page)).admin.profile?.resumeUrl).toBe(replacement);
    } finally {
      await page.request.patch('/api/admin/profile', { data: { resumeUrl: original } });
    }
  });
});

test.describe('acceptance - responsive and accessibility sweeps', () => {
  test('every screen keeps its title, its controls and zero horizontal overflow at 1440, 768 and 375', async ({
    page,
  }) => {
    await loginAsAdmin(page);

    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: width === 375 ? 844 : 900 });
      for (const screen of SCREENS) {
        await page.goto(screen.path);
        await expect(
          adminMain(page).getByRole('heading', { level: 1, name: screen.title }),
          `${screen.path} at ${width}px`
        ).toBeVisible();
        // the shell's own controls stay reachable at every width
        await expect(page.getByRole('button', { name: 'Toggle color scheme' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Log out' }).first()).toBeVisible();
        // the content area offers its controls without scrolling sideways
        await expect(adminMain(page).locator('a, button').first()).toBeVisible();
        expect(await overflow(page), `${screen.path} overflows at ${width}px`).toBe(0);
      }

      await page.goto('/admin/posts/new');
      await expect(page.getByRole('heading', { level: 1, name: 'New post' })).toBeVisible();
      expect(await overflow(page), 'the editor overflows').toBe(0);
    }
  });

  test('every visible control on every screen has an accessible name', async ({ page }) => {
    await loginAsAdmin(page);

    for (const screen of [...SCREENS.map((entry) => entry.path), '/admin/posts/new']) {
      await page.goto(screen);
      await expect(adminMain(page).getByRole('heading', { level: 1 })).toBeVisible();

      const unnamed = await page.evaluate(() => {
        const nameOf = (el: Element): string => {
          const attribute = (value: string | null | undefined) => value?.trim() ?? '';
          const own = attribute(el.getAttribute('aria-label'));
          if (own) return own;

          const ids = el.getAttribute('aria-labelledby');
          if (ids) {
            const byId = ids
              .split(/\s+/)
              .map((id) => document.getElementById(id)?.textContent ?? '')
              .join(' ')
              .trim();
            if (byId) return byId;
          }

          const text = (el.textContent ?? '').trim();
          if (text) return text;
          const title = attribute(el.getAttribute('title'));
          if (title) return title;
          const alt = attribute(el.getAttribute('alt'));
          if (alt) return alt;

          if (el instanceof HTMLLabelElement && el.htmlFor) {
            const labelled = document.querySelector(`#${CSS.escape(el.htmlFor)}`);
            const value = attribute(labelled?.getAttribute('aria-label'));
            if (value) return value;
          }
          if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
            const by = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
            const value = (by?.textContent ?? '').trim();
            if (value) return value;
            const wrapped = el.closest('label');
            const wrappedText = (wrapped?.textContent ?? '').trim();
            if (wrappedText) return wrappedText;
          }
          const inside = el.querySelector('img[alt], svg title');
          const insideText = (inside?.textContent ?? inside?.getAttribute('alt') ?? '').trim();
          if (insideText) return insideText;
          return '';
        };

        const isVisible = (el: Element) => {
          const style = getComputedStyle(el);
          if (style.display === 'none' || style.visibility === 'hidden') return false;
          const box = (el as HTMLElement).getBoundingClientRect();
          return box.width > 0 && box.height > 0;
        };

        const selector = [
          'main#admin-main a[href]',
          'main#admin-main button',
          'main#admin-main input',
          'main#admin-main select',
          'main#admin-main textarea',
          'header a[href]',
          'header button',
          'aside a[href]',
          'aside button',
        ].join(', ');

        return Array.from(document.querySelectorAll(selector))
          .filter(isVisible)
          .filter((el) => (el as HTMLInputElement).type !== 'hidden')
          .map((el) => `${el.tagName.toLowerCase()}[${el.className.toString().slice(0, 24)}]: ${nameOf(el)}`)
          .filter((entry) => entry.endsWith(': '))
          .slice(0, 8);
      });

      expect(unnamed, `${screen} has unnamed controls: ${unnamed.join(' | ')}`).toEqual([]);
    }
  });

  test('keyboard focus is visible on the shell, list and editor controls', async ({ page }) => {
    await loginAsAdmin(page);
    await page.setViewportSize({ width: 1440, height: 900 });

    for (const path of ['/admin/posts', '/admin/posts/new', '/admin/profile']) {
      await page.goto(path);
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());

      const rings: { style: string; tag: string; width: string }[] = [];
      for (let i = 0; i < 6; i += 1) {
        await page.keyboard.press('Tab');
        await page.waitForTimeout(320); // the ring colour rides the theme token transition
        const ring = await page.evaluate(() => {
          const el = document.activeElement as HTMLElement | null;
          if (!el || el === document.body) return null;
          const style = getComputedStyle(el);
          return {
            style: style.outlineStyle,
            tag: `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}`,
            width: style.outlineWidth,
          };
        });
        if (ring) rings.push(ring);
      }

      expect(rings.length, `${path} offered nothing to focus`).toBeGreaterThan(3);
      for (const ring of rings) {
        expect(ring.style, `${path}: ${ring.tag} has no outline`).not.toBe('none');
        expect(parseFloat(ring.width), `${path}: ${ring.tag} outline is ${ring.width}`).toBeGreaterThanOrEqual(
          2
        );
      }
    }
  });

  test('the admin token pairs keep WCAG AA contrast in both themes', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin/sections');
    await expect(page.locator('.admin-shell')).toBeVisible();
    // the admin stylesheet is a separate chunk: never read a token before it has landed
    await expect
      .poll(() => page.evaluate(() => getComputedStyle(document.body).getPropertyValue('--admin-bg').trim()))
      .toMatch(/^#/);

    const measure = () =>
      page.evaluate(() => {
        const tokens = getComputedStyle(document.body);
        const read = (name: string) => tokens.getPropertyValue(name).trim();
        const channel = (hex: string) => {
          const value = Number.parseInt(hex, 16) / 255;
          return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
        };
        const luminance = (colour: string) => {
          // lightningcss minifies #bbbbbb to #bbb in the shipped stylesheet
          const short = colour.trim().replace('#', '');
          const hex = short.length === 3 ? short.replace(/./g, (c) => c + c) : short;
          return (
            0.2126 * channel(hex.slice(0, 2)) +
            0.7152 * channel(hex.slice(2, 4)) +
            0.0722 * channel(hex.slice(4, 6))
          );
        };
        const ratio = (fg: string, bg: string) => {
          const a = luminance(fg);
          const b = luminance(bg);
          return Number(((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)).toFixed(2));
        };
        const pairs: [string, string, string][] = [
          ['body text on the page', '--admin-text', '--admin-bg'],
          ['body text on a panel', '--admin-text', '--admin-surface'],
          ['muted text on the page', '--admin-muted', '--admin-bg'],
          ['muted text on a panel', '--admin-muted', '--admin-surface'],
          ['meta text on a panel', '--admin-subtle', '--admin-surface'],
          ['heading on the page', '--admin-heading', '--admin-bg'],
          ['heading on a panel', '--admin-heading', '--admin-surface'],
          ['primary button label', '--admin-primary-text', '--admin-primary-bg'],
          ['error label', '--admin-danger', '--admin-danger-bg'],
          ['live label', '--admin-success', '--admin-success-bg'],
          ['warning label', '--admin-warning', '--admin-warning-bg'],
          ['info label', '--admin-info', '--admin-info-bg'],
        ];
        return {
          theme: document.documentElement.className || 'light',
          ratios: pairs.map(([name, fg, bg]) => ({ name, ratio: ratio(read(fg), read(bg)) })),
        };
      });

    const bothThemes: string[] = [];
    for (let pass = 0; pass < 2; pass += 1) {
      const measured = await measure();
      bothThemes.push(measured.theme);
      for (const entry of measured.ratios) {
        expect(entry.ratio, `${measured.theme}: ${entry.name} is ${entry.ratio}:1`).toBeGreaterThanOrEqual(
          4.5
        );
      }
      await page.getByRole('button', { name: 'Toggle color scheme' }).click();
      await expect
        .poll(() => page.evaluate(() => document.documentElement.className))
        .toMatch(/dark|light/);
    }
    expect(new Set(bothThemes.map((theme) => (theme.includes('dark') ? 'dark' : 'light')))).toEqual(
      new Set(['dark', 'light'])
    );
  });
});
