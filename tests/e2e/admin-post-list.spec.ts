import { expect, test, type Page } from '@playwright/test';
import { loginAsAdmin } from './helpers/adminAuth';

/* Checkpoint 6 of docs/admin-redesign-plan.md, the list half: one authenticated list request
   instead of the `PostsManager` fan-out (`allSubsections.map(sub => adminApi.getPosts(sub.slug)
   .catch(() => ({ posts: [] })))`), with search / status / subsection filtering, ordering and
   paging done by the server, a failure that says it failed, and publish state that survives a
   reload. Counts are read back from the same endpoint the screen uses, so the assertions hold
   after a re-seed instead of freezing 17/12/5 into the spec. */

const adminMain = (page: Page) => page.locator('main#admin-main');
const rows = (page: Page) => adminMain(page).locator('[data-slot="post-row"]');

async function listTotal(page: Page, params = ''): Promise<number> {
  const response = await page.request.get(`/api/admin/posts?limit=100${params}`);
  if (!response.ok()) throw new Error(`list request failed: ${response.status()}`);
  const body = (await response.json()) as { total: number };
  return body.total;
}

function trackAdminRequests(page: Page): string[] {
  const seen: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith('/api/admin/')) seen.push(`${url.pathname}${url.search}`);
  });
  return seen;
}

test.describe('posts list on a single authenticated endpoint', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('issues one list request, not one per subsection', async ({ page }) => {
    const requests = trackAdminRequests(page);
    await loginAsAdmin(page);
    await page.goto('/admin/posts');

    await expect(adminMain(page).getByRole('heading', { level: 1, name: 'Posts' })).toBeVisible();
    await expect(rows(page)).toHaveCount(10);

    const total = await listTotal(page);
    await expect(adminMain(page).getByText(`${total} posts`)).toBeVisible();

    // Exactly one call to the list endpoint, and none of the per-subsection fan-out.
    expect(requests.filter((path) => path.split('?')[0] === '/api/admin/posts')).toHaveLength(1);
    expect(requests.filter((path) => /^\/api\/admin\/subsections\/[^/]+\/posts/.test(path))).toHaveLength(0);
    // profile (auth check) + sections (filter options) + the one list call.
    expect(requests).toHaveLength(3);
  });

  test('status, subsection and search filters are applied by the server', async ({ page }) => {
    const requests = trackAdminRequests(page);
    await loginAsAdmin(page);
    await page.goto('/admin/posts');
    await expect(rows(page)).toHaveCount(10);

    await page.getByLabel('Status').selectOption('draft');
    const drafts = await listTotal(page, '&status=draft');
    await expect(adminMain(page).getByText(`${drafts} posts`)).toBeVisible();
    await expect(rows(page)).toHaveCount(drafts);
    await expect(rows(page).locator('[data-published="true"]')).toHaveCount(0);

    await page.getByLabel('Subsection').selectOption('projects');
    const projectPosts = await listTotal(page, '&status=draft&subsection=projects');
    await expect(rows(page)).toHaveCount(projectPosts);
    for (const row of await rows(page).all()) {
      await expect(row).toContainText('Projects');
    }

    /* The subsection select is grouped by section, which is where the section -> subsection ->
       post hierarchy is visible on this screen. (`optgroup` itself is never "visible" to a
       screen reader in the Playwright sense, so the group count is the assertion.) */
    const sectionsResponse = await page.request.get('/api/admin/stats');
    const { sections } = (await sectionsResponse.json()) as { sections: number };
    await expect(page.getByLabel('Subsection').locator('optgroup')).toHaveCount(sections);

    await page.getByLabel('Status').selectOption('all');
    await page.getByLabel('Subsection').selectOption('');
    await page.getByLabel('Search').fill('Pattern');
    await expect(rows(page)).toHaveCount(1);
    await expect(rows(page).first()).toContainText('A Pattern Language');
    expect(requests.some((path) => path.includes('search=Pattern'))).toBe(true);

    await page.getByRole('button', { name: 'Clear filters' }).click();
    const total = await listTotal(page);
    await expect(adminMain(page).getByText(`${total} posts`)).toBeVisible();
    expect(requests.some((path) => path.includes('status=draft'))).toBe(true);
  });

  test('ordering changes the first row without changing the total', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin/posts');
    const total = await listTotal(page);

    await page.getByLabel('Order').selectOption('title');
    await expect(adminMain(page).getByText(`${total} posts`)).toBeVisible();
    // Title A-Z: the seeded "A Pattern Language" leads, and a page of 10 starts there.
    await expect(rows(page).first()).toContainText('A Pattern Language');
    expect(await listTotal(page, '&sort=title')).toBe(total);
  });

  test('pages the result and never repeats a row across pages', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin/posts');

    const firstPageTitles = (await rows(page).allInnerTexts()).join('\n');
    await expect(adminMain(page).getByText(/^Page 1 of 2$/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Previous' })).toBeDisabled();

    await page.getByRole('button', { name: '2' }).click();
    await expect(rows(page).first()).toBeVisible();
    await expect(adminMain(page).getByText(/^Page 2 of 2$/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Next' })).toBeDisabled();
    await expect(page.getByRole('button', { name: '2' })).toHaveAttribute('aria-current', 'page');

    const total = await listTotal(page);
    await expect(rows(page)).toHaveCount(total - 10);
    // No title from page 1 reappears on page 2 (the id tie-break in buildPostListOrderBy).
    for (const row of await rows(page).all()) {
      const title = (await row.innerText()).split('\n')[0];
      expect(firstPageTitles).not.toContain(title);
    }
  });

  test('a failed list is an error with a retry, never an empty list', async ({ page }) => {
    await loginAsAdmin(page);
    await page.route('**/api/admin/posts*', (route) =>
      route.fulfill({ status: 500, json: { message: 'Post service is unavailable' } }),
    );
    await page.goto('/admin/posts');

    const alert = adminMain(page).getByRole('alert');
    await expect(alert).toContainText('Post service is unavailable');
    await expect(rows(page)).toHaveCount(0);
    // The fan-out behaviour this replaces: a failed request used to look like "nothing here".
    await expect(adminMain(page).getByText('No posts yet')).toHaveCount(0);

    await page.unroute('**/api/admin/posts*');
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(rows(page)).toHaveCount(10);
    await expect(alert).toHaveCount(0);
  });

  test('publishing and unpublishing a draft persists across a reload', async ({ page }) => {
    await loginAsAdmin(page);
    const draftsBefore = await listTotal(page, '&status=draft');

    await page.goto('/admin/posts');
    await page.getByLabel('Search').fill('Hidden scratch note');

    const row = rows(page).filter({ hasText: 'Hidden scratch note' });
    await expect(row).toHaveCount(1);
    await expect(row).toContainText('Draft');

    try {
      await row.getByRole('button', { name: /^Publish/ }).click();
      /* The success notice specifically: `getByRole('status')` also matches the list's own
         loading region while the reload is in flight. */
      await expect(adminMain(page).locator('[data-slot="notice"]')).toContainText('Hidden scratch note');
      await expect(row).toContainText('Live');
      expect(await listTotal(page, '&status=draft')).toBe(draftsBefore - 1);

      await page.reload();
      await page.getByLabel('Search').fill('Hidden scratch note');
      await expect(row).toContainText('Live');

      await row.getByRole('button', { name: /^Unpublish/ }).click();
      await expect(row).toContainText('Draft');
      await page.reload();
      await page.getByLabel('Search').fill('Hidden scratch note');
      await expect(row).toContainText('Draft');
      expect(await listTotal(page, '&status=draft')).toBe(draftsBefore);
    } finally {
      // Leave the seeded data exactly as the seed script wrote it, whatever happened above.
      await page.request.patch('/api/admin/subsections/scratch/posts/hidden-scratch-note', {
        data: { published: false },
      });
    }
  });

  test('canceling the delete confirmation changes nothing', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin/posts');
    const before = await listTotal(page);

    await rows(page).first().getByRole('button', { name: /^Delete / }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toHaveCount(0);

    expect(await listTotal(page)).toBe(before);
    await expect(rows(page)).toHaveCount(10);
  });
});

test.describe('posts list at 375px', () => {
  test.use({ viewport: { width: 375, height: 844 } });

  test('keeps its title, filters and row actions with no horizontal overflow', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin/posts');

    await expect(adminMain(page).getByRole('heading', { level: 1, name: 'Posts' })).toBeVisible();
    await expect(adminMain(page).getByRole('button', { name: 'New post' })).toBeVisible();
    await expect(rows(page)).toHaveCount(10);

    // Row actions stay reachable on touch: the delete control is a 44px target.
    const deleteBox = await rows(page).first().getByRole('button', { name: /^Delete / }).boundingBox();
    expect(deleteBox?.height).toBeGreaterThanOrEqual(44);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBe(0);
  });
});
