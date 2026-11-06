import { expect, test, type Page } from '@playwright/test';
import { loginAsAdmin } from './helpers/adminAuth';

/* Checkpoint 8 of docs/admin-redesign-plan.md asks for browser tests of the failure paths, and
   checkpoint 6 for "visible loading errors" on every mutation. The earlier specs proved the failed
   post list, the failed profile save, the failed tag create, the failed tag delete, the failed post
   save and the failed cover upload. The mutations that were still unproven are the ones on the
   screens this spec adds: section create, section delete, subsection create, subsection delete, and
   the posts list's publish and delete. Every test reads the affected collection back from the same
   endpoint the screen uses, so "nothing changed" is an assertion about the database rather than
   about the DOM. Two of them are answered by the real API (the duplicate-name refusals in
   src/app/api/admin/sections/route.ts:31 and src/app/api/admin/subsections/route.ts:48) and two by a
   simulated transport failure in the shape the routes actually return; the distinction is stated in
   each test. */

const adminMain = (page: Page) => page.locator('main#admin-main');
const notice = (page: Page) => adminMain(page).locator('[data-slot="notice"]');
const postRows = (page: Page) => adminMain(page).locator('[data-slot="post-row"]');

/** Section rows are `li` elements whose only text is the section name plus its status label. */
const sectionRow = (page: Page, name: string) =>
  adminMain(page).getByRole('listitem').filter({ has: page.getByText(name, { exact: true }) });

/** The subsections screen derives its tree from GET /api/admin/sections, so that is also the
 *  source of truth for "how many subsections exist" here. */
async function readSections(page: Page) {
  const response = await page.request.get('/api/admin/sections');
  if (!response.ok()) throw new Error(`sections read failed: ${response.status()}`);
  const body = (await response.json()) as {
    sections: { id: string; name: string; subsections?: { id: string }[] }[];
  };
  return body.sections;
}

async function sectionCount(page: Page): Promise<number> {
  return (await readSections(page)).length;
}

async function subsectionCount(page: Page): Promise<number> {
  return (await readSections(page)).reduce((sum, s) => sum + (s.subsections?.length ?? 0), 0);
}

async function postTotal(page: Page, params = ''): Promise<number> {
  const response = await page.request.get(`/api/admin/posts?limit=1${params}`);
  if (!response.ok()) throw new Error(`post list failed: ${response.status()}`);
  return ((await response.json()) as { total: number }).total;
}

/** Only the method the test is trying to break is intercepted; reads keep hitting the real API. */
async function failRequests(page: Page, pattern: string, method: string, status: number, message: string) {
  await page.route(pattern, (route) =>
    route.request().method() === method
      ? route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ message }) })
      : route.fallback(),
  );
}

/** Everything the field-level error wiring is supposed to guarantee, read off the live DOM. */
function fieldWiring(page: Page, id: string) {
  return page.evaluate((controlId) => {
    const input = document.getElementById(controlId) as HTMLInputElement | null;
    const describedBy = input?.getAttribute('aria-describedby')?.split(' ').filter(Boolean) ?? [];
    return {
      describedByText: describedBy.map((d) => document.getElementById(d)?.textContent?.trim() ?? null),
      invalid: input?.getAttribute('aria-invalid') ?? null,
      value: input?.value ?? null,
    };
  }, id);
}

test.describe('sections screen - failure paths', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('a duplicate name is refused by the real API on the field, and adds nothing', async ({
    page,
  }) => {
    await loginAsAdmin(page);
    const before = await sectionCount(page);

    await page.goto('/admin/sections');
    await expect(adminMain(page).getByRole('heading', { level: 1, name: 'Sections' })).toBeVisible();
    await page.getByRole('button', { name: 'New section' }).click();

    // 'Writing' is a seeded section, so this is the API's own duplicate answer, not a mock.
    await page.getByLabel('Section name').fill('Writing');
    await page.getByRole('button', { name: 'Create section' }).click();

    await expect(adminMain(page).getByRole('alert')).toHaveText('Section already exists');
    const wiring = await fieldWiring(page, 'section-name');
    expect(wiring.invalid).toBe('true');
    expect(wiring.describedByText).toContain('Section already exists');
    expect(wiring.value).toBe('Writing');

    // Nothing was written: the count and the existing 'Writing' row are untouched.
    expect(await sectionCount(page)).toBe(before);
    await expect(sectionRow(page, 'Writing')).toBeVisible();
    expect(await sectionRow(page, 'Writing').count()).toBe(1);
  });

  test('a delete that fails says so, names the section, and leaves it listed after a reload', async ({
    page,
  }) => {
    await loginAsAdmin(page);
    const before = await sectionCount(page);

    // The route's transport-failure shape (src/app/api/admin/sections/[id]/route.ts:52).
    await failRequests(page, '**/api/admin/sections/*', 'DELETE', 500, 'Something went wrong');

    await page.goto('/admin/sections');
    await page.getByRole('button', { name: 'Delete Writing' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Delete' }).click();

    await expect(dialog).toHaveCount(0);
    await expect(notice(page)).toContainText('Writing was not deleted. Something went wrong');
    await expect(sectionRow(page, 'Writing')).toBeVisible();

    await page.unroute('**/api/admin/sections/*');
    await page.reload();
    await expect(sectionRow(page, 'Writing')).toBeVisible();
    expect(await sectionCount(page)).toBe(before);
  });

  test('canceling the section delete sends nothing and changes nothing', async ({ page }) => {
    await loginAsAdmin(page);
    const before = await sectionCount(page);
    const seen: string[] = [];
    page.on('request', (request) => {
      if (request.method() === 'DELETE') seen.push(new URL(request.url()).pathname);
    });

    await page.goto('/admin/sections');
    await page.getByRole('button', { name: 'Delete Writing' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Cancel' }).click();

    await expect(dialog).toHaveCount(0);
    expect(seen).toEqual([]);
    expect(await sectionCount(page)).toBe(before);
  });
});

test.describe('subsections screen - failure paths', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('a duplicate name inside the same section is refused and every input is kept', async ({
    page,
  }) => {
    await loginAsAdmin(page);
    const before = await subsectionCount(page);

    await page.goto('/admin/subsections');
    await expect(adminMain(page).getByRole('heading', { level: 1, name: 'Subsections' })).toBeVisible();
    await page.getByRole('button', { name: 'New subsection' }).click();

    // 'Engineering' already lives under 'Writing', so the real API answers 409 (route.ts:48).
    await page.getByLabel('Subsection name').fill('Engineering');
    await page.getByLabel('Parent section').selectOption('Writing');
    await page.getByLabel('Visible on the public site').uncheck();
    await page.getByRole('button', { name: 'Create subsection' }).click();

    await expect(notice(page)).toContainText('Subsection already exists in this category');

    // The form is still open with exactly what was typed and picked.
    await expect(page.getByRole('button', { name: 'Create subsection' })).toBeVisible();
    expect(await page.getByLabel('Subsection name').inputValue()).toBe('Engineering');
    expect(await page.getByLabel('Parent section').inputValue()).toBe('Writing');
    expect(await page.getByLabel('Visible on the public site').isChecked()).toBe(false);

    expect(await subsectionCount(page)).toBe(before);
  });

  test('a subsection that still holds posts refuses the delete and stays in its section', async ({
    page,
  }) => {
    await loginAsAdmin(page);
    const before = await subsectionCount(page);

    await page.goto('/admin/subsections');
    await page.getByRole('button', { name: 'Delete Engineering' }).click();
    const dialog = page.getByRole('dialog');
    // The dialog warns about the restriction before the attempt, using the real post count.
    await expect(dialog).toContainText(/posts live in it, so the delete will be refused/);
    await dialog.getByRole('button', { name: 'Delete' }).click();

    // No mock: src/app/api/admin/subsections/[slug]/route.ts:151 answers 409 for a full subsection.
    await expect(dialog).toHaveCount(0);
    await expect(notice(page)).toContainText(
      /Engineering was not deleted\. Cannot delete subsection with \d+ posts/,
    );
    await expect(adminMain(page).getByRole('listitem').filter({ hasText: 'Engineering' })).toBeVisible();

    await page.reload();
    await expect(adminMain(page).getByRole('listitem').filter({ hasText: 'Engineering' })).toBeVisible();
    expect(await subsectionCount(page)).toBe(before);
  });

  test('a subsection list that fails is an error with a retry, not an empty tree', async ({ page }) => {
    await loginAsAdmin(page);
    await failRequests(page, '**/api/admin/sections', 'GET', 500, 'Section service is unavailable');

    await page.goto('/admin/subsections');
    await expect(adminMain(page).getByRole('heading', { level: 1, name: 'Subsections' })).toBeVisible();
    const alert = adminMain(page).getByRole('alert');
    await expect(alert).toContainText('Section service is unavailable');
    await expect(adminMain(page).getByText('No subsections yet')).toHaveCount(0);

    await page.unroute('**/api/admin/sections');
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(adminMain(page).getByRole('listitem').filter({ hasText: 'Engineering' })).toBeVisible();
    await expect(alert).toHaveCount(0);
  });
});

test.describe('profile screen - upload failure path', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  /* A tiny valid 1x1 PNG: the client checks the mime type and the size before it asks the
     server, so the file has to look real for the request to be made at all. */
  const PNG_1X1 = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  );

  test('a failed picture upload is reported, keeps the typed bio, and stores nothing', async ({
    page,
  }) => {
    await loginAsAdmin(page);
    const storedBefore = (await (await page.request.get('/api/admin/profile')).json()) as {
      profile: { bio: string | null; profilePicture: string | null };
    };

    await page.goto('/admin/profile');
    await expect(adminMain(page).getByRole('heading', { level: 1, name: 'Profile' })).toBeVisible();

    const bio = `${storedBefore.profile.bio ?? ''} typed before the upload failed`;
    await page.getByLabel('Bio').fill(bio);
    await page
      .locator('input[type="file"][aria-label="Choose a profile picture file"]')
      .setInputFiles({ name: 'face.png', mimeType: 'image/png', buffer: PNG_1X1 });

    // No Cloudinary credentials exist in this environment, so this is the real 500 from
    // src/app/api/admin/upload/route.ts:26, not a simulated one.
    await expect(notice(page)).toContainText('Your other answers are still here, and the profile picture is unchanged.');
    await expect(page.getByLabel('Bio')).toHaveValue(bio);
    await expect(adminMain(page).locator('[data-slot="editor-save-state"]')).toHaveAttribute('title', 'Unsaved changes');

    // The form was never submitted, so the stored row still holds the seed's bio.
    const storedAfter = (await (await page.request.get('/api/admin/profile')).json()) as {
      profile: { bio: string | null; profilePicture: string | null };
    };
    expect(storedAfter.profile.bio).toBe(storedBefore.profile.bio);
    expect(storedAfter.profile.profilePicture).toBe(storedBefore.profile.profilePicture);
  });
});

test.describe('posts screen - mutation failure paths', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin/posts');
    await page.getByLabel('Search').fill('ChatterStack');
    await expect(postRows(page).filter({ hasText: 'ChatterStack' })).toHaveCount(1);
  });

  test('a publish that fails keeps the post published and says it is unchanged', async ({ page }) => {
    const publishedBefore = await postTotal(page, '&status=published');
    await failRequests(
      page,
      '**/api/admin/subsections/*/posts/*',
      'PATCH',
      500,
      'Publish service is down',
    );

    const row = postRows(page).filter({ hasText: 'ChatterStack' });
    await expect(row).toContainText('Live');
    await row.getByRole('button', { name: 'Unpublish ChatterStack' }).click();

    await expect(notice(page)).toContainText(
      '“ChatterStack” is still published. Publish service is down',
    );
    await expect(row).toContainText('Live');

    await page.unroute('**/api/admin/subsections/*/posts/*');
    await page.reload();
    await page.getByLabel('Search').fill('ChatterStack');
    await expect(postRows(page).filter({ hasText: 'ChatterStack' })).toContainText('Live');
    expect(await postTotal(page, '&status=published')).toBe(publishedBefore);
  });

  test('a delete that fails keeps the post and names it in the error', async ({ page }) => {
    const before = await postTotal(page);
    await failRequests(page, '**/api/admin/subsections/*/posts/*', 'DELETE', 500, 'Something went wrong');

    await postRows(page)
      .filter({ hasText: 'ChatterStack' })
      .getByRole('button', { name: 'Delete ChatterStack' })
      .click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Delete' }).click();

    await expect(dialog).toHaveCount(0);
    await expect(notice(page)).toContainText('“ChatterStack” was not deleted. Something went wrong');
    await expect(postRows(page).filter({ hasText: 'ChatterStack' })).toHaveCount(1);

    await page.unroute('**/api/admin/subsections/*/posts/*');
    await page.reload();
    await page.getByLabel('Search').fill('ChatterStack');
    await expect(postRows(page).filter({ hasText: 'ChatterStack' })).toHaveCount(1);
    expect(await postTotal(page)).toBe(before);
  });
});
