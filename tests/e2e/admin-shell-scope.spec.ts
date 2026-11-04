import { expect, test, type Page } from '@playwright/test';
import { loginAsAdmin } from './helpers/adminAuth';

/* Merge-collision guard (correction checkpoint C11).
   `origin/dev` (PR #1) added a route-level `.admin-shell` wrapper in src/app/admin/layout.tsx
   plus the admin cursor rules, while this branch had its own `.admin-shell` on the root of
   AdminLayout. Merged, every admin page rendered TWO nested shells and every
   `locator('.admin-shell')` assertion died on a strict-mode violation (17 failures on the
   merged tree). The contract these tests hold is therefore: exactly one `.admin-shell` per admin
   route, owned by the route layout so it also covers /admin/login and /admin/signup, and PR #1's
   cursor behaviour still applies - from src/app/admin/admin.css, where those rules now live so
   that admin chrome is styled in one place and globals.css keeps only public selectors. */

const AUTHED_ROUTES = [
  '/admin',
  '/admin/sections',
  '/admin/subsections',
  '/admin/posts',
  '/admin/tags',
  '/admin/profile',
  '/admin/posts/new',
];

async function gotoAuthed(page: Page, path: string) {
  await loginAsAdmin(page);
  await page.goto(path);
}

function computed(page: Page, selector: string, property: string) {
  return page.evaluate(
    ([s, p]) => {
      const el = document.querySelector(s);
      return el ? getComputedStyle(el).getPropertyValue(p) : 'MISSING';
    },
    [selector, property]
  );
}

test.describe('admin shell scope - exactly one shell per route', () => {
  test('every authenticated admin route renders one and only one .admin-shell', async ({
    page,
  }) => {
    for (const path of AUTHED_ROUTES) {
      await gotoAuthed(page, path);
      await expect(page.locator('.admin-shell'), path).toHaveCount(1);
      await expect(page.locator('.admin-shell'), path).toBeVisible();
      // Nested shells are the exact regression: the route layout must not be doubled by
      // AdminLayout re-applying the class.
      expect(await page.evaluate(() => document.querySelectorAll('.admin-shell .admin-shell').length)).toBe(
        0
      );
    }
  });

  test('the route layout owns the shell, so the auth screens are token-scoped too', async ({
    page,
  }) => {
    await page.goto('/admin/login');
    const shell = page.locator('.admin-shell');
    await expect(shell).toHaveCount(1);
    await expect(shell).toBeVisible();
    // --admin-* resolves on this screen even though AdminLayout never renders it, and the shell
    // paints the admin background instead of the browser default.
    await expect
      .poll(() =>
        page.evaluate(() => getComputedStyle(document.body).getPropertyValue('--admin-bg').trim())
      )
      .toMatch(/^#[0-9a-f]{3,6}$/i);
    await expect(shell).toHaveCSS('background-color', 'rgb(5, 5, 5)');
    await expect(shell).toHaveCSS('color', 'rgb(187, 187, 187)');
  });

  test('/admin/signup is scoped by the same shell even when it redirects to login', async ({
    page,
  }) => {
    await page.goto('/admin/signup');
    await expect(page).toHaveURL(/\/admin\/login$/);
    await expect(page.locator('.admin-shell')).toHaveCount(1);
  });
});

test.describe('admin shell scope - PR #1 pointer cursors survive the consolidation', () => {
  test('a native select with no cursor utility of its own gets a pointer', async ({ page }) => {
    await gotoAuthed(page, '/admin/posts');
    await expect(page.getByRole('heading', { level: 1, name: 'Posts' })).toBeVisible();
    await expect(page.locator('[data-slot="admin-select"]')).toHaveCount(3);
    expect(await computed(page, '[data-slot="admin-select"]', 'cursor')).toBe('pointer');
  });

  test('the legacy login submit button keeps its pointer cursor', async ({ page }) => {
    await page.goto('/admin/login');
    const submit = page.getByRole('button', { name: 'Login' });
    await expect(submit).toBeEnabled();
    await expect(submit).toHaveCSS('cursor', 'pointer');
  });

  test('a file input keeps its pointer cursor on a converted screen', async ({ page }) => {
    await gotoAuthed(page, '/admin/profile');
    await expect(page.getByRole('heading', { level: 1, name: 'Profile' })).toBeVisible();
    expect(await computed(page, 'input[type="file"]', 'cursor')).toBe('pointer');
  });

  test('a disabled control still reads as non-interactive', async ({ page }) => {
    await gotoAuthed(page, '/admin/posts');
    const previous = page.getByRole('button', { name: 'Previous' });
    await expect(previous).toBeDisabled();
    await expect(previous).toHaveCSS('cursor', 'not-allowed');
  });
});
