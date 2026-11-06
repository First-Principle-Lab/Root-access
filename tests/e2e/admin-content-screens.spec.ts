import { expect, test, type Page } from '@playwright/test';
import { loginAsAdmin } from './helpers/adminAuth';

/* Checkpoint 5 (docs/admin-redesign-plan.md, "Content screens"): every screen opens with the same
   three things in the same places - a page title, a description of what it is for, and one primary
   action - and the numbers it shows come from the seeded database, not from a fixture. The expected
   counts are read from the same endpoints the screens call, so the assertions stay true after a
   re-seed instead of hard-coding 12/5/7.
   /admin/posts is here too now that checkpoint 6 rebuilt it onto the single list endpoint; its
   deeper behaviour (fan-out gone, paging, publish round trip) is tests/e2e/admin-post-list.spec.ts. */

const adminMain = (page: Page) => page.locator('main#admin-main');

/** The single h1 on the page, which is the PageHeader primitive's, never the top bar's. */
const pageTitle = (page: Page, name: string) =>
  adminMain(page).getByRole('heading', { level: 1, name });

async function seededStats(page: Page) {
  const response = await page.request.get('/api/admin/stats');
  if (!response.ok()) throw new Error(`stats request failed: ${response.status()}`);
  return (await response.json()) as {
    drafts: number;
    published: number;
    sections: number;
    subsections: number;
    tags: number;
  };
}

/** The whole post set, straight from the list endpoint the screen itself calls. */
async function seededPostCount(page: Page): Promise<number> {
  const response = await page.request.get('/api/admin/posts?limit=1');
  if (!response.ok()) throw new Error(`post list failed: ${response.status()}`);
  return ((await response.json()) as { total: number }).total;
}

function rowFor(page: Page, label: string) {
  return adminMain(page)
    .locator('li')
    .filter({ has: page.getByText(label, { exact: true }) });
}

test.describe('content screens - headings, primary actions and seeded data', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('dashboard shows the seeded counts, a route to each screen, and no "Live" control', async ({
    page,
  }) => {
    await loginAsAdmin(page);
    const stats = await seededStats(page);

    await page.goto('/admin');
    await expect(pageTitle(page, 'Dashboard')).toBeVisible();
    await expect(page.getByText('What is live, what is waiting to be published')).toBeVisible();

    // The ambiguous green "Live" button (and its animate-ping dot) is gone.
    await expect(adminMain(page).getByRole('button', { name: /^live$/i })).toHaveCount(0);
    await expect(adminMain(page).locator('.animate-ping')).toHaveCount(0);

    /* "View site" is an ordinary external link, not a call to action. The shell sidebar carries
       its own copy (checkpoint 3), so the dashboard's one is scoped to the main region. */
    const viewSite = adminMain(page).getByRole('link', { name: 'View site' });
    await expect(viewSite).toBeVisible();
    await expect(viewSite).toHaveAttribute('target', '_blank');

    // Every count is the seeded number, and drafts are their own row (the old card hid them).
    await expect(rowFor(page, 'Published posts')).toContainText(String(stats.published));
    await expect(rowFor(page, 'Drafts')).toContainText(String(stats.drafts));
    await expect(rowFor(page, 'Sections')).toContainText(String(stats.sections));
    await expect(rowFor(page, 'Subsections')).toContainText(String(stats.subsections));
    await expect(rowFor(page, 'Tags')).toContainText(String(stats.tags));

    await expect(adminMain(page).getByRole('heading', { level: 2, name: 'Recently edited' })).toBeVisible();
    const recent = adminMain(page)
      .locator('[data-slot="form-section"]')
      .filter({ has: page.getByRole('heading', { level: 2, name: 'Recently edited' }) });
    await expect(recent.getByRole('listitem').first()).toBeVisible();
    await expect(recent.getByRole('link', { name: /^Edit / }).first()).toBeVisible();

    // The draft notice names the same number the row shows.
    await expect(page.getByText(`${stats.drafts} drafts are not on the public site yet.`)).toBeVisible();
  });

  test('sections screen opens with its title and its one primary action', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin/sections');
    await expect(pageTitle(page, 'Sections')).toBeVisible();
    await expect(adminMain(page).getByRole('button', { name: 'New section' })).toBeVisible();
    // The seeded sections are rows, not markup in a fixture.
    await expect(adminMain(page).getByRole('listitem').filter({ hasText: 'Writing' })).toBeVisible();
  });

  test('subsections screen keeps the section -> subsection hierarchy and filters', async ({
    page,
  }) => {
    await loginAsAdmin(page);
    const stats = await seededStats(page);

    await page.goto('/admin/subsections');
    await expect(pageTitle(page, 'Subsections')).toBeVisible();
    await expect(adminMain(page).getByRole('button', { name: 'New subsection' })).toBeVisible();

    // Hierarchy: the seeded parent section is a heading, and its subsections are under it.
    await expect(adminMain(page).getByRole('heading', { level: 2, name: 'Writing' })).toBeVisible();
    const rows = adminMain(page).getByRole('listitem');
    await expect(rows.filter({ hasText: 'Engineering' })).toBeVisible();
    await expect(rows.filter({ hasText: 'Essays' })).toBeVisible();
    // A subsection row says what it is (badge), how big it is (post count) and where it lives.
    await expect(rows.filter({ hasText: 'Engineering' })).toContainText('/engineering');

    await expect(adminMain(page).getByRole('search')).toBeVisible();
    await expect(adminMain(page).getByLabel('Section', { exact: true })).toBeVisible();
    await expect(page.getByText(`${stats.subsections} of ${stats.subsections} subsections`)).toBeVisible();

    // Search narrows the tree to one row without losing the total.
    await page.getByLabel('Search').fill('projects');
    await expect(page.getByText('1 of 7 subsections')).toBeVisible();
    await expect(adminMain(page).getByRole('heading', { level: 2, name: 'Writing' })).toHaveCount(0);
    await expect(adminMain(page).getByRole('heading', { level: 2, name: 'Projects' })).toBeVisible();

    // Visibility filter finds the seeded hidden subsection, and "Clear filters" returns the list.
    await page.getByLabel('Search').fill('');
    await page.getByLabel('Visibility').selectOption('hidden');
    await expect(page.getByText('1 of 7 subsections')).toBeVisible();
    await expect(adminMain(page).getByRole('listitem').filter({ hasText: 'Scratch' })).toBeVisible();
    await page.getByRole('button', { name: 'Clear filters' }).click();
    await expect(page.getByText(`${stats.subsections} of ${stats.subsections} subsections`)).toBeVisible();
  });

  test('posts screen opens with its title, its one primary action and seeded rows', async ({
    page,
  }) => {
    await loginAsAdmin(page);
    const total = await seededPostCount(page);

    await page.goto('/admin/posts');
    await expect(pageTitle(page, 'Posts')).toBeVisible();
    await expect(adminMain(page).getByRole('link', { name: /New post/ })).toBeVisible();
    await expect(adminMain(page).getByRole('search')).toBeVisible();
    for (const label of ['Search', 'Status', 'Subsection', 'Order']) {
      await expect(page.getByLabel(label)).toBeVisible();
    }

    // Rows come from the seeded database, and each one names its section, subsection and state.
    await expect(adminMain(page).getByText(`${total} posts`)).toBeVisible();
    const firstRow = adminMain(page).locator('[data-slot="post-row"]').first();
    await expect(firstRow).toContainText('/');
    await expect(firstRow.getByRole('link', { name: /^Edit / })).toBeVisible();

    // The four stat cards and the green "Live" button are gone from the dashboard; the posts
    // screen must not reintroduce a fake metric either, so the count shown is the endpoint total.
    await expect(adminMain(page).getByText(`${total} posts`)).toHaveCount(1);
  });

  test('tags screen opens with its title and its one primary action', async ({ page }) => {
    await loginAsAdmin(page);
    const stats = await seededStats(page);
    await page.goto('/admin/tags');
    await expect(pageTitle(page, 'Tags')).toBeVisible();
    await expect(adminMain(page).getByRole('button', { name: 'New tag' })).toBeVisible();
    await expect(adminMain(page).getByRole('listitem')).toHaveCount(stats.tags);
  });

  test('profile screen groups the seeded values and its save control is reachable', async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto('/admin/profile');
    await expect(pageTitle(page, 'Profile')).toBeVisible();

    for (const group of ['Picture', 'Bio', 'Contact', 'Social links', 'Resume']) {
      await expect(adminMain(page).getByRole('heading', { level: 2, name: group })).toBeVisible();
    }

    // Real seeded data, not a placeholder.
    await expect(page.getByLabel('Email')).toHaveValue('hello@test.local');
    await expect(page.getByLabel('X (Twitter)')).toHaveValue('https://x.com/parththirwani');
    await expect(page.getByLabel('Bio')).toContainText('CodeMate');

    await expect(page.getByRole('button', { name: 'Save profile' })).toBeVisible();
    await expect(page.locator('[data-slot="editor-save-state"]')).toHaveAttribute('title', 'Everything on this page is saved.');
  });

  test('a failed dashboard request is reported instead of rendering zeros', async ({ page }) => {
    await loginAsAdmin(page);
    // The baseline caught the error, logged it, and showed four big `0` cards.
    await page.route('**/api/admin/stats', (route) => route.abort());
    await page.route('**/api/admin/posts*', (route) => route.abort());
    await page.goto('/admin');

    await expect(adminMain(page).getByRole('alert')).toContainText(/could not be reached|could not be loaded/i);
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
    await expect(adminMain(page).getByText('Published posts')).toHaveCount(0);
  });

  test('a failed profile save keeps what was typed', async ({ page }) => {
    await loginAsAdmin(page);
    await page.route('**/api/admin/profile', (route) =>
      route.request().method() === 'PATCH' ? route.fulfill({ json: { message: 'Profile service is down' }, status: 500 }) : route.fallback(),
    );
    await page.goto('/admin/profile');
    await expect(page.getByLabel('Bio')).toBeVisible();

    await page.getByLabel('Bio').fill('A bio that will not save.');
    await page.getByRole('button', { name: 'Save profile' }).click();

    await expect(adminMain(page).getByRole('alert')).toContainText('Profile service is down');
    await expect(page.getByLabel('Bio')).toHaveValue('A bio that will not save.');
    await expect(page.locator('[data-slot="editor-save-state"]')).toHaveAttribute('title', 'Unsaved changes');
  });
});

test.describe('content screens at 375px', () => {
  test.use({ viewport: { width: 375, height: 844 } });

  for (const [path, title] of [
    ['/admin', 'Dashboard'],
    ['/admin/sections', 'Sections'],
    ['/admin/subsections', 'Subsections'],
    ['/admin/posts', 'Posts'],
    ['/admin/tags', 'Tags'],
    ['/admin/profile', 'Profile'],
  ] as const) {
    test(`${path} keeps its title and primary action with no horizontal overflow`, async ({
      page,
    }) => {
      await loginAsAdmin(page);
      await page.goto(path);
      await expect(pageTitle(page, title)).toBeVisible();

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBe(0);
    });
  }
});

test.describe('profile save round-trip on the isolated database', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  /* The screen is only redesigned if the save actually lands. This writes to the single Profile
     row of the ISOLATED `rootaccess_admin_dev` database and puts the stored values back in the
     finally block, including the one field the API can now clear (the profile route used to
     swallow an explicit null, so deleting a link saved successfully and changed nothing). */
  test('a saved bio survives a reload and a cleared link stays cleared', async ({ page }) => {
    await loginAsAdmin(page);
    const before = (await (await page.request.get('/api/admin/profile')).json()) as {
      profile: Record<string, string | null>;
    };

    /* Only the two fields this test touches are written back. The route leaves an absent field
       alone, so the rest of the seeded row (picture, resume, email) keeps the exact bytes it had,
       and the database ends the run where the seed script left it. */
    const restore = {
      bio: before.profile.bio,
      xLink: before.profile.xLink || null,
    };

    try {
      await page.goto('/admin/profile');
      const marker = `Saved by Playwright ${Date.now()}`;
      await page.getByLabel('Bio').fill(marker);
      await page.getByLabel('X (Twitter)').fill('');
      await expect(page.locator('[data-slot="editor-save-state"]')).toHaveAttribute('title', 'Unsaved changes');

      await page.getByRole('button', { name: 'Save profile' }).click();
      await expect(page.getByText('Profile saved.')).toBeVisible();
      await expect(page.locator('[data-slot="editor-save-state"]')).toHaveAttribute('title', 'Everything on this page is saved.');

      /* Deliberately not `waitUntil: 'networkidle'`: Chromium answers the first reload of this page
         from its cache, Playwright then waits for a network event that never arrives, and the
         navigation only gives up after the 30s timeout. `load` plus the auto-waiting assertions
         below check exactly the same thing. */
      await page.reload();
      await expect(page.getByLabel('Bio')).toHaveValue(marker);
      await expect(page.getByLabel('X (Twitter)')).toHaveValue('');

      const persisted = (await (await page.request.get('/api/admin/profile')).json()) as {
        profile: { bio: string | null; xLink: string | null };
      };
      expect(persisted.profile.bio).toBe(marker);
      expect(persisted.profile.xLink).toBeNull();
    } finally {
      const response = await page.request.patch('/api/admin/profile', { data: restore });
      if (!response.ok()) {
        throw new Error(`profile restore failed: ${response.status()} ${await response.text()}`);
      }
    }
  });
});
