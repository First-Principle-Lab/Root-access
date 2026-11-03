import { expect, test, type Page } from '@playwright/test';
import { loginAsAdmin } from './helpers/adminAuth';

/* Checkpoint 7 of docs/admin-redesign-plan.md in the browser: the GitHub address the public icon
   points at is now a profile field instead of markup, and the two properties that matter are that
   nothing changed for a reader on the day the column ships (the icon still resolves to
   https://github.com/parththirwani, the value the migration backfills) and that the owner can change
   it from the profile screen. The shared profile row of the ISOLATED `rootaccess_admin_dev` database
   is read first and written back at the end of every test that edits it.
   The public page assertions are deliberately the *unmodified* value: the public routes revalidate on
   a 60 second window (`export const revalidate = 60` in src/app/(site)/layout.tsx and page.tsx, plus
   the `unstable_cache(..., { revalidate: 60 })` in SidebarServer.tsx), so a DOM assertion about a
   value this suite just changed would depend on that timer. The edited value is asserted on the
   uncached public read (`/api/public/layout`) that the profile-driven public components consume. */

const AUTHOR_URL = 'https://github.com/parththirwani';
const EDITED_URL = 'https://github.com/edited-by-playwright.test';

const desktopGithubLink = (page: Page) => page.locator('.site-desktop-socials a[aria-label="GitHub"]');
const homeGithubLink = (page: Page) =>
  page.locator('#main-content .site-social-links a').filter({ hasText: 'GitHub' });
const socialSection = (page: Page) =>
  page
    .locator('[data-slot="form-section"]')
    .filter({ has: page.getByRole('heading', { level: 2, name: 'Social links' }) });
const githubField = (page: Page) => page.getByLabel('GitHub', { exact: true });

async function storedGithubLink(page: Page): Promise<string | null> {
  const response = await page.request.get('/api/admin/profile');
  if (!response.ok()) throw new Error(`profile read failed: ${response.status()}`);
  const body = (await response.json()) as { profile: { githubLink: string | null } };
  return body.profile.githubLink;
}

/** Writes the profile back through the same endpoint the form uses. */
async function restoreGithubLink(page: Page, value: string | null) {
  const response = await page.request.patch('/api/admin/profile', { data: { githubLink: value } });
  if (!response.ok()) throw new Error(`restore failed: ${response.status()}`);
}

async function layoutGithubLink(page: Page): Promise<string | null> {
  const response = await page.request.get('/api/public/layout');
  if (!response.ok()) throw new Error(`layout read failed: ${response.status()}`);
  const body = (await response.json()) as { admin: { profile: { githubLink: string | null } } };
  return body.admin.profile.githubLink;
}

test.describe('public site reads the GitHub link from the profile', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('the sidebar and home icons point at the address the migration backfills', async ({
    page,
  }) => {
    await loginAsAdmin(page);
    const stored = await storedGithubLink(page);
    const expected = stored && stored.length > 0 ? stored : AUTHOR_URL;

    await page.goto('/');
    await expect(desktopGithubLink(page)).toHaveAttribute('href', expected);
    await expect(homeGithubLink(page)).toHaveAttribute('href', expected);
    expect(expected).toBe(AUTHOR_URL);
  });

  test('the sidebar offers exactly one named GitHub icon, opening in a new tab', async ({ page }) => {
    await page.goto('/');
    await expect(desktopGithubLink(page)).toHaveCount(1);
    await expect(desktopGithubLink(page)).toHaveAttribute('target', '_blank');
    await expect(desktopGithubLink(page)).toHaveAttribute('rel', /noopener/);
  });
});

test.describe('admin profile GitHub field', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('sits in the social links group, prefilled with the stored address', async ({ page }) => {
    await loginAsAdmin(page);
    const stored = await storedGithubLink(page);

    await page.goto('/admin/profile');
    await expect(socialSection(page).getByRole('heading', { level: 2, name: 'Social links' })).toBeVisible();
    await expect(githubField(page)).toBeVisible();
    await expect(socialSection(page).getByLabel('GitHub', { exact: true })).toHaveValue(stored ?? '');
    await expect(page.getByLabel('X (Twitter)')).toBeVisible();
  });

  test('refuses a half-typed address on the field itself and sends nothing', async ({ page }) => {
    await loginAsAdmin(page);
    let patches = 0;
    page.on('request', (request) => {
      if (request.method() === 'PATCH' && request.url().includes('/api/admin/profile')) patches += 1;
    });

    await page.goto('/admin/profile');
    await expect(githubField(page)).toBeEditable();
    await githubField(page).fill('github.com/parththirwani');
    await expect(page.getByText('Unsaved changes')).toBeVisible();
    await page.getByRole('button', { name: 'Save profile' }).click();

    await expect(githubField(page)).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByText('GitHub link must be a full address starting with https://')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save profile' })).toBeVisible();
    expect(patches).toBe(0);

    // The field keeps the typo for fixing, and the stored link is untouched.
    await expect(githubField(page)).toHaveValue('github.com/parththirwani');
    expect(await storedGithubLink(page)).not.toBe('github.com/parththirwani');
  });

  test('an edited address saves, survives a reload, and reaches the public layout read', async ({
    page,
  }) => {
    await loginAsAdmin(page);
    const stored = await storedGithubLink(page);

    try {
      await page.goto('/admin/profile');
      await githubField(page).fill(EDITED_URL);
      await page.getByRole('button', { name: 'Save profile' }).click();
      await expect(page.getByText('Profile saved.')).toBeVisible();

      await page.reload();
      await expect(githubField(page)).toHaveValue(EDITED_URL);
      expect(await storedGithubLink(page)).toBe(EDITED_URL);
      expect(await layoutGithubLink(page)).toBe(EDITED_URL);
    } finally {
      await restoreGithubLink(page, stored);
    }
  });

  test('an emptied field saves as null so the public icon falls back to the author address', async ({
    page,
  }) => {
    await loginAsAdmin(page);
    const stored = await storedGithubLink(page);

    try {
      await page.goto('/admin/profile');
      await githubField(page).fill('');
      await page.getByRole('button', { name: 'Save profile' }).click();
      await expect(page.getByText('Profile saved.')).toBeVisible();

      expect(await storedGithubLink(page)).toBeNull();
      expect(await layoutGithubLink(page)).toBeNull();
      await page.reload();
      await expect(githubField(page)).toHaveValue('');
      await expect(
        page.getByText('Leave empty to keep the default address the public icon already points at.'),
      ).toBeVisible();
    } finally {
      await restoreGithubLink(page, stored);
    }

    expect(await storedGithubLink(page)).toBe(stored);
  });
});
