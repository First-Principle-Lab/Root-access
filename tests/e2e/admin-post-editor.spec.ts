import { expect, test, type Page } from '@playwright/test';
import { loginAsAdmin } from './helpers/adminAuth';

/* The functional core of checkpoint 6 of docs/admin-redesign-plan.md: the post editor page, for
   both halves of "create/edit", walked end to end for every display style against the seeded,
   isolated database — create -> edit -> publish -> unpublish -> reload -> delete, with the row
   count read from the list endpoint before and after each lifecycle so a leak cannot hide.
   It also pins the parts of the plan that are easy to lose again: style-specific validation, the
   project-only fields, the compact title-only flow, an explicit preview, the unsaved-changes
   warning, and the two failure paths a reviewer can actually reproduce here (a failed save and a
   failed image upload - there are no Cloudinary credentials in this environment). */

const adminMain = (page: Page) => page.locator('main#admin-main');
const rows = (page: Page) => adminMain(page).locator('[data-slot="post-row"]');
const saveState = (page: Page) => adminMain(page).locator('[data-slot="editor-save-state"]');

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==',
  'base64',
);

const runId = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e3).toString(36)}`;
const uniqueTitle = (prefix: string) => `${prefix} ${runId}`;

async function postCount(page: Page, params = ''): Promise<number> {
  const response = await page.request.get(`/api/admin/posts?limit=100${params}`);
  if (!response.ok()) throw new Error(`post count failed: ${response.status()}`);
  const body = (await response.json()) as { total: number };
  return body.total;
}

/** Any post of a given subsection, used to reach the editor for an already-seeded row. */
async function firstPostOf(page: Page, subsectionSlug: string) {
  const response = await page.request.get(`/api/admin/posts?subsection=${subsectionSlug}&limit=1`);
  if (!response.ok()) throw new Error(`post lookup failed: ${response.status()}`);
  const body = (await response.json()) as { posts: Array<{ slug: string; title: string; subsection: { slug: string } }> };
  const post = body.posts[0];
  if (!post) throw new Error(`the seed has no post in ${subsectionSlug}`);
  return post;
}

function editorPathFrom(url: string): string {
  const { pathname } = new URL(url);
  return pathname;
}

async function deletePostQuietly(page: Page, subsectionSlug: string, postSlug: string) {
  await page.request.delete(`/api/admin/subsections/${subsectionSlug}/posts/${postSlug}`);
}

/** Reads the slug out of the editor address the create flow redirected to. */
function slugFromEditorPath(pathname: string): string {
  return decodeURIComponent(pathname.split('/').filter(Boolean).pop() ?? '');
}

test.describe('post editor - lifecycle per display style', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  const lifecycle: Array<{
    label: string;
    subsection: string;
    title: string;
    fill: (page: Page) => Promise<void>;
  }> = [
    {
      label: 'writing (blog)',
      subsection: 'engineering',
      title: uniqueTitle('Lifecycle writing'),
      fill: async (page) => {
        await page.getByLabel('Description').fill('A lifecycle summary that the list screen shows.');
        await page.getByLabel('Content', { exact: true }).fill('## Lifecycle heading\n\nA paragraph with **bold** text.');
      },
    },
    {
      label: 'project',
      subsection: 'projects',
      title: uniqueTitle('Lifecycle project'),
      fill: async (page) => {
        await page.getByLabel('Description').fill('A lifecycle project summary.');
        await page.getByLabel('Project link').fill('https://example.com/lifecycle');
        await page.getByLabel('Archive year').fill('2019');
      },
    },
    {
      label: 'title only',
      subsection: 'quotes',
      title: uniqueTitle('Lifecycle quote'),
      fill: async () => {
        /* Nothing else: the compact flow is the point of the style. */
      },
    },
  ];

  for (const scenario of lifecycle) {
    test(`create, edit, publish, unpublish and delete a ${scenario.label} post`, async ({ page }) => {
      await loginAsAdmin(page);
      const before = await postCount(page);
      let created: { subsection: string; slug: string } | null = null;

      try {
        // ---- create as a draft ----
        await page.goto('/admin/posts/new');
        await expect(adminMain(page).getByRole('heading', { level: 1, name: 'New post' })).toBeVisible();
        await page.getByLabel('Subsection').selectOption(scenario.subsection);
        await page.getByLabel('Title').fill(scenario.title);
        await scenario.fill(page);

        await page.getByRole('button', { name: 'Save as draft' }).click();
        await expect(page).toHaveURL(/\/admin\/posts\/edit\/[^/]+\/[^/]+$/);
        created = { subsection: scenario.subsection, slug: slugFromEditorPath(editorPathFrom(page.url())) };

        // The new row exists, is a draft, and is exactly one more than before.
        expect(await postCount(page)).toBe(before + 1);
        expect(await postCount(page, '&status=draft')).toBeGreaterThanOrEqual(1);
        await expect(adminMain(page).locator('[data-slot="editor-save-state"]')).toHaveAttribute('title', 'Everything on this page is saved.');
        await expect(adminMain(page).getByText('Draft', { exact: true })).toBeVisible();

        // ---- edit ----
        const editedTitle = `${scenario.title} (edited)`;
        await page.getByLabel('Title').fill(editedTitle);
        await expect(adminMain(page).locator('[data-slot="editor-save-state"]')).toHaveAttribute('title', 'You have unsaved changes.');
        await page.getByRole('button', { name: 'Save changes' }).click();
        /* Renaming a post renames its address (the PUT regenerates the slug from the title) and the
           editor follows it; the old address is a "post not found" from here on. */
        await expect(page).toHaveURL(/-edited$/);
        await expect(adminMain(page).locator('[data-slot="editor-save-state"]')).toHaveAttribute('title', 'Everything on this page is saved.');

        // ---- reload proves the edit is stored, not just in component state ----
        await page.reload();
        await expect(
          adminMain(page).getByRole('heading', { level: 1, name: `Edit “${editedTitle}”` }),
        ).toBeVisible();

        /* ---- a second edit that does not rename the post: this is the path that keeps the
           inline confirmation, and it reuses a seeded tag so no extra Tag rows are created ---- */
        const tagsResponse = await page.request.get('/api/admin/tags');
        const tagBody = (await tagsResponse.json()) as { tags: Array<{ name: string }> };
        const seededTag = tagBody.tags[0]?.name ?? '';
        await page.getByLabel('Tags').fill(seededTag);
        await expect(adminMain(page).locator('[data-slot="editor-save-state"]')).toHaveAttribute('title', 'You have unsaved changes.');
        await page.getByRole('button', { name: 'Save changes' }).click();
        await expect(adminMain(page).getByText('Your changes are saved.')).toBeVisible();
        await page.reload();
        await expect(page.getByLabel('Tags')).toHaveValue(seededTag);

        // ---- publish, reload, unpublish, reload ----
        await page.getByRole('button', { name: 'Publish' }).click();
        await expect(adminMain(page).getByText('is live on the public site', { exact: false })).toBeVisible();
        await page.reload();
        await expect(adminMain(page).getByText('Live', { exact: true })).toBeVisible();
        expect(await postCount(page, '&status=published')).toBeGreaterThan(0);

        await page.getByRole('button', { name: 'Unpublish' }).click();
        await expect(
          adminMain(page).getByText('no longer on the public site', { exact: false }),
        ).toBeVisible();
        await page.reload();
        await expect(adminMain(page).getByText('Draft', { exact: true })).toBeVisible();

        // publishing never changed how many rows exist
        expect(await postCount(page)).toBe(before + 1);

        // ---- delete from the list screen, through the confirmation dialog ----
        await page.goto('/admin/posts');
        await page.getByLabel('Search').fill(editedTitle);
        const row = rows(page).first();
        await expect(row).toBeVisible();
        await row.getByRole('button', { name: `Delete ${editedTitle}` }).click();
        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();
        await dialog.getByRole('button', { name: 'Delete' }).click();
        await expect(dialog).toHaveCount(0);

        await expect(adminMain(page).getByText('was deleted', { exact: false })).toBeVisible();
        expect(await postCount(page)).toBe(before);
        created = null;
      } finally {
        if (created) {
          // A rename moves the slug, so clean up at whatever address the editor is on now.
          const { pathname } = new URL(page.url());
          const slug = pathname.startsWith('/admin/posts/edit/')
            ? decodeURIComponent(pathname.split('/').pop() ?? created.slug)
            : created.slug;
          await deletePostQuietly(page, created.subsection, slug);
        }
      }
    });
  }
});

test.describe('post editor - fields, preview and warnings', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('shows the project URL and year only for a project, and keeps title-only compact', async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto('/admin/posts/new');
    await page.getByLabel('Subsection').selectOption('quotes');

    await expect(page.getByLabel('Description')).toHaveCount(0);
    await expect(page.getByLabel('Content', { exact: true })).toHaveCount(0);
    await expect(page.getByLabel('Project link')).toHaveCount(0);
    await expect(page.getByLabel('Archive year')).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 2, name: 'Project details' })).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 2, name: 'Cover image' })).toHaveCount(0);
    await expect(adminMain(page).getByText('Plain list of titles on the public site.')).toBeVisible();

    await page.getByLabel('Subsection').selectOption('engineering');
    await expect(page.getByLabel('Content', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Project link')).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 2, name: 'Cover image' })).toBeVisible();

    await page.getByLabel('Subsection').selectOption('projects');
    await expect(page.getByLabel('Project link')).toBeVisible();
    await expect(page.getByLabel('Archive year')).toBeVisible();
    await expect(page.getByLabel('Content', { exact: true })).toHaveCount(0);
  });

  test('style-specific validation blocks the save and names the field', async ({ page }) => {
    await loginAsAdmin(page);
    const before = await postCount(page);

    await page.goto('/admin/posts/new');
    await page.getByLabel('Subsection').selectOption('engineering');
    await page.getByLabel('Title').fill(uniqueTitle('Invalid writing'));
    await page.getByRole('button', { name: 'Save as draft' }).click();

    await expect(page.getByText('This subsection type needs a description.')).toBeVisible();
    await expect(page.getByText('A writing needs content in the editor.')).toBeVisible();
    await expect(adminMain(page).getByText('The post was not saved.', { exact: false })).toBeVisible();
    // The error is wired to the control it belongs to, not just printed above the form.
    await expect(page.getByLabel('Description')).toHaveAttribute('aria-invalid', 'true');
    expect(await page.evaluate(() => document.activeElement?.id)).toBe('post-content');
    expect(await postCount(page)).toBe(before);

    // A half-typed project link is refused before the request too.
    await page.getByLabel('Subsection').selectOption('projects');
    await page.getByLabel('Description').fill('A project summary.');
    await page.getByLabel('Project link').fill('example.com');
    await page.getByRole('button', { name: 'Save as draft' }).click();
    await expect(page.getByText('Use a full link starting with https://')).toBeVisible();
    expect(await postCount(page)).toBe(before);
  });

  test('the preview pane renders the same markdown the published page serves', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin/posts/new');
    await page.getByLabel('Subsection').selectOption('engineering');
    await page.getByLabel('Content', { exact: true }).fill('# Preview heading\n\nSome **bold** text.');

    await page.getByRole('button', { name: 'Preview', exact: true }).click();
    const preview = adminMain(page).locator('[data-slot="markdown-preview"]');
    await expect(preview).toBeVisible();
    await expect(preview.locator('h1')).toHaveText('Preview heading');
    await expect(preview.locator('strong')).toHaveText('bold');
    // Writing is still there when the pane switches back.
    await page.getByRole('button', { name: 'Write', exact: true }).click();
    await expect(page.getByLabel('Content', { exact: true })).toHaveValue('# Preview heading\n\nSome **bold** text.');
  });

  test('leaving with unsaved changes asks, keeps editing on cancel, and saves nothing', async ({
    page,
  }) => {
    await loginAsAdmin(page);
    const before = await postCount(page);
    const title = uniqueTitle('Discarded draft');

    await page.goto('/admin/posts/new');
    await page.getByLabel('Subsection').selectOption('engineering');
    await page.getByLabel('Title').fill(title);
    await expect(adminMain(page).locator('[data-slot="editor-save-state"]')).toHaveAttribute('title', 'You have unsaved changes.');

    await saveState(page).waitFor();
    await page.getByRole('button', { name: 'Back to posts' }).click();
    const dialog = adminMain(page).getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAccessibleName(/Leave without saving/);

    await dialog.getByRole('button', { name: 'Keep editing' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page).toHaveURL(/\/admin\/posts\/new$/);
    await expect(page.getByLabel('Title')).toHaveValue(title);

    await page.getByRole('button', { name: 'Back to posts' }).click();
    await adminMain(page).getByRole('dialog').getByRole('button', { name: 'Discard and leave' }).click();
    await expect(page).toHaveURL(/\/admin\/posts$/);
    expect(await postCount(page)).toBe(before);
  });

  test('a failed save says so and keeps every field', async ({ page }) => {
    await loginAsAdmin(page);
    const post = await firstPostOf(page, 'engineering');

    await page.route('**/api/admin/subsections/**/posts/**', (route) => {
      if (route.request().method() === 'PUT') {
        return route.fulfill({ status: 500, json: { message: 'Post service rejected the save' } });
      }
      return route.fallback();
    });

    await page.goto(`/admin/posts/edit/${post.subsection.slug}/${post.slug}`);
    const original = uniqueTitle('Unsaved round trip');
    await page.getByLabel('Title').fill(original);
    await page.getByLabel('Tags').fill('kept, after, failure');
    await page.getByRole('button', { name: 'Save changes' }).click();

    await expect(
      adminMain(page).getByText('Post service rejected the save', { exact: false }),
    ).toBeVisible();
    await expect(adminMain(page).getByText('Nothing was saved', { exact: false })).toBeVisible();
    // The typed values survive the failure, and the dirty marker is still on.
    await expect(page.getByLabel('Title')).toHaveValue(original);
    await expect(page.getByLabel('Tags')).toHaveValue('kept, after, failure');
    await expect(adminMain(page).locator('[data-slot="editor-save-state"]')).toHaveAttribute('title', 'You have unsaved changes.');

    // And the row really is unchanged on the server.
    await page.unroute('**/api/admin/subsections/**/posts/**');
    const reloaded = await page.request.get(`/api/admin/posts?subsection=engineering&limit=100`);
    const body = (await reloaded.json()) as { posts: Array<{ slug: string; title: string }> };
    expect(body.posts.find((row) => row.slug === post.slug)?.title).not.toBe(original);
  });

  test('a failed cover upload reports it and leaves the form alone', async ({ page }) => {
    await loginAsAdmin(page);
    const post = await firstPostOf(page, 'engineering');
    await page.goto(`/admin/posts/edit/${post.subsection.slug}/${post.slug}`);

    const typedTitle = `${post.title} with a typed cover`;
    await page.getByLabel('Title').fill(typedTitle);
    await page
      .locator('input[type="file"][aria-label="Upload a cover image file"]')
      .setInputFiles({ name: 'cover.png', mimeType: 'image/png', buffer: PNG_1X1 });

    // No Cloudinary credentials exist here, so this is the real server failure, not a mock.
    await expect(adminMain(page).getByText('The cover image is unchanged', { exact: false })).toBeVisible();
    await expect(adminMain(page).getByText('Nothing else on this page was lost', { exact: false })).toBeVisible();
    await expect(page.getByLabel('Title')).toHaveValue(typedTitle);
    // The upload control is usable again rather than stuck in its busy state.
    await expect(page.getByRole('button', { name: 'Upload', exact: true })).toBeEnabled();
    await expect(adminMain(page).locator('[data-slot="editor-save-state"]')).toHaveAttribute('title', 'You have unsaved changes.');
  });
});

test.describe('post editor at 375px', () => {
  test.use({ viewport: { width: 375, height: 844 } });

  test('keeps the writing area full width and the save area reachable with no overflow', async ({
    page,
  }) => {
    await loginAsAdmin(page);
    const post = await firstPostOf(page, 'engineering');
    await page.goto(`/admin/posts/edit/${post.subsection.slug}/${post.slug}`);

    await expect(adminMain(page).getByRole('heading', { level: 1 })).toBeVisible();

    // The writing surface spans the whole content column instead of a modal's inner box.
    const textarea = page.getByLabel('Content', { exact: true });
    await expect(textarea).toBeVisible();
    const box = await textarea.boundingBox();
    // Full width means the content column, not a modal's inner box: at 375px the writing
    // surface still spans most of the viewport.
    expect(box!.width).toBeGreaterThanOrEqual(375 * 0.8);

    /* The persistent save area is a fixed bar, so it is on screen before any scrolling at all
       (this is what "persistent" has to mean here: `body { overflow: hidden auto }` in
       src/app/globals.css makes a sticky bar useless). */
    await expect(adminMain(page).locator('[data-slot="editor-save-bar"]')).toBeInViewport();
    const save = await page.getByRole('button', { name: 'Save changes' }).boundingBox();
    expect(save).not.toBeNull();
    expect(save!.y + save!.height).toBeLessThanOrEqual(844);
    expect(save!.height).toBeGreaterThanOrEqual(44);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBe(0);

    /* The save bar is fixed, so it must sit under the navigation drawer: with the drawer open, the
       element at the bar's own coordinates is the drawer, not the bar (an aria-modal panel may not
       leave live controls on top of it). */
    const bar = adminMain(page).locator('[data-slot="editor-save-bar"]');
    const barBox = await bar.boundingBox();
    await page.getByRole('button', { name: /Open admin navigation|Navigation menu/i }).first().click();
    await expect(page.locator('#admin-nav-drawer')).toBeVisible();
    const topAt = await page.evaluate(
      ([x, y]) => {
        const el = document.elementFromPoint(x, y);
        return {
          inDrawer: el?.closest('#admin-nav-drawer') !== null,
          inBar: el?.closest('[data-slot="editor-save-bar"]') !== null,
          tag: el?.tagName.toLowerCase() ?? '',
        };
      },
      [barBox!.x + barBox!.width / 2, barBox!.y + barBox!.height / 2],
    );
    expect(topAt.inBar).toBe(false);
    expect(topAt.inDrawer).toBe(true);
  });
});
