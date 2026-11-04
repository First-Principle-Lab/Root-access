import { expect, test, type Page } from '@playwright/test';

async function cardBackground(page: Page) {
  return page.locator('main form').evaluate((form) => getComputedStyle(form.parentElement!).backgroundColor);
}

async function hasNoHorizontalOverflow(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
}

test('login follows the admin theme on desktop and mobile and retains errors', async ({ page }) => {
  await page.goto('/admin/login');
  await expect(page.getByRole('heading', { name: 'Admin Login' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Toggle color scheme' })).toBeVisible();
  expect(await cardBackground(page)).toBe('rgb(15, 15, 15)');

  await page.getByRole('button', { name: 'Toggle color scheme' }).click();
  await expect.poll(() => cardBackground(page)).toBe('rgb(250, 250, 250)');
  await page.setViewportSize({ width: 375, height: 844 });
  expect(await hasNoHorizontalOverflow(page)).toBe(true);
  await expect(page.getByLabel('Email')).toBeVisible();
  await expect(page.getByLabel('Secret Key')).toBeVisible();

  await page.route('**/api/admin/login', (route) => route.fulfill({
    status: 401,
    contentType: 'application/json',
    body: JSON.stringify({ message: 'Invalid credentials' }),
  }));
  await page.getByLabel('Email').fill('reader@example.com');
  await page.getByLabel('Secret Key').fill('wrong-key');
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page.locator('#login-error')).toContainText('Invalid credentials');
  await expect(page.getByLabel('Email')).toHaveValue('reader@example.com');
  await expect(page.getByLabel('Secret Key')).toHaveValue('wrong-key');
  await expect(page.getByLabel('Email')).toHaveAttribute('aria-describedby', /login-error/);
});

test('signup follows the same theme and keeps input after a failed request', async ({ page }) => {
  await page.route('**/api/admin/check-signup', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ allowSignup: true }),
  }));
  await page.route('**/api/admin/signup', (route) => route.fulfill({
    status: 500,
    contentType: 'application/json',
    body: JSON.stringify({ message: 'Signup unavailable' }),
  }));

  await page.setViewportSize({ width: 375, height: 844 });
  await page.goto('/admin/signup');
  await expect(page.getByRole('heading', { name: 'Admin Signup' })).toBeVisible();
  expect(await cardBackground(page)).toBe('rgb(15, 15, 15)');
  expect(await hasNoHorizontalOverflow(page)).toBe(true);

  await page.getByRole('button', { name: 'Toggle color scheme' }).click();
  await expect.poll(() => cardBackground(page)).toBe('rgb(250, 250, 250)');
  await page.setViewportSize({ width: 1440, height: 900 });
  expect(await hasNoHorizontalOverflow(page)).toBe(true);
  await page.getByLabel('Name').fill('New Admin');
  await page.getByLabel('Email').fill('new@example.com');
  await page.getByLabel('Secret Key').fill('example-secret');
  await page.getByRole('button', { name: 'Sign Up' }).click();
  await expect(page.locator('#signup-error')).toContainText('Signup unavailable');
  await expect(page.getByLabel('Name')).toHaveValue('New Admin');
  await expect(page.getByLabel('Secret Key')).toHaveValue('example-secret');
  await expect(page.getByLabel('Secret Key')).toHaveAttribute('aria-describedby', /signup-error/);
});
