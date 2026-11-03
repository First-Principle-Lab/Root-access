import { expect, test, type Page } from '@playwright/test';
import { loginAsAdmin } from './helpers/adminAuth';

/* Checkpoint 3 (docs/admin-redesign-plan.md, "Shared shell"): the shell must show an
   unambiguous current location on every admin route, carry a live-site link, a theme
   control on the existing next-themes provider, and logout; the mobile nav must open
   and close with keyboard and screen-reader semantics. */

const ADMIN_SHELL_ROUTES = [
  { path: '/admin', label: 'Dashboard', nav: '/admin' },
  { path: '/admin/sections', label: 'Sections', nav: '/admin/sections' },
  { path: '/admin/subsections', label: 'Subsections', nav: '/admin/subsections' },
  { path: '/admin/posts', label: 'Posts', nav: '/admin/posts' },
  { path: '/admin/tags', label: 'Tags', nav: '/admin/tags' },
  { path: '/admin/profile', label: 'Profile', nav: '/admin/profile' },
];

async function gotoAuthed(page: Page, path: string) {
  await loginAsAdmin(page);
  await page.goto(path);
  await expect(page.locator('.admin-shell')).toBeVisible();
}

function siteLink(page: Page) {
  // `exact` keeps the shell link distinct from the dashboard's legacy "View Site ->" CTA
  return page.getByRole('link', { name: 'View site', exact: true });
}

async function toggleTheme(page: Page) {
  await page.getByRole('button', { name: 'Toggle color scheme' }).click();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.className))
    .toMatch(/dark|light/);
}

test.describe('admin shell - current location on every route', () => {
  for (const route of ADMIN_SHELL_ROUTES) {
    test(`marks ${route.path} as the current location`, async ({ page }) => {
      await gotoAuthed(page, route.path);

      const nav = page.getByRole('navigation', { name: 'Admin sections' });
      const current = nav.locator('a[aria-current="page"]');
      await expect(current).toHaveCount(1);
      await expect(current).toHaveAttribute('href', route.nav);
      await expect(current).toContainText(route.label);

      // top bar names the same location for sighted and SR users
      await expect(page.getByRole('banner').getByRole('heading', { level: 1 })).toHaveText(route.label);

      // every shell affordance is present on every route
      await expect(page.getByRole('navigation', { name: 'Admin sections' })).toBeVisible();
      await expect(siteLink(page).first()).toHaveAttribute('href', '/');
      await expect(page.getByRole('button', { name: 'Toggle color scheme' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Log out' }).first()).toBeVisible();
      await expect(page.locator('main#admin-main')).toBeVisible();
      await expect(page.getByRole('link', { name: 'Skip to main content' })).toBeAttached();
    });
  }

  test('the live-site link opens the public site in a new tab', async ({ page }) => {
    await gotoAuthed(page, '/admin');
    const link = siteLink(page).first();
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', /noopener/);
  });
});

test.describe('admin shell - theme through next-themes', () => {
  test('persists across reload and public <-> admin navigation with no wrong-theme flash', async ({
    page,
    context,
  }) => {
    await gotoAuthed(page, '/admin');

    // next-themes default on this site is dark
    await expect(page.locator('html')).toHaveClass(/dark/);
    await expect(page.locator('.admin-shell')).toHaveCSS('background-color', 'rgb(5, 5, 5)');

    await toggleTheme(page);
    await expect(page.locator('html')).toHaveClass(/^(?!.*dark).*$/);
    await expect(page.locator('.admin-shell')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem('site-theme')))
      .toBe('light');

    // survives reload
    await page.reload();
    await expect(page.locator('html')).toHaveClass(/^(?!.*dark).*$/);
    await expect(page.locator('.admin-shell')).toHaveCSS('background-color', 'rgb(255, 255, 255)');

    // survives admin -> public navigation (the link opens the live site in a new tab)
    const popupPromise = context.waitForEvent('page');
    await siteLink(page).first().click();
    const site = await popupPromise;
    await site.waitForLoadState('domcontentloaded');
    await expect(site.locator('.site-shell')).toBeVisible();
    await expect(site.locator('html')).toHaveClass(/^(?!.*dark).*$/);

    // and public -> admin navigation
    await page.goto('/admin/tags');
    await expect(page.locator('.admin-shell')).toBeVisible();
    await expect(page.locator('html')).toHaveClass(/^(?!.*dark).*$/);
    await expect(page.locator('.admin-shell')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  });

  test('applies the stored preference before first paint (no flash)', async ({ browser }) => {
    // next-themes must apply the stored `site-theme` preference from its blocking head
    // script. A probe inlined at the END of <head> (i.e. after that script has run but
    // before body paint) must already see `light`; a CLASS:dark entry in its trail would
    // be the wrong-theme flash.
    const seed = await browser.newContext();
    const seedPage = await seed.newPage();
    await seedPage.goto('/admin/login');
    await seedPage.evaluate(() => localStorage.setItem('site-theme', 'light'));
    await loginAsAdmin(seedPage);
    const state = await seed.storageState();
    await seed.close();

    const fresh = await browser.newContext({ storageState: state });
    const trail: string[] = [];
    fresh.on('console', (msg) => {
      const text = msg.text();
      if (text.startsWith('TT|')) trail.push(text.slice(3));
    });
    await fresh.route('**/admin/posts*', async (route) => {
      const request = route.request();
      if (request.method() !== 'GET' || request.headers()['rsc'] || !request.isNavigationRequest()) {
        return route.fallback();
      }
      const response = await route.fetch();
      const body = await response.text();
      const probe =
        "<script>(function(){var send=function(s){try{console.log('TT|'+s)}catch(e){}};" +
        'var el=document.documentElement;send("ATPROBE:"+el.className);var last=el.className;' +
        'var obs=new MutationObserver(function(){var c=el.className;if(c!==last){last=c;send("CLASS:"+c)}});' +
        "obs.observe(el,{attributes:true,attributeFilter:['class']});" +
        "document.addEventListener('DOMContentLoaded',function(){send('DCL:'+el.className);obs.disconnect()});})();</script>";
      // replace `</head>` (not insert before the last one) so the probe is the last
      // thing in <head>, i.e. it runs *after* next-themes' blocking script.
      expect(body).toContain('</head>');
      await route.fulfill({ response, body: body.replace('</head>', `${probe}</head>`) });
    });
    const freshPage = await fresh.newPage();
    await freshPage.goto('/admin/posts');
    await expect(freshPage.locator('.admin-shell')).toBeVisible();
    await expect(freshPage.locator('html')).toHaveClass(/^(?!.*dark).*$/);
    await freshPage.waitForLoadState('load');

    // next-themes injects its blocking script at the very top of <body> (after </head>,
    // which is where the end-of-head probe runs), so the probe only ever records the
    // post-script state: the class must be `light` at DOMContentLoaded and must never
    // have been `dark` at any point, i.e. nothing painted under the wrong theme.
    expect(trail.join('\n')).toContain('DCL:light');
    expect(trail.join('\n')).not.toMatch(/dark/);

    const raw = await freshPage.evaluate(
      () => fetch('/admin/posts').then((r) => r.text())
    );
    const body = raw.slice(raw.indexOf('<body'));
    const themeTagStart = body.lastIndexOf('<script', body.indexOf('site-theme'));
    // React's `<div hidden>` host node is not paintable, so the first *rendered*
    // element is the fair comparison for "applied before paint".
    const renderedTags = [
      ...body.matchAll(/<(div|main|header|aside|section|noscript)\b([^>]*)>/g),
    ].filter((m) => !/\shidden(\s|=|>)/.test(m[0]));
    const firstBodyMarkup = renderedTags.length ? renderedTags[0].index : -1;
    expect(themeTagStart).toBeGreaterThan(-1);
    expect(firstBodyMarkup).toBeGreaterThan(-1);
    expect(themeTagStart).toBeLessThan(firstBodyMarkup);
    await fresh.close();
  });

  test('theme switching honours prefers-reduced-motion (no view transition requested)', async ({
    browser,
  }) => {
    const context = await browser.newContext({ reducedMotion: 'no-preference' });
    const page = await context.newPage();
    await loginAsAdmin(page);
    await page.goto('/admin');
    await expect(page.locator('html')).toHaveClass(/dark/);

    // With motion allowed the SpaceUI toggle animates through a view transition;
    // the theme must still end up correct either way.
    await page.getByRole('button', { name: 'Toggle color scheme' }).click();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.classList.contains('dark')))
      .toBe(false);
    await expect(page.locator('.admin-shell')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    await context.close();
  });
});

test.describe('admin shell - mobile navigation', () => {
  test.use({ viewport: { width: 375, height: 844 } });

  test('opens and closes with the keyboard, with accessible state and focus handling', async ({
    page,
  }) => {
    await gotoAuthed(page, '/admin/posts');

    const openButton = page.getByRole('button', { name: 'Open admin navigation' });
    const closeButton = page.getByRole('button', { name: 'Close admin navigation' });
    const drawer = page.locator('#admin-nav-drawer');

    await expect(openButton).toBeVisible();
    await expect(openButton).toHaveAttribute('aria-expanded', 'false');
    await expect(openButton).toHaveAttribute('aria-controls', 'admin-nav-drawer');
    await expect(drawer.getByRole('link', { name: 'Sections' })).toBeHidden();
    await expect(drawer).toHaveCount(1);
    await expect
      .poll(() => page.evaluate(() => document.getElementById('admin-nav-drawer')?.getAttribute('role')))
      .toBeNull();

    // keyboard opens the menu
    await openButton.focus();
    await page.keyboard.press('Enter');
    await expect(closeButton).toBeVisible();
    await expect(openButton).toHaveCount(0);
    await expect(closeButton).toHaveAttribute('aria-expanded', 'true');
    const dialog = page.locator('#admin-nav-drawer[role="dialog"][aria-modal="true"]');
    await expect
      .poll(() => page.evaluate(() => document.getElementById('admin-nav-drawer')?.getAttribute('aria-label')))
      .toBe('Admin navigation');
    await expect(dialog).toBeVisible();

    // focus moves into the drawer
    await expect
      .poll(() =>
        page.evaluate(() => {
          const a = document.activeElement;
          return JSON.stringify({
            tag: a?.tagName,
            label: a?.getAttribute('aria-label'),
            text: a?.textContent?.slice(0, 20),
            inDrawer: a?.closest('#admin-nav-drawer') !== null,
          });
        })
      )
      .toContain('"inDrawer":true');

    // Tab cycles stay inside the open drawer
    const insideDrawer = async () =>
      page.evaluate(() => document.activeElement?.closest('#admin-nav-drawer') !== null);
    for (let i = 0; i < 12; i += 1) {
      await page.keyboard.press('Tab');
      expect(await insideDrawer()).toBe(true);
    }

    // Escape closes it and restores focus to the trigger
    await page.keyboard.press('Escape');
    await expect(openButton).toBeVisible();
    await expect(openButton).toHaveAttribute('aria-expanded', 'false');
    await expect(drawer).toBeHidden();
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            document.activeElement?.getAttribute('aria-label') === 'Open admin navigation'
        )
      )
      .toBe(true);

    // and it can be opened again with the keyboard
    await page.keyboard.press('Space');
    await expect(closeButton).toBeVisible();
  });

  test('closes on navigation and keeps the current location unambiguous', async ({ page }) => {
    await gotoAuthed(page, '/admin');
    await page.getByRole('button', { name: 'Open admin navigation' }).click();
    await drawerLink(page, 'Tags').click();

    await expect(page).toHaveURL(/\/admin\/tags$/);
    await expect(page.locator('#admin-nav-drawer')).toBeHidden();
    await expect(
      page.getByRole('button', { name: 'Open admin navigation' })
    ).toHaveAttribute('aria-expanded', 'false');

    // after navigating, reopen and confirm the current item is marked
    await page.getByRole('button', { name: 'Open admin navigation' }).click();
    const current = page.locator('#admin-nav-drawer').locator('a[aria-current="page"]');
    await expect(current).toHaveCount(1);
    await expect(current).toContainText('Tags');
  });

  test('closes when the scrim is clicked', async ({ page }) => {
    await gotoAuthed(page, '/admin/sections');
    const openButton = page.getByRole('button', { name: 'Open admin navigation' });
    await openButton.click();
    await expect(page.getByRole('dialog', { name: 'Admin navigation' })).toBeVisible();
    await page.mouse.click(340, 500);
    await expect(page.getByRole('dialog', { name: 'Admin navigation' })).toHaveCount(0);
    await expect(openButton).toHaveAttribute('aria-expanded', 'false');
  });

  test('44px touch targets on the navigation controls', async ({ page }) => {
    await gotoAuthed(page, '/admin');
    const box = await page.getByRole('button', { name: 'Open admin navigation' }).boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
    expect(box?.width).toBeGreaterThanOrEqual(44);
  });
});

test.describe('admin shell - desktop', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('sidebar is persistent and the hamburger is not offered', async ({ page }) => {
    await gotoAuthed(page, '/admin/subsections');
    await expect(page.getByRole('button', { name: 'Open admin navigation' })).toBeHidden();
    const nav = page.getByRole('navigation', { name: 'Admin sections' }).first();
    await expect(nav.getByRole('link', { name: 'Subsections', exact: true })).toHaveAttribute(
      'aria-current',
      'page'
    );
    const sidebar = page.locator('aside').filter({ has: nav });
    await expect(sidebar).toBeVisible();
    await expect(sidebar).toHaveCSS('width', '240px');
    await expect(page.locator('main#admin-main')).toBeVisible();
  });

  test('skip link reaches the main content by keyboard', async ({ page }) => {
    await gotoAuthed(page, '/admin');
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.press('Tab');
    await expect
      .poll(() => page.evaluate(() => document.activeElement?.textContent?.trim()))
      .toBe('Skip to main content');
    await page.keyboard.press('Enter');
    await expect
      .poll(() => page.evaluate(() => document.activeElement?.id))
      .toBe('admin-main');
  });

  test('no horizontal overflow at 1440, 768 and 375', async ({ page }) => {
    for (const width of [1440, 768, 375]) {
      await page.setViewportSize({ width, height: 900 });
      await gotoAuthed(page, '/admin/posts');
      await expect
        .poll(() =>
          page.evaluate(
            () => document.documentElement.scrollWidth - document.documentElement.clientWidth
          )
        )
        .toBe(0);
    }
  });
});

function drawerLink(page: Page, name: string) {
  return page.locator('#admin-nav-drawer').getByRole('link', { name, exact: true });
}
