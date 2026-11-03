import { expect, test, type Page } from '@playwright/test';
import { loginAsAdmin } from './helpers/adminAuth';

/* Next.js mounts its own empty `div[role=alert]` route announcer in the document, so every
   alert assertion is scoped to the admin main region. */
const adminMain = (page: Page) => page.locator('main#admin-main');

/* Checkpoint 4 (docs/admin-redesign-plan.md, "Reusable controls"): one accessible
   confirmation dialog replaces every window.confirm, error messages are associated with the
   field they describe, and a failed or cancelled request leaves the data and the user's input
   where they were. Tags is the screen these are exercised on because it is the smallest
   real CRUD surface that reaches the database (src/app/api/admin/tags/[tagSlug]/route.ts),
   so nothing here is stubbed except the two deliberately simulated failures. */

function tagRowFor(page: Page, name: string) {
  return page.getByRole('listitem').filter({ hasText: name });
}

/* These tests create real rows in the isolated test database, so each one removes what it
   added (through the API, with the session cookie `loginAsAdmin` installed) even when the
   assertions fail on the way. Without this the suite leaves `E2E ...` tags behind. */
async function deleteTagViaApi(page: Page, name: string) {
  const response = await page.request.delete(`/api/admin/tags/${encodeURIComponent(name)}`);
  if (!response.ok() && response.status() !== 404) {
    throw new Error(`cleanup of ${name} failed: ${response.status()} ${await response.text()}`);
  }
}

async function createTag(page: Page, name: string) {
  await page.goto('/admin/tags');
  await expect(page.getByRole('heading', { level: 1, name: 'Tags' })).toBeVisible();
  await page.getByRole('button', { name: 'New tag' }).click();
  await page.getByLabel('Tag name').fill(name);
  await page.getByRole('button', { name: 'Create tag' }).click();
  await expect(tagRowFor(page, name)).toBeVisible();
}

async function activeElementProbe(page: Page) {
  return page.evaluate(() => {
    const a = document.activeElement;
    return {
      inDialog: a?.closest('[data-slot="confirm-dialog"]') !== null,
      label: a?.getAttribute('aria-label'),
      text: a?.textContent?.trim().slice(0, 24) ?? '',
      tag: a?.tagName ?? '',
    };
  });
}

test.describe('admin controls - confirmation dialog', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('names the item and the consequence, traps focus, and changes nothing on cancel', async ({
    page,
  }) => {
    const name = `E2E CANCEL ${Date.now()}`;
    await loginAsAdmin(page);
    try {
      await createTag(page, name);

    const trigger = page.getByRole('button', { name: `Delete tag ${name}` });
    await trigger.focus();
    await page.keyboard.press('Enter');

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute('aria-modal', 'true');

    // the accessible name carries both the action and the specific item
    await expect(dialog).toHaveAccessibleName(new RegExp(`Delete tag.*${name}`, 's'));
    await expect(page.getByText('It disappears from the post editor and from the public tag pages', { exact: false })).toBeVisible();

    // initial focus is Cancel, not the destructive control
    await expect
      .poll(async () => (await activeElementProbe(page)).text)
      .toBe('Cancel');

    // Tab (and Shift+Tab) never leave the dialog
    for (let i = 0; i < 8; i += 1) {
      await page.keyboard.press('Tab');
      expect((await activeElementProbe(page)).inDialog).toBe(true);
    }
    for (let i = 0; i < 8; i += 1) {
      await page.keyboard.press('Shift+Tab');
      expect((await activeElementProbe(page)).inDialog).toBe(true);
    }

    // Escape closes it and focus goes back to the row control that opened it
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect
      .poll(async () => (await activeElementProbe(page)).label)
      .toBe(`Delete tag ${name}`);

    // cancelling changed nothing
    await expect(tagRowFor(page, name)).toBeVisible();

    // the Cancel button is the same story
    await trigger.click();
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(tagRowFor(page, name)).toBeVisible();
    } finally {
      await deleteTagViaApi(page, name);
    }
  });

  test('confirming deletes through the real endpoint', async ({ page }) => {
    const name = `E2E DELETE ${Date.now()}`;
    await loginAsAdmin(page);
    await createTag(page, name);
    // the test itself deletes it; this only runs if an assertion fails first

    await page.getByRole('button', { name: `Delete tag ${name}` }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Delete' }).click();

    await expect(dialog).toHaveCount(0);
    await expect(tagRowFor(page, name)).toHaveCount(0);

    // and it is really gone after a reload, not just removed from the DOM
    await page.reload();
    await expect(tagRowFor(page, name)).toHaveCount(0);
  });

  test.afterEach(async ({ page }) => {
    // belt and braces: sweep any E2E row left by a failed assertion
    await loginAsAdmin(page);
    const response = await page.request.get('/api/admin/tags');
    if (!response.ok()) return;
    const { tags } = (await response.json()) as { tags: { slug: string; name: string }[] };
    for (const tag of tags.filter((x) => x.name.startsWith('E2E '))) {
      await page.request.delete(`/api/admin/tags/${encodeURIComponent(tag.slug)}`);
    }
  });

  test('a refused delete is reported inline and the tag stays', async ({ page }) => {
    const name = `E2E REFUSED ${Date.now()}`;
    await loginAsAdmin(page);
    await createTag(page, name);
    try {

    // Simulated exactly as the API answers for a tag that is on posts
    // (src/app/api/admin/tags/[tagSlug]/route.ts:146).
    await page.route('**/api/admin/tags/**', async (route) => {
      if (route.request().method() !== 'DELETE') return route.fallback();
      await route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({
          message: 'Cannot delete tag with 3 associated post(s). Remove the tag from posts first.',
          postCount: 3,
        }),
      });
    });

    await page.getByRole('button', { name: `Delete tag ${name}` }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();

    await expect(adminMain(page).getByRole('alert')).toContainText(
      'Cannot delete tag with 3 associated post(s). Remove the tag from posts first.',
    );
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(tagRowFor(page, name)).toBeVisible();
    } finally {
      await page.unroute('**/api/admin/tags/**');
      await deleteTagViaApi(page, name);
    }
  });

  test('a failed save keeps the typed value and puts the error on the field', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin/tags');
    await page.getByRole('button', { name: 'New tag' }).click();

    // The API's real duplicate-name answer (src/app/api/admin/tags/route.ts:33).
    await page.route('**/api/admin/tags', async (route) => {
      if (route.request().method() !== 'POST') return route.fallback();
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Tag already exists' }),
      });
    });

    const field = page.getByLabel('Tag name');
    await field.fill('LLM');
    await page.getByRole('button', { name: 'Create tag' }).click();

    const error = adminMain(page).getByRole('alert');
    await expect(error).toHaveText('Tag already exists');

    // error is programmatically associated with the control, and the input is marked invalid
    const wiring = await page.evaluate(() => {
      const input = document.getElementById('tag-name') as HTMLInputElement | null;
      const describedBy = input?.getAttribute('aria-describedby')?.split(' ').filter(Boolean) ?? [];
      return {
        describedByIds: describedBy,
        describedByText: describedBy.map((id) => document.getElementById(id)?.textContent?.trim() ?? null),
        invalid: input?.getAttribute('aria-invalid'),
        value: input?.value ?? null,
      };
    });
    expect(wiring.invalid).toBe('true');
    expect(wiring.describedByText).toContain('Tag already exists');
    expect(wiring.value).toBe('LLM');

    await page.unroute('**/api/admin/tags');
  });

  test('the same dialog guards sections, whose delete also takes its subsections', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin/sections');
    await expect(page.getByRole('heading', { level: 1, name: 'Sections' })).toBeVisible();

    const deleteButtons = page.getByRole('button', { name: /^Delete / });
    await expect(deleteButtons.first()).toBeVisible();
    const label = (await deleteButtons.first().getAttribute('aria-label')) ?? '';
    const sectionName = label.replace(/^Delete /, '');
    expect(sectionName.length).toBeGreaterThan(0);

    await deleteButtons.first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toHaveAccessibleName(new RegExp(`Delete section.*${sectionName}`, 's'));
    await expect(
      page.getByText(/deleted with it|disappears from the public navigation/, { exact: false }),
    ).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole('button', { name: `Delete ${sectionName}` })).toBeVisible();
  });

  test('44px targets for the converted controls at 375px', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 844 });
    await loginAsAdmin(page);
    await page.goto('/admin/tags');

    const sizes = [
      ['primary action', page.getByRole('button', { name: 'New tag' })],
      ['row delete', page.getByRole('button', { name: /Delete tag / }).first()],
    ] as const;
    for (const [what, control] of sizes) {
      const box = await control.boundingBox();
      expect(box, what).not.toBeNull();
      expect(box!.height, `${what} height`).toBeGreaterThanOrEqual(44);
      expect(box!.width, `${what} width`).toBeGreaterThanOrEqual(44);
    }

    await page.getByRole('button', { name: /Delete tag / }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    for (const name of ['Cancel', 'Delete']) {
      const box = await dialog.getByRole('button', { name }).boundingBox();
      expect(box!.height, `${name} height`).toBeGreaterThanOrEqual(44);
    }
    // the dialog fits the viewport without horizontal overflow
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth),
    ).toBe(0);
  });
});
