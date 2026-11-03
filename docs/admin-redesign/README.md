# Admin redesign — audit and design specification

Phase 1 of `docs/admin-redesign-plan.md`. This folder holds the pre-change audit of
`/admin`, the design specification that phase 2 and 3 build against, and the two
representative mockups (dashboard, post editor) at desktop and mobile widths in both
themes. Nothing here changes application code; the tokens and rules below are the
contract for the implementation checkpoints. Update: checkpoint 2 (the admin token set) is
now implemented in `src/app/admin/admin.css`; §4.1 records what shipped, what later
checkpoints still have to consume, and the measurements that prove it.

Everything was captured on the pre-change tree at commit `3b4d897`
(`origin/dev` + test tooling) against the isolated database `rootaccess_admin_dev`
re-seeded from `/tmp/cora/seed.sql`: 6 sections (1 hidden), 7 subsections (1 hidden),
17 posts (5 drafts), 4 tags, admin account `admin@test.local`.

```sh
export HOME=/root PLAYWRIGHT_BROWSERS_PATH=/root/.cache/ms-playwright
npm run build                                   # exit 0, evidence cp1-build.log
npx next start -p 3099                          # detached; /admin/login -> 200
node /tmp/cora/cp1-shots.mjs                    # 28 "before" screenshots
node /tmp/cora/cp1-probe.mjs                    # overflow / control counts per route
node /tmp/cora/cp1-mockups.mjs                  # 10 mockup screenshots
```

Raw command output is kept outside the repo in `/tmp/cora/evidence/`
(`cp1-build.log`, `cp1-shots.log`, `cp1-layout-probe.log`, `cp1-mockups.log`,
`cp1-posts-fanout.log`).

## 1. Baseline screenshots (pre-change)

Captured at 1440 × 900 and 375 × 844, `fullPage`, authenticated through
`POST /api/admin/login` with the seeded test account. `/admin/login` is captured
anonymously. The theme column is set with `localStorage['site-theme']` before paint,
which is what the `next-themes` provider reads (`src/app/layout.tsx:45`).

| Screen | Desktop dark | Desktop light | Mobile dark | Mobile light |
| --- | --- | --- | --- | --- |
| Dashboard `/admin` | [png](before/dashboard-desktop-dark.png) | [png](before/dashboard-desktop-light.png) | [png](before/dashboard-mobile-dark.png) | [png](before/dashboard-mobile-light.png) |
| Sections `/admin/sections` | [png](before/sections-desktop-dark.png) | [png](before/sections-desktop-light.png) | [png](before/sections-mobile-dark.png) | [png](before/sections-mobile-light.png) |
| Subsections `/admin/subsections` | [png](before/subsections-desktop-dark.png) | [png](before/subsections-desktop-light.png) | [png](before/subsections-mobile-dark.png) | [png](before/subsections-mobile-light.png) |
| Posts `/admin/posts` | [png](before/posts-desktop-dark.png) | [png](before/posts-desktop-light.png) | [png](before/posts-mobile-dark.png) | [png](before/posts-mobile-light.png) |
| Tags `/admin/tags` | [png](before/tags-desktop-dark.png) | [png](before/tags-desktop-light.png) | [png](before/tags-mobile-dark.png) | [png](before/tags-mobile-light.png) |
| Profile `/admin/profile` | [png](before/profile-desktop-dark.png) | [png](before/profile-desktop-light.png) | [png](before/profile-mobile-dark.png) | [png](before/profile-mobile-light.png) |
| Login `/admin/login` | [png](before/login-desktop-dark.png) | [png](before/login-desktop-light.png) | [png](before/login-mobile-dark.png) | [png](before/login-mobile-light.png) |

### Finding: the admin does not respond to the theme at all

`next-themes` does set `class="light"` on `<html>` on admin routes, but no admin rule
consumes it, so 13 of the 14 dark/light screenshot pairs are byte-identical (md5); the
only exception is the desktop dashboard, where the green "Live" button's `animate-ping`
dot (`src/components/admin/dashboard/adminDashboard.tsx:65`) is frozen at a different
point of its cycle. Verified in the browser: on `/admin/login`
`document.documentElement.className` is `light` while `body` computed background stays
`rgb(10, 10, 10)` (`#0a0a0a` from `src/components/admin/adminLayout.tsx:58`), and
`document.querySelector('.site-shell')` is `null` — the admin sits entirely outside the
public token scope.

## 2. Baseline audit by screen

Measured with `/tmp/cora/cp1-probe.mjs` (documented in `cp1-layout-probe.log`), plus
direct reading of `src/components/admin/**`.

| Screen | What is there today | Concrete problems |
| --- | --- | --- |
| Dashboard | `h1` "Dashboard", green **Live** pill button, four large stat cards (Sections 6, Subsections 7, Posts 12, Tags 4), a "Quick Actions" panel with four buttons. | The green "Live" button is ambiguous (it is not a publish action). "Posts 12" counts only published rows (`src/app/api/admin/stats/route.ts:20`), so 5 drafts are invisible and the metric contradicts the "All Subsections (17)" count on the posts screen. No recent work, no drafts queue, no link that says what it opens. Four cards consume the whole first screen for four numbers. |
| Sections | `h1`, "+ Add Section" style primary button, stacked section rows, inline form, `Edit` / `Delete` text buttons. | 18 hard-coded hex values in `sectionManager.tsx`; `confirm()` at `src/components/admin/section/sectionManager.tsx:57` names no item or consequence; visibility state is a checkbox label with no explanation of the public effect. |
| Subsections | `h1`, section filter, subsection cards grouped per section, display-style badges rendered as `📝 Blog` text. | 39 hard-coded hex values in `SubSection.tsx` (+3 in `SubSectionFilter.tsx`); emoji used as content-type icons (`src/components/admin/subsections/SubSection.tsx:108`, `:203`); the emoji picker (`EmojiPicker.tsx`) writes stored subsection icon data rather than chrome, so it stays; `confirm()` at `:89`. |
| Posts | `h1`, "+ New Post", a single `<select>` filter (labelled "Filter by Subsection", first option "All Subsections (17)"), one card per post with title, emoji type badge, status pill, `parent · n views`, tag chips, then `Edit`, `Publish`/`Unpublish`, `Delete`. | No search, no status filter, no pagination, no sort. 9 API calls are fired to render the list (1 sections + one per subsection) and every failed per-subsection call becomes an empty list (`src/components/admin/post/PostsManager.tsx:55-58`) — a partial failure looks like "no posts". `confirm()` at `:160`. `Unpublish` renders as unstyled grey text, `Delete` as red text: three different control weights in one row. Long titles wrap to two lines instead of truncating. Editing happens in `PostEditModal.tsx`, a modal that re-declares the whole form, so the editor is narrow, scrolls inside a dialog, has no preview, no unsaved-changes warning, and no persistent save area. |
| Tags | `h1`, inline create row, tag list with count and icon-only delete buttons. | 5 icon-only buttons have no accessible name at all (`namedIconButtons: 5` in the probe). `confirm()` at `src/components/admin/tags/tagsManager.tsx:45`. |
| Profile | `h1`, one long form: profile picture URL + upload, bio, email, X, Instagram, LinkedIn, resume. | No grouping into identity / contact / social blocks; no GitHub field (the public GitHub link is hard-coded in `src/components/public/SocialLinks.tsx:16` and `src/components/public/Sidebar.tsx:242`); `profilePicture` is a raw URL text box (`src/schema/profileSchema.ts` has no `githubLink`); 27 hard-coded hex values in `profileManager.tsx`. |
| Login | Centered "Admin Login" card, Email + Secret Key, full-width white primary button, "Sign up" link. | Not the admin shell, so no theme control and no way back to the site; labels are unstyled `13px` text with no `aria-describedby` error association; the auth flow itself (`/api/admin/login` → httpOnly `auth-token`, `src/middleware.ts` redirect) works and must be preserved as-is. |

### Cross-cutting baseline facts

- **Fonts.** Admin computes to `ui-sans-serif, system-ui, …` — Tailwind's default. The
  public site's Inter (`--font-site-sans`, `src/app/layout.tsx:17`) is never applied, so
  the admin is typographically a different product.
- **Colour.** 304 hard-coded hex literals across 20 admin files, 10 distinct values:
  `#0a0a0a` (69), `#2a2a2a` (67), `#1a1a1a` (57), `#707070` (47), `#e5e5e5` (41),
  `#101010` (17), `#3a3a3a` (3), `#252525`, `#101011`, `#444`. Status and type hues come
  from raw Tailwind palette classes instead, e.g. `bg-blue-950/50 text-blue-400` for the
  Blog badge and `text-green-400` / `text-red-400` for Published / Draft
  (`src/components/admin/post/postListItem.tsx:13-18`).
- **Icons.** 139 emoji characters in admin files: 96 in `EmojiPicker.tsx` (legitimate
  subsection icon data) and 43 used as navigation / content-type / status decoration in
  `adminLayout.tsx`, `adminDashboard.tsx`, `postForm.tsx`, `PostEditModal.tsx`,
  `postListItem.tsx`, `SubSection.tsx`, `postCard.tsx`, `MarkDownEditor.tsx`.
- **Responsive.** No horizontal document overflow at 375 / 768 / 1440 today
  (`scrollWidth === clientWidth` on every route); the mobile sidebar is a
  `translate-x` drawer. That behaviour is worth keeping — the new shell must not
  reintroduce overflow.
- **Focus and screen readers.** The mobile menu button is icon-only with no accessible
  name on every admin route (probe reports `namedIconButtons: 1` on all six shell
  routes), there is no `aria-expanded`, and there is no skip link or `aria-current`
  marker for the active nav item. 35 `focus:outline-none` declarations across 11 admin
  files strip the default ring and replace it with `focus:border-white` only, which is a
  1px change most users cannot see; the heaviest offenders are `postForm.tsx` (9) and
  `PostEditModal.tsx` (8).
- **Lint.** `src/components/admin/**` + `src/app/admin/**` carry 19 errors / 5 warnings
  at baseline (`/tmp/cora/baseline/eslint-newbase.json`), repo-wide 48 / 24. Those
  pre-existing failures are reported separately, not silently fixed, and not counted
  against the redesign.

## 3. What carries over from the public site

Source of truth is the `.site-shell` block in `src/app/globals.css:237-429` and the
reference captures in `docs/design-review/`
(`reference-dark-desktop.png`, `reference-light-desktop.png`, mobile counterparts).

Carried over:

| Rule | Public source | Admin use |
| --- | --- | --- |
| Dark palette `#050505 / #bbbbbb / #a8a8a8 / #929292 / #2b2b2b / #1d1d1d / #ddd / #fff` | `globals.css:260-269` | `--admin-bg / -text / -muted / -subtle / -border / -hover / -heading` |
| Light palette `#fff / #555 / #737373 / #e8e8e8 / #f1f1f1 / #222 / #000` | `globals.css:240-257` | same tokens, light values |
| Inter through `--font-site-sans`, `-0.025em`…`-0.052em` heading tracking, 650 weight | `globals.css:252`, `:299`, `:317` | admin type scale below |
| 1px quiet borders instead of shadows | `globals.css:294`, `:340`, `:385` | panels, rows, dividers |
| `2px` `:focus-visible` outline with offset | `globals.css:293` | admin focus ring (offset 2px, denser) |
| Muted 13px metadata, tabular dates, right-aligned, `white-space: nowrap` | `globals.css:365`, `:359` | list row meta |
| Two-line ellipsis clamp for long titles | `globals.css:364` | post titles in dense rows |
| Underlined links with `text-underline-offset: 3-4px`, underline softened to `--site-line` | `globals.css:327`, `:349` | "View site", secondary links |
| `aria-current="page"` + weight 600 for current location | `globals.css:304`, `:314` | admin nav |
| 44px minimum touch height under 600px | `globals.css:411` | admin mobile controls |
| `prefers-reduced-motion` kill switch | `globals.css:414-416` | admin motion |
| Dark default, no system detection, `site-theme` storage key | `src/app/layout.tsx:45` | unchanged; admin reads the same store |

Deliberately **not** carried over:

- `.generative-background` canvas effects (`globals.css:420-422`) — the branching tree
  and root masks read as noise behind tables and inputs. Admin uses flat surfaces.
- The 88px public header (`globals.css:297`) and the 656px reading column (`:296`) —
  replaced by a 64px admin bar and a wider content measure (see §5).
- `110px` page padding, justified long-form prose, `line-height: 1.82` outside the
  editor. Admin body is `14px / 1.5`.
- The public `.site-shell` selector itself. Admin gets its own `.admin-shell` scope so
  that no public rule can regress and no public rule leaks in; `src/app/globals.css`
  public selectors stay byte-identical.

## 4. Token specification

Implemented as a dedicated admin stylesheet, `src/app/admin/admin.css`, imported once by
`src/app/admin/layout.tsx` so it loads on every `/admin` route and nowhere else. The plan
allowed "`src/app/globals.css` or a dedicated admin stylesheet"
([`docs/admin-redesign-plan.md`:31](../admin-redesign-plan.md)) and asked for the scope to
stay "separate from `.site-shell` to prevent public regressions"; the separate file keeps
`src/app/globals.css` **byte-identical to baseline**, which is the strongest possible form
of that requirement, and it is the named integration point for the "public CSS unchanged"
check in checkpoint 9. Colour tokens hang off `body:has(.admin-shell)` rather than
`.admin-shell` itself because custom properties inherit: the body-level scope puts every
`--admin-*` token on the element that also paints the page background (so overscroll,
native form controls and any portal mounted on `document.body` see the same palette) while
`.admin-shell` stays the class components opt into. Light values are the default block and
`html.dark body:has(.admin-shell)` overrides them, i.e. the same convention as
`globals.css:240-269`, driven only by the `dark` class `next-themes` already writes.
The values below are exactly what
[`mockups/admin-mock.css`](mockups/admin-mock.css) renders with, so the mockups are a
live preview of the token set.

### 4.1 What is implemented, and how it was verified

`src/app/admin/admin.css` (new) contains, in order: theme-independent tokens (font, type
scale, spacing scale, layout measures, border/radius/shadow, focus ring, form metrics,
motion); the light colour set; the dark colour set; the `.admin-shell` base rules; the
`849px` gutter/panel override; and the `prefers-reduced-motion` switch copied in shape from
`globals.css:414-416`. No public generative/tree background rule is carried over.

The first consumer is the shell: `src/components/admin/adminLayout.tsx` now uses
`bg-[color:var(--admin-bg)]`, `border-[color:var(--admin-border)]`,
`text-[color:var(--admin-muted)]`, `bg-[color:var(--admin-scrim)]`,
`rounded-[var(--admin-radius-control)]`, `text-[length:var(--admin-text-meta)]` and friends
instead of literals, and its root element carries the `admin-shell` class.

Verification on the built tree (`npx next start -p 3099`, seeded DB, `admin@test.local`),
full output in `/tmp/cora/evidence/cp2-tokens.log` — 85 checks, all pass:

| Check | Result |
| --- | --- |
| Every one of the 21 colour tokens resolves to the specified value, both themes, on a real `/admin` page | pass (`--admin-bg` #050505/#ffffff, `--admin-text` #bbbbbb/#555555, …) |
| All 34 metric tokens (type, spacing, layout, radius, focus, form, motion) resolve to a non-empty value | pass |
| `.admin-shell` computed background/colour = `--admin-bg` / `--admin-text`; `font-family` resolves to `Inter`; `14px / 1.5`; `tabular-nums` on | pass |
| Theme is now live on the admin: the dark and light 1440×900 shell screenshots differ (they were md5-identical in §1) | pass |
| `color-scheme` and `scrollbar-color` follow the theme; `--admin-gutter`/`--admin-panel-pad` drop to 16px at 375px; 0 horizontal overflow at 375px | pass |
| Keyboard focus shows the token ring: 2px solid `--admin-heading`, offset 2px | pass |
| Admin contains 0 `.generative-background` and 0 `.site-shell` nodes; public routes contain 0 `.admin-shell` nodes | pass |
| Public tokens unchanged: `/` still computes `--site-bg` #050505/#ffffff and `--site-text` #bbbbbb/#555555; `src/app/globals.css` has an empty `git diff` | pass |
| `npm run build` exit 0; `npx eslint` on both touched files → 0 problems (both were 0 at baseline) | pass |

Screenshots: `/tmp/cora/evidence/cp2-admin-1440-{dark,light}.png` and
`cp2-admin-375-{dark,light}.png`. They intentionally show a half-converted admin — the
shell is tokenised, the dashboard cards are not yet — which is the phase-2/phase-3 boundary.

**Hard-coded colour census** (`grep -oE '#[0-9a-fA-F]{3,8}\b' src/components/admin`):
304 literals in 20 files at baseline → **294 in 17 files** now, i.e. zero added and the
10 in `adminLayout.tsx` removed. Written exceptions, all of them pre-existing and all
slated for removal by the checkpoint named: `post/PostEditModal.tsx` 46 and
`post/postForm.tsx` 45 (checkpoint 6 editor), `subsections/SubSection.tsx` 39 +
`SubSectionFilter.tsx` 3, `profile/profileManager.tsx` 27 (checkpoint 5),
`post/MarkDownEditor.tsx` 19, `section/sectionManager.tsx` 18,
`auth/SignUpPage.tsx` 16 + `auth/LoginPage.tsx` 12 (checkpoint 3 login/signup),
`tags/tagsManager.tsx` 15, `dashboard/adminDashboard.tsx` 14,
`post/postListItem.tsx` 11, `post/postCard.tsx` 6, `post/filterBar.tsx` 4,
`post/PostsManager.tsx` 4, `post/blogPost.tsx` 1. `subsections/EmojiPicker.tsx` 14 are
string literals inside emoji data, not colours. Two further colour-bearing files sit
outside the checkpoint's grep scope and are handled later: `src/components/ui/Spinner.tsx`
(`#0a0a0a`, `#2a2a2a`, used by `FullScreenLoader`, which renders *outside* the shell and is
replaced by the admin loading state in checkpoint 4) and the `bg-black/50`-style Tailwind
palette classes that the converted pages will drop as they move onto tokens.

Two implementation traps worth recording, both measured rather than assumed. (1) An admin
rule written **outside** a CSS layer outranks every Tailwind utility in the document
(unlayered author styles beat all `@layer`ed ones regardless of specificity), which silently
killed `text-[color:var(--admin-muted)]` on nav links until the `.admin-shell` element rules
were wrapped in `@layer base`. (2) Inside `@layer base` the same cascade runs the other way:
a probe on `/admin/profile` showed an input carrying `focus:outline-none` computing
`outline-style: none` (the utilities layer wins over base regardless of specificity), so the
`:focus-visible` ring is deliberately the one rule kept unlayered. With it unlayered the same
probe computes `2px solid` in `--admin-heading` with a 2px offset on that legacy input in
both themes — recorded in `cp2-tokens.log` as the "legacy focus control" checks — which is
what holds the accessibility row up while unconverted pages still strip their own outlines.
A component that later needs a different ring must declare it in `admin.css`, not with a
utility.

### 4.2 Shared shell delivered (checkpoint 3)

The shell described in §5 is implemented and is now the only chrome around the six
authenticated routes. Files:

| File | Role |
| --- | --- |
| `src/components/admin/shell/adminRoutes.ts` | route table (`/admin` + 5 sections, 2 auth screens) and the two predicates that decide current-location and shell-vs-no-shell |
| `src/components/admin/shell/adminNav.tsx` | maps those routes onto Phosphor icons (`SquaresFourIcon`, `FolderIcon`, `FolderOpenIcon`, `ArticleIcon`, `TagIcon`, `UserIcon`) replacing the 📊 📁 📂 📝 🏷️ 👤 nav emoji |
| `src/components/admin/shell/AdminSidebar.tsx` | 240px panel: brand, `aria-current="page"` nav, "View site" (ordinary external link, `target="_blank" rel="noopener noreferrer"`), "Log out" |
| `src/components/admin/shell/AdminTopBar.tsx` | 64px bar: current location as a visible label (`<p data-admin-location>`, demoted from `h1` in checkpoint 4 so the screen's own title is the only `h1`), 44px hamburger with `aria-expanded` + `aria-controls`, `ThemeToggleButton` from `src/components/spaceui/theme-toggle.tsx`, "Log out" |
| `src/hooks/useFocusTrap.ts` | Escape + Tab containment + focus restore, shared with the checkpoint-4 dialog |
| `src/components/admin/adminLayout.tsx` | composition, auth redirect (unchanged `adminApi.logout()` + `checkAuth()` path), drawer/scrim state, skip link |
| `src/app/admin/admin.css` | unchanged in this step; the shell consumes its tokens |

Everything is token-driven (`bg-[color:var(--admin-surface)]`, `text-[length:var(--admin-text-meta)]`,
`h-[var(--admin-header-h)]`, …): `grep -E '#[0-9a-fA-F]{3,8}' ` over `adminLayout.tsx` +
`shell/` returns 0 hits and the admin-wide census stays at 294 literals / 17 files
(unchanged from §4.1), with the nav emoji gone from the shell.

Verification (`npx playwright test tests/e2e/admin-shell.spec.ts`, 17/17 pass on the
built tree, output in `/tmp/cora/evidence/admin-run-iter3/cp3-playwright-final.log`):

| Check | Result |
| --- | --- |
| Exactly one `a[aria-current="page"]` per shell route, and the top bar location label names the same section, on all 6 routes. Checkpoint 4 re-ran this after demoting that label from a second `h1`; the same test now also asserts `getByRole('heading', { level: 1 })` count is exactly 1 per route | pass |
| Live-site link, theme control, logout, `<main>` and skip link present on every route | pass |
| Theme: dark default → toggle → `localStorage.site-theme = light` → survives reload → survives admin→public (popup) → survives public→admin | pass |
| No wrong-theme flash: `<html>` class never contains `dark` during a light-prefixed load, and next-themes' blocking script precedes the first rendered body element | pass |
| Theme switch still lands on the right value with motion allowed (`reducedMotion: no-preference`) | pass |
| Mobile 375×844: keyboard opens the drawer (`Enter` on the hamburger), `aria-expanded` flips, `role="dialog"` + `aria-modal` + accessible name appear, focus moves inside, Tab cycles inside, Escape closes and restores focus to the trigger, Space re-opens | pass |
| Drawer closes on navigation and on scrim click, and the reopened drawer marks the new current location | pass |
| Hamburger and drawer hidden at ≥850px, sidebar 240px visible; 44px touch target on the hamburger | pass |
| Zero horizontal overflow at 1440 / 768 / 375 on `/admin/posts` | pass |
| `npx vitest run tests/unit/admin-shell-routes.test.ts` — 6 unit tests on the route predicates (prefix traps such as `/admin/subsections` vs `/admin/sections`) | pass |

After-shell screenshots (viewport-sized, re-seeded DB, `overflow=0` recorded per file in
`cp3-shots.log`): `docs/admin-redesign/after-shell/cp3-<screen>-{1440,375}-{dark,light}.png`
for all six screens plus `cp3-drawer-open-375-{dark,light}.png`.

Two traps found by measurement while building it. (1) The drawer originally spanned
`inset-y-0`, i.e. it covered the top bar; at 375px that made the hamburger
(the only close control) unreachable by pointer — Playwright reported
"subtree intercepts pointer events" while every `aria-expanded` assertion still passed.
Stacking is now top bar `z-50` > drawer `z-40` > scrim `z-30` > sidebar `z-20`, and the
drawer starts below the 64px bar. (2) Chromium 1248 drops a single
`focus()` on the freshly revealed panel when a mouse click re-focuses its trigger
afterwards (no `focusin` at all under the suite's `prefers-reduced-motion: reduce`),
so `useFocusTrap` re-asserts the panel's first focusable for ~640ms instead of focusing
once; the keyboard path alone hid this because keyboard activation does not re-focus.

### 4.3 Control primitives delivered (checkpoint 4)

Every primitive named in §4 "Control primitives" now exists, is token-driven, and is used by
real screens. Files:

| File | Exports | Replaces |
| --- | --- | --- |
| `src/components/ui/admin-button.tsx` | `AdminButton`, `adminButtonVariants`, `adminButtonClass` | hand-styled `bg-white text-[#0a0a0a] rounded-lg` buttons (50 raw `<button>` elements in `src/components/admin` at baseline, 39 now, and every new control uses the primitive); `adminButtonClass` is the `<Link>`-safe skin |
| `src/components/ui/admin-field.tsx` | `AdminField`, `AdminInput`, `AdminTextarea`, `AdminSelect`, `AdminCheckbox`, `useAdminFieldProps` | hand-labelled inputs with `focus:outline-none` and no error association |
| `src/components/ui/status-label.tsx` | `StatusLabel` (tones `neutral/live/draft/hidden/danger/info`) | the `bg-green-950/50 text-green-400` and `bg-[#1a1a1a] text-[#707070]` pills copied across four screens |
| `src/components/ui/notice.tsx` | `Notice` | every `window.alert(...)` and the `bg-red-950/50` error boxes |
| `src/components/ui/admin-state.tsx` | `AdminLoadingState`, `AdminEmptyState`, `AdminErrorState` | `ContentLoader` on every screen and the silent "empty list" that a failed request used to produce |
| `src/components/ui/confirm-dialog.tsx` | `ConfirmDialog` | all four `window.confirm()` calls |
| `src/components/ui/form-section.tsx` | `FormSection` | undifferentiated `<div className="bg-[#101010] p-6">` form boxes |
| `src/components/ui/page-header.tsx` | `PageHeader` | four different hand-written page titles (28px / `text-2xl sm:text-[28px]` / no description) |
| `src/components/admin/contentTypes.ts` + `contentTypeBadge.tsx` | `CONTENT_TYPES`, `contentTypeFor`, `contentTypeKey`, `ContentTypeBadge` | the six-row emoji table duplicated in `postListItem`, `postForm`, `PostEditModal`, `SubSection` and the 📝/🚀/📌 badges |
| `src/components/admin/tags/tagsManager.tsx`, `src/components/admin/section/sectionManager.tsx` | converted screens | see verification below |

Hard-coded colour literals under `src/components/admin` went from **294 in 17 files** (§4.1)
to **251 in 15 files** (`grep -rEoh "#[0-9a-fA-F]{3,8}\b" src/components/admin --include=*.tsx`).
Files converted in this checkpoint reached zero: `tagsManager.tsx` 10 → 0 and
`sectionManager.tsx` 12 → 0 (both measured with the same grep against `HEAD`). Partially,
because those screens belong to later checkpoints: `SubSection.tsx` 25 → 20,
`postListItem.tsx` 6 → 5, `postForm.tsx` and `PostEditModal.tsx` 32 → 31 each,
`profileManager.tsx` unchanged at 19. Nothing was added.

Two deliberate decisions inside the primitives:

- `AdminField` passes the control's `id`, `aria-invalid` and `aria-describedby` down through
  context (`useAdminFieldProps`) rather than `cloneElement`, so a control also works outside a
  field, and hint + error share one mechanism. The hint is replaced by the error while one is
  present, so a field never carries two competing explanations.
- `ConfirmDialog` reuses `src/hooks/useFocusTrap.ts` (the same hook the drawer uses, including
  its re-assert workaround) and puts initial focus on **Cancel**: the hook focuses the panel's
  first focusable, which is why Cancel is first in the DOM. Enter on an unread dialog cannot
  delete anything. The dialog is mounted only while open, so "cancel changes nothing" is a
  structural property: no request exists unless Confirm was pressed.
- The dialog is `z-[70]`, above the checkpoint-3 top bar (`z-50`), which the drawer trap
  discovered is the wrong order for a modal: the drawer sits *below* the bar on purpose, a
  modal must not.

Emoji policy applied. The acceptance grep is:

```
$ grep -rnoP "[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}\x{2B00}-\x{2BFF}]" src/components/admin --include=*.tsx \
    | grep -v "subsections/EmojiPicker.tsx"
src/components/admin/subsections/SubSection.tsx:21:📄
```

One hit outside `EmojiPicker.tsx` (the file the grep excludes, whose palette is emoji by
definition because it edits an emoji column). That single hit is the `DEFAULT_SUBSECTION_ICON`
constant, and the picker itself is the only other place with any: both are stored data, not
chrome. Chrome emoji are gone — `postListItem`, `postForm`, `PostEditModal`, `SubSection` (the
display-style picker and the row badges), the close and remove controls in both editors, the
blockquote and link markdown toolbar buttons, the dashboard's four stat-card glyphs, and the six
nav icons (checkpoint 3). What stays
is what the database holds: `Subsection.icon` is an emoji column (`prisma/schema.prisma:46`)
edited by `EmojiPicker.tsx`, whose palette therefore has to contain emoji; it renders in the
subsection list and as `<option>` text, where only text is allowed. Those reads are marked
`aria-hidden` so a screen reader does not announce a picture of a keyboard as content.
`adminNav.tsx` no longer even quotes the emoji it replaced, because the grep above is the
acceptance check.

No `confirm()` or `alert()` call site is left under `src/components/admin`. The words still
appear in code comments that record what was replaced, so the search skips comment lines:

```
$ grep -rnE "(^|[^a-zA-Z.`])(confirm|alert)\(" src/components/admin --include=*.tsx \
      | grep -vE ":[0-9]+: (\*|//|/\*)" | grep -v 'role="alert"'
$                 # no output, exit status 1
```

Every remaining hit of a looser search is prose inside a comment. Posts
(`src/components/admin/post/PostsManager.tsx`) keeps its current list markup — checkpoint 6
rebuilds that screen — but its delete now opens the shared dialog, and its publish/unpublish
and delete failures are inline `Notice`s instead of `window.alert`.

Verification, on the built tree (`npm run build` clean, `npx tsc --noEmit` clean):

| Check | Evidence | Result |
| --- | --- | --- |
| Dialog names the item and the consequence | `getByRole('dialog')` accessible name matches `/Delete tag.*<name>/` and the refusal sentence is visible | pass |
| Initial focus is Cancel, not Delete | `document.activeElement.textContent === 'Cancel'` | pass |
| Focus is trapped | 8 × Tab and 8 × Shift+Tab, `activeElement.closest('[data-slot="confirm-dialog"]')` true every time | pass |
| Focus returns to the control that opened it | after `Escape`, `activeElement.ariaLabel === 'Delete tag <name>'` | pass |
| Cancelling a destructive action changes nothing | row still present after `Escape` and after the Cancel button; second run over the same DB is identical (`SELECT count(*) FROM "Tag"` = 4 before and after) | pass |
| Confirming really deletes | row gone, and still gone after `page.reload()` (real `DELETE /api/admin/tags/[tagSlug]`) | pass |
| Failed delete is actionable and non-destructive | simulated `409` with the API's own body → `role="alert"` text = `Cannot delete tag with 3 associated post(s). Remove the tag from posts first.`, dialog closed, row still there | pass |
| Failed save keeps input and names the field | simulated `400` `Tag already exists` → `aria-invalid="true"`, `aria-describedby="tag-name-hint tag-name-error"`, `#tag-name-error` text = the message, `input.value === 'LLM'` | pass |
| Same dialog guards a cascade | Sections: accessible name `Delete section <name>` + the "deleted with it / refused until those posts are moved" sentence | pass |
| 44px targets on the converted controls at 375px | primary action, row delete (32→44px after the `icon-sm` mobile bump), and both dialog buttons ≥44px; zero horizontal overflow with the dialog open | pass |
| One `h1` per admin route | `getByRole('heading', { level: 1 })` count = 1 on all 6 routes, in `admin-shell.spec.ts` | pass |
| `contentTypeFor` covers both key spellings | 4 unit tests (`tests/unit/admin-content-types.test.ts`), including `BLOG`/`blog` equivalence and the blog fallback | pass |
| No new lint debt | `src/components/admin` + `src/app/admin` + `src/components/ui`: **9 errors / 5 warnings**, down from the 19 / 5 of §4.1 with 0 new. Clean now: `tags/`, `section/`, `subsections/`, `shell/`, `PostsManager.tsx`, `postListItem.tsx` and all of `src/components/ui`. The 9 that remain are in files this checkpoint did not convert (`LoginPage` 2, `MarkDownEditor` 2 — both `react-hooks/refs`, re-verified as present at `HEAD`, `SignUpPage` 1, `blogPost` 1, `titleOnlyItem` 1 `react-hooks/purity`, `profileManager` 2); the 5 warnings are the pre-existing `no-img-element` set | pass |
| Contrast / type floor on the converted screens | computed probe on `/admin/tags` and `/admin/sections`, both themes: no visible text under 12px and no pair below 4.5:1 (the only flagged node is the theme toggle's `sr-only` label, 1×1 clipped) | pass |

Suites: `npx playwright test` 23/23 (17 shell + 6 new in `tests/e2e/admin-controls.spec.ts`),
`npx vitest run` 10/10. Screenshots: `docs/admin-redesign/after-controls/`
(`capture-notes.txt` records what each file proves; the simulated-failure shots say so in
their own filenames).

Open items this checkpoint found and did **not** fix, because the screens are later
checkpoints' work: `/admin/posts` and `/admin/subsections` still carry their baseline
hard-coded hex and 11px text, and in **light** mode their legacy white `h1` sits on white
(`rgb(255,255,255)` on `rgb(255,255,255)`, measured) — the same "admin ignores the theme"
defect recorded in §1, now visible on two specific headings. Checkpoints 5 and 6 replace both
screens. *(Update, §4.4: Subsections has since been converted — its `h1` and 11px text are gone —
leaving `/admin/posts` as the last screen carrying that defect.)*


### 4.4 Content screens delivered (checkpoint 5, in progress)

Three of the six screens are rebuilt on the primitives — **dashboard**, **subsections** and
**profile**. Sections and Tags were converted in §4.3. **Posts is not**, because that screen is
checkpoint 6's functional work; §4.4 therefore does not claim checkpoint 5, and the two screens
this section closes out were the last ones whose `h1` was white-on-white in light mode (§4.3
"Open items").

| File | What it is now | What it replaced |
| --- | --- | --- |
| `src/app/api/admin/stats/route.ts` | seven explicit counts: `sections`/`hiddenSections`, `subsections`/`hiddenSubsections`, `published`, `drafts`, `tags`, plus `totalPosts` | one `prisma.post.count({ published: true })` reported as "Posts", so 5 seeded drafts were invisible; the whole payload was three numbers and a guess |
| `src/app/api/admin/posts/route.ts` + `src/lib/postFilters.ts` + `postListQuerySchema` in `src/schema/postsSchema.ts` | the single authenticated post list: `search` / `status` / `subsection` / `sort` / `page` / `limit`, validated by zod, `where` and `orderBy` built by pure functions, `total`/`totalPages` returned, 400 on a malformed query, 500 with a message on a database failure | nothing — the client asked for every subsection separately. It is the dashboard's "recently edited" source (`limit=5`) instead of a second bespoke query bolted onto the stats route |
| `src/components/admin/dashboard/adminDashboard.tsx` + `overviewRows.ts` + `recentEdits.ts` | one overview list (published, drafts, sections + hidden, subsections + hidden, tags), each row a link to the screen that edits it; a draft notice; "Recently edited" with type icon, parent subsection, `Live`/`Draft` label, edited-when, `Edit` and (for published posts) a public-view link | four large stat cards (one of them wrong), a green `Live` button with an `animate-ping` dot that navigated to the site, and a "Quick Actions" panel of four links that went where the cards already went; `fetch()` instead of `adminApi`, and a `catch` that logged and showed four zeros |
| `src/components/admin/subsections/SubSection.tsx` + `subsectionFilters.ts` | page header with one primary action; search + section + visibility filters; the list grouped under each **section heading** with its own visibility label; rows with stored icon, name, visibility, content-type badge, post count and public path; named `View`/`Edit`/`Delete` controls; radio-button display-style group; load failure now renders `AdminErrorState` with retry | a flat alphabetical list of seven rows that never said which section a subsection was in, no filters, a console-only failure, `border-2 bg-[#0a0a0a]` buttons standing in for radios, and 20 hard-coded hex values |
| `src/components/admin/profile/profileManager.tsx` + `profileForm.ts` | five groups — Picture, Bio, Contact, Social links, Resume — each a `FormSection` of `AdminField`s; per-field URL/email validation before submit; a sticky save area that says "Unsaved changes"/"Everything on this page is saved."; `Discard changes`; upload failures reported with the form intact | one flat 300-line form, an opaque `Invalid data` 400 for a half-typed URL, `setTimeout`-erased success messages, and an upload whose error was thrown inside the `FileReader` callback so `uploading` never cleared and nothing was reported |
| `src/components/ui/admin-filter-bar.tsx` | `role="search"` row that owns where filters sit (under the header, above the list) and where the result count sits | the first draft of this screen had its filters in a bespoke box |
| `src/components/admin/subsections/EmojiPicker.tsx` | the picker's chrome (button, panel, tabs, paste field, 40px cells) on admin tokens, `aria-expanded` on the trigger, named cells; the emoji *palette data* and the stored `Subsection.icon` are untouched | 9 hex literals, 11px tab labels, an unnamed toggle |
| `src/app/api/admin/profile/route.ts` | `data.x === undefined ? undefined : data.x` — an absent field is untouched, an explicit `null` clears | `data.x ?? undefined`, which swallowed the `null` the client sends for an emptied field, so "Delete the bio" saved successfully and changed nothing |
| `src/hooks/useFocusTrap.ts` (checkpoint 3 delivery, fixed here) | the open panel owns every Tab press in both directions, cycling its own focusables | boundary-only interception: from the drawer's second-to-last item the browser moved focus to the page behind and the trap pulled it back one keydown later, so focus really did leave for one press. Measured on the pinned Chromium: ~1 run in 6 read `document.activeElement` inside that window and the shell's mobile-navigation test failed |

Verification for this section, on the tree this commit leaves behind (`npm run build` exit 0,
`npx tsc --noEmit` exit 0, `npx vitest run` 54/54 in 9 files, `npx playwright test` 36/36 on the
built tree). Two Playwright gotchas were settled here: `page.reload({ waitUntil: 'networkidle' })`
costs exactly 30s on the first reload of a page because Chromium answers it from cache and no
network event ever arrives (the specs use `load` + auto-waiting assertions), and the mobile
focus-trap test above was re-run 8x plus the dialog's 4x after the hook fix with no failure, where
it had failed roughly once in six before it.

| Thing asserted | How | Result |
| --- | --- | --- |
| The list endpoint refuses an anonymous caller | `GET /api/admin/posts` with no cookie through the real handler → 401 `Unauthorized` (`tests/integration/admin-post-list.test.ts`) | pass |
| Filtering is server-side and additive | `status=published` ∪ `status=draft` = all, each equal to a raw `SELECT count(*)`; `subsection=projects`; `subsection=engineering` excludes its sibling `essays`; `status=draft&subsection=engineering`; `search=TRUNCATION` finds the seeded long-title post, `search=zzzz` returns `[]` with `total: 0` | pass, 5 tests |
| Pagination neither drops nor repeats a row | 5-per-page walk over every page collecting ids into a set, asserting no id repeats and the set size equals the seeded total (the `id` tie-breaker in `buildPostListOrderBy` is what makes this hold on the seeded rows, which share one `updatedAt`) | pass |
| A malformed query is a 400 that names itself | `status=everything`, `page=0`, `limit=5000`, `page=abc` → 400 + `Invalid <param>`; `?subsection=` is "no filter", not an error | pass |
| A database failure is reported, not disguised as an empty list | `vi.mock` of the `post` delegates in `tests/integration/admin-post-list-error.test.ts` → 500 with a `message` and **no** `posts`/`total` keys | pass |
| Dashboard numbers are the database's numbers | `GET /api/admin/stats` through the handler vs seven direct Prisma counts; `published + drafts === totalPosts`; hidden ≤ total (`tests/integration/admin-stats.test.ts`) | pass, 4 tests |
| Dashboard renders seeded counts and has no "Live" control | Playwright: `rowFor('Published posts')` contains the API's `published`, …; `getByRole('button', { name: /^live$/i })` count 0; `.animate-ping` count 0; `View site` is a `target="_blank"` link | pass |
| Subsections show the hierarchy and filter it | Playwright: `h2` "Writing" with the Engineering and Essays rows under it, `/engineering` path in the meta line, `search=projects` → "1 of 7 subsections" with the `Writing` group gone, `visibility=hidden` → the `Scratch` row, `Clear filters` → "7 of 7" | pass |
| Profile groups the seeded values and saves them | Playwright: `h2`s Picture/Bio/Contact/Social links/Resume, email `hello@test.local`, X `https://x.com/parththirwani`, bio contains `CodeMate`, `Save profile` + "Everything on this page is saved." | pass |
| A profile save really lands, and a cleared field really clears | Playwright against the isolated database: fill a unique bio + empty X, save, reload, `toHaveValue` both, then read `GET /api/admin/profile` and expect `bio` to be the marker and `xLink` to be `null`; the two touched columns are written back in a `finally` so the row ends at its seeded values (`tests/e2e/admin-content-screens.spec.ts`) | pass — this is the test the old `data.x ?? undefined` route would have failed |
| Failure paths | dashboard with both requests aborted → `role="alert"` "…could not be reached…" + `Try again` and no fake zeros; profile with the `PATCH` answered 500 → the alert names the server message, the textarea keeps the typed sentence, "Unsaved changes" stays | pass, 2 tests |
| New filtering/validation logic is unit-tested | 9 (`groupSubsections`, `isSubsectionFilterActive`), 7 (`buildOverviewRows`, `formatRelativeTime`, `publicPostPath`), 11 (`profileFormFromProfile`, `validateProfileForm`, `buildProfilePayload`, `isProfileDirty`), 3 (`requestFailureMessage`) = 30 new unit tests | pass |
| No horizontal overflow on the converted screens | `overflow=0` recorded per screenshot at 1440x900 and 375x844 in both themes (`after-screens/capture-notes.txt`), plus a Playwright overflow check on all five converted routes at 375 | pass, 28 shots |
| No new lint debt, less old debt | repo-wide `npx eslint .`: **36 errors / 22 warnings** (baseline 48/24, §4.3 38/24). Per-file comparison against `/tmp/cora/baseline/eslint-newbase.json` finds **no file with more problems than its baseline**; the -2/-2 since §4.3 is `profileManager.tsx`, whose two `catch (err: any)` errors, unused `profile` warning and `no-img-element` warning are gone (the last with a named, commented disable) | pass |
| Public site untouched | `git diff --stat` over `src/app/globals.css`, `src/components/public/`, `src/app/(site)/`, `src/middleware.ts`, `src/lib/auth.ts`: empty | pass |
| Admin colour debt keeps falling | `grep -rEoh "#[0-9a-fA-F]{3,8}\b" src/components/admin`: **163 literals in 11 files** (§4.3: 251 in 15). Zero now: `dashboard/`, `subsections/`, `profile/`. What is left is the posts screen (`postForm` 31, `PostEditModal` 31, `MarkDownEditor` 13, `postListItem` 5, `postCard` 4, `PostsManager` 3, `filterBar` 3, `blogPost` 1, `SubSectionFilter` 2 — checkpoint 6) and the two auth screens (21 — §7) | pass |

Screenshots: `docs/admin-redesign/after-screens/` — 28 PNGs (dashboard, dashboard-error,
subsections, subsections-filtered, subsections-form, profile, profile-unsaved) at 1440x900 and
375x844 in dark and light, with `capture-notes.txt` recording each file's overflow, `h1` text and
byte size.

Still open for checkpoint 5: the **posts** screen (its rows, filters and editor belong to
checkpoint 6), and the login/signup screens (§7). Once Posts is converted, checkpoint 5's evidence
is the same two tables with the Posts row added. — *Posts is converted in §4.5; login/signup are
still open.*

### 4.5 Posts list on one endpoint (checkpoints 5 and 6, list half)

The last legacy screen is converted. `PostsManager` no longer builds its list out of one request
per subsection; it asks the single authenticated list endpoint built in §4.4 and renders what the
server says, including the failure.

| File | What it is now | What it replaced |
| --- | --- | --- |
| `src/components/admin/post/PostsManager.tsx` | `PageHeader` ("Posts" + one primary action) → `AdminFilterBar` with **search / status / subsection / order** (the subsection select grouped by `optgroup` per section) → server-paged rows → `Previous / 1 2 / Next` + "Page 1 of 2". One list request per filter change, the search box debounced 300 ms so typing is not one round trip per keystroke; a stale response can't overwrite a newer one (each request owns an `active` flag); `AdminLoadingState` / `AdminErrorState` (with retry) / `AdminEmptyState` (different copy for "no posts" and "nothing matches"); publish/unpublish and delete report success in a `Notice` and failure in an assertive `Notice` naming the post; page resets to 1 whenever a filter changes | the fan-out below, a client-side `useEffect` filter, `ContentLoader` forever on a failed read, an empty list standing in for a failed subsection, `+ New Post` painted by hand, and an `h1` that was white-on-white in light mode |
| `src/components/admin/post/postListItem.tsx` | one row = title + `Live`/`Draft` `StatusLabel` + content-type badge, then "**section / subsection** · edited …" (the hierarchy the screen was missing), tag chips as `StatusLabel`s, and the actions `View on public site` (published only, `target=_blank`), `Edit`, `Publish`/`Unpublish`, `Delete` — each naming the post to assistive tech, each a token-driven `AdminButton` | three hand-painted buttons with unqualified labels, 11px tag chips, no section, no date, a `views` count, and a project link that appeared for every style |
| `src/lib/postFilters.ts` | adds `isPostFilterActive()` (when "Clear filters" appears — sorting is excluded because it reorders, it does not narrow) and `buildPostListPageItems()` (first/last/current±1 with a `gap` marker) | — |
| `src/components/admin/subsections/SubSectionFilter.tsx` | **deleted** — its single hand-styled select is replaced by the shared filter row | a select whose label implied it was the only possible filter |

**The fan-out, and the measurement that proves it is gone.** The pre-change tree at
`src/components/admin/post/PostsManager.tsx:55-67` did:

```ts
const allSubsections = res.sections.flatMap((s) => s.subsections || []);
const postsPromises = allSubsections.map(sub => adminApi.getPosts(sub.slug).catch(() => ({ posts: [] })));
```

with no error path at all (the outer `catch` only logged). Nine seeded subsections meant nine
requests, and a 500 on any of them looked like "this subsection has no posts". The code path is
removed — the only remaining `getPosts(` text in `src/components/admin/**` is this quoted baseline
line inside the comment above it, and `adminApi.getPosts` (`src/lib/api.ts:114`) now has no caller
in the admin — and
`tests/e2e/admin-post-list.spec.ts` › "issues one list request, not one per subsection" asserts the
whole network log of `/admin/posts`: exactly **one** `/api/admin/posts` call, **zero** calls
matching `/api/admin/subsections/:slug/posts`, and **3** admin requests in total (auth check, the
sections call that fills the subsection select, the list).

Verified on the built tree (`npm run build` exit 0, server on 3099):

| Check | How | Result |
| --- | --- | --- |
| Fan-out replaced | request-count test above | PASS |
| Filters are server-side | status=draft → 5 rows, every row `data-published="false"`; subsection=projects → rows all under *Projects*; search=Pattern → 1 row; each asserted against `/api/admin/posts` with the same query, not a hard-coded number | PASS |
| Paging is stable | page 2 shows the remaining rows, `aria-current="page"` on the button, and no page-1 title reappears (the `id` tie-break in `buildPostListOrderBy`) | PASS |
| Failed list | `route.fulfill` 500 → `role=alert` with the server's message + retry, and *not* the "No posts yet" empty state; retry restores 10 rows | PASS |
| Publish round trip | draft → publish → notice → reload → still `Live` → unpublish → reload → `Draft`, with the seeded row restored in a `finally` | PASS |
| Cancel changes nothing | delete dialog → Cancel → list total unchanged | PASS |
| 375 px | no horizontal overflow, delete control ≥ 44 px, title truncates | PASS |
| Unit coverage of the query rules | `tests/unit/admin-post-filters.test.ts` — 20 tests over parse/where/order/search-params/page-info/page-items/active-filters | PASS |
| Hex / emoji census | `src/components/admin/**` 163 → **147 literals in 8 files**; `PostsManager.tsx` and `postListItem.tsx` are at **0**; no emoji in either new file | PASS |

Evidence: `after-screens/cp6-posts-*` (12 PNGs: default, drafts filter, page 2 × 1440/375 ×
dark/light, overflow=0 and row counts recorded in `capture-notes.txt`) and
`after-screens/cp5-sections-*` / `cp5-tags-*` (8 PNGs re-captured into the same folder so that one
set contains all six screens at both widths in both themes, which is the shape checkpoint 5 names).
Logs: `/tmp/cora/evidence/admin-run-iter6-{build,build2,eslint,playwright,playwright-posts,shots,vitest}.log`.

Still open for checkpoint 6 at the time of writing (the editor half): full-width writing area,
persistent save/publish bar, explicit preview, unsaved-changes warning, project-only URL/image
fields in a rebuilt editor, the compact title-only flow, and the per-display-style
create→publish→delete browser lifecycle on a re-seeded database. `postForm.tsx` /
`PostEditModal.tsx` (31 hex literals each) are that work — **closed by §4.6**, which deletes both
files and adds `tests/e2e/admin-post-editor.spec.ts`.


### 4.6 Post editor page (checkpoint 6, editor half)

Delivered on `feat/admin-redesign-run`. The editor is now a page, for both halves of
"create/edit", at an address a person can reload or hand to someone else:

| File | Role |
| --- | --- |
| `src/app/admin/posts/new/page.tsx` | thin wrapper: `AdminLayout` + `<PostEditor mode="create" />` |
| `src/app/admin/posts/edit/[subsectionSlug]/[postSlug]/page.tsx` | thin wrapper, `await params`, `<PostEditor mode="edit" … />`; the subsection slug is carried because every post endpoint is addressed as `/api/admin/subsections/[slug]/posts/[postSlug]` — no second set of routes was invented for the editor |
| `src/components/admin/post/PostEditor.tsx` | the screen: PageHeader, Placement / Content / Writing / Project details / Cover image / Tags panels, persistent save-and-publish bar, unsaved-changes guard |
| `src/lib/postEditor.ts` | the pure rules both modes share: draft shape, `postToDraft`, `fieldsForStyle`, `validatePostDraft`, `isDraftDirty`, `buildPostPayload`, `POST_FIELD_IDS`, `postEditPath` |
| `src/schema/postsSchema.ts` | `postDraftSchema` (+ exported `coverImageSchema`, `projectLinkSchema`): the form-side zod contract, next to the endpoint-side `postsSchema` / `updatePostSchema` it mirrors |
| `src/components/admin/post/MarkDownEditor.tsx` | rewritten on tokens: Write/Preview as named pressed-buttons, toolbar controls ≥ 36 px, upload through `adminApi.uploadImage`, preview re-coloured by `.admin-md-preview` |
| `src/app/admin/admin.css` | the `.admin-md-preview` block (§4.6 note 3) |
| `src/components/admin/post/PostsManager.tsx`, `postListItem.tsx`, `dashboard/adminDashboard.tsx` | the modal and the inline create form are gone; Edit is a `<Link>` to the editor address (which also deletes the "refetch the post so the modal can open it" round trip) and the dashboard's *Recently edited* rows link straight into the editor |
| `postForm.tsx`, `PostEditModal.tsx` | **deleted** (62 hard-coded hex literals, two divergent copies of the same form) |

Plan line 41 mapped to what is on the tree:

| Requirement | Implementation | Proof |
| --- | --- | --- |
| full-width writing area | the editor column is `--admin-editor-max` (880 px) and the textarea spans it at `--admin-text-editor` 16 px / `--admin-leading-editor` | `post editor at 375px` — textarea width ≥ 80 % of the viewport, no horizontal overflow |
| persistent save/publish area | `fixed bottom-0` bar, `min-[850px]:left-[var(--admin-sidebar-w)]`, `z-[35]`, with `Save changes` (disabled while clean) + `Publish`/`Unpublish` + an `aria-live` save-state line | same test asserts the bar `toBeInViewport()` before any scroll and the button ≥ 44 px |
| explicit preview | Write / Preview panes in `MarkDownEditor`; the preview renders the same `markdownToHtml` output the published page serves | `the preview pane renders the same markdown…` asserts `h1` = "Preview heading" and `strong` = "bold", then that the source text is intact after switching back |
| unsaved-changes warning | `beforeunload` while dirty, plus a `ConfirmDialog` ("Leave without saving?" / *Keep editing* / *Discard and leave*) on the in-app exit | `leaving with unsaved changes asks, keeps editing on cancel, and saves nothing` — the typed title survives Cancel, and the row count is unchanged either way |
| project URL / image only for projects | `fieldsForStyle`: `projectLink` + `archiveYear` are project-only, `title_only` gets neither; see note 2 for the cover image | `shows the project URL and year only for a project…` walks all three styles in one session |
| compact title-only flow | the same table: a quote/book entry is title + tags, nothing else | same test + `after-editor/cp6-editor-title-only-*` |
| create / edit | `/admin/posts/new` and `/admin/posts/edit/...` share one component; create redirects to the new post's own address | lifecycle tests assert the URL after `Save as draft` |
| publish / unpublish | PATCH via `adminApi.togglePublish`, independent of saving the text | lifecycle tests: publish → reload → `Live` → unpublish → reload → `Draft` |
| save/publish failures visible, upload progress visible | `Notice assertive` with the server's message + "Nothing was saved…"; the Upload buttons use `AdminButton loading` | `a failed save says so and keeps every field`, `a failed cover upload reports it and leaves the form alone` |
| preserve every field + style validation | draft carries title/description/content/excerpt/coverImage/tags/projectLink/archiveYear; `buildPostPayload` is style-agnostic so a hidden field never blanks a stored column; the baseline's three style rules are reproduced verbatim in `validatePostDraft` | 25 unit tests in `tests/unit/admin-post-editor.test.ts`, including the exact baseline sentences |

Checkpoint 6's evidence sentence — "a browser test that creates → edits → publishes → unpublishes →
reloads → deletes a post of each display style against a re-seeded DB with row counts asserted
before and after" — is `tests/e2e/admin-post-editor.spec.ts`, parameterised over
`engineering` (BLOG), `projects` (PROJECT) and `quotes` (TITLE_ONLY), with the count read back from
`GET /api/admin/posts` before, +1 after the create, still +1 across the publish round trip, and
back to the original after the delete. Titles carry a per-run id so a rerun cannot collide with a
row a crashed run left behind, and a `finally` deletes at whatever address the editor ended on.

Three measurements worth recording, all found by running the built tree:

1. **`position: sticky; bottom: 0` does not work anywhere in this app's admin.** `src/app/globals.css:14`
   gives `body` `overflow: hidden auto`, which makes the body the scroll container, so a bottom-stuck
   bar sits at its natural position below the fold and never moves (measured `y = 2699` at 375×844).
   The editor's bar is therefore `position: fixed`. Consequence recorded but not yet fixed:
   `profileManager.tsx:340` still uses the `sticky` form, so the profile screen's save area is
   "at the bottom of the form", not "always on screen". Follow-up, and the reason the profile
   screenshots in `after-screens/` show the bar mid-page.
2. **Renaming a post moves its address.** The PUT route runs `generateSlug` on the title, so after a
   title edit the old URL is a `Post not found`. `PostEditor` follows it with `router.replace`; that
   navigation remounts the page and refetches, so the transient "Your changes are saved." notice is
   only emitted when the address did not change (the reloaded editor states its own saved line, and
   the heading carries the new title). The lifecycle test asserts the URL before it reloads — the
   first version of the test raced this and read a 404.
3. **The preview cannot touch the emitted markup.** `markdownToHtml` bakes Tailwind utilities
   (`text-neutral-300`, `bg-[#1a1a1a]`, `text-white`) into the stored HTML and that same HTML is what
   the public article page serves, so re-theming happens in CSS: `.admin-md-preview` rules in
   `admin.css` are deliberately unlayered, which is what lets them beat layered utilities
   (§4.1 cascade note, now used on purpose). `after-editor/cp6-editor-preview-1440-light.png` is the
   proof: the old `prose prose-invert` panel painted near-white text on the light background.

Interpretation recorded, because the plan says two things at once: "show project URL **and image**
fields only for project posts" (plan:41) versus "preserve every existing post field"
(checkpoint 6). Project *link* and *archive year* are project-only as specified; the cover image
stays available to a writing as well, because `src/components/public/PostContent.tsx:36` renders
`post.coverImage` as the article cover and hiding the field would strand a published capability.
A title-only post gets neither, which is unambiguous in both readings.

Verification on the built tree: `npm run build` exit 0 (41 route lines in the output; `/admin/posts/new`
prerendered static, `/admin/posts/edit/[subsectionSlug]/[postSlug]` server-rendered on demand),
`npx tsc --noEmit` exit 0, `npx vitest run` **99/99** (11 files), `npx playwright test` **56/56**, `npx eslint .`
**34 errors / 20 warnings** against the 48/24 baseline with **0 problems on every file this
checkpoint touched**, `src/app/globals.css` and `src/components/public/**` byte-identical, and the
isolated database back at 17 posts / 4 tags / 7 subsections. Hard-coded colour in
`src/components/admin/**` + `src/app/admin/**`: 147 literals in 8 files → **29 in 5 files** — 21 of
those are the two unconverted auth screens and 8 are dead legacy files
(`postCard`/`filterBar`/`blogPost`) that nothing imports; the posts/editor path is at zero.

Evidence: `after-editor/` — 22 PNGs (create-project, create-title-only, edit-writing, preview ×
1440/375 × dark/light; the fixed-bar "fold" shots × 4; the leave dialog × 1440 × dark/light) with
`capture-notes.txt` recording overflow, `h1` text and byte size per file. Nothing in the capture
script writes to the database. Logs: `/tmp/cora/evidence/admin-run-iter7/`.

Still open after this section, for checkpoint 6: the two auth screens (`LoginPage.tsx`,
`SignUpPage.tsx`) keep their legacy card, and `FullScreenLoader` keeps its own hexes; both are
shell-surface work rather than editor work and are listed in §7.



### Colour

| Token | Dark | Light | Use |
| --- | --- | --- | --- |
| `--admin-bg` | `#050505` | `#ffffff` | page background |
| `--admin-surface` | `#0f0f0f` | `#fafafa` | panels, sticky bars |
| `--admin-surface-2` | `#161616` | `#f1f1f1` | wells, active nav, draft pill |
| `--admin-border` | `#2b2b2b` | `#e8e8e8` | hairlines, dividers |
| `--admin-border-strong` | `#3d3d3d` | `#d4d4d4` | input borders, secondary button |
| `--admin-text` | `#bbbbbb` | `#555555` | body |
| `--admin-heading` | `#f5f5f5` | `#111111` | titles, row titles, input text |
| `--admin-muted` | `#a8a8a8` | `#6b6b6b` | secondary text, ghost buttons |
| `--admin-subtle` | `#929292` | `#737373` | metadata, hints, column labels |
| `--admin-hover` | `#1d1d1d` | `#f1f1f1` | row / control hover |
| `--admin-primary-bg` / `-text` / `-hover` | `#f5f5f5` / `#0f0f0f` / `#ffffff` | `#111111` / `#ffffff` / `#000000` | one primary action per view |
| `--admin-danger` / `-bg` | `#f87171` / `#2a1214` | `#b91c1c` / `#fbeaea` | delete, failed request |
| `--admin-success` / `-bg` | `#4ade80` / `#10231a` | `#166534` / `#e9f5ed` | published, saved |
| `--admin-warning` / `-bg` | `#fbbf24` / `#241c0c` | `#92400e` / `#fbf1e2` | unsaved changes, upload in progress |
| `--admin-info` / `-bg` | `#93c5fd` / `#101a29` | `#1d4ed8` / `#eaf0fd` | neutral notices |

Contrast (WCAG computed, foreground on its actual background): dark heading 18.7:1,
body 10.6:1, muted 8.6:1, subtle on surface-2 5.8:1, primary label 17.6:1, danger on
danger background 6.4:1, success 9.4:1, warning 10.1:1. Light heading 18.9:1, body
7.5:1, muted on surface-2 4.7:1, subtle 4.5:1, primary label 18.9:1, danger 5.6:1,
success 6.4:1, warning 6.3:1. Every text pair is ≥ 4.5:1 in both themes; the light
`success` value was pulled from `#15803d` (4.48:1, fail) to `#166534` and light `muted`
from `#737373` on `#f1f1f1` (4.2:1) to `#6b6b6b` specifically to clear AA.

Status is never encoded by hue alone: the pill carries the words "Published" / "Draft",
and the dot/icon in front of it is decorative.

### Type

Inter (`var(--font-site-sans)`), tabular figures on all counts, dates and view numbers.

| Role | Size / line-height | Weight / tracking | Colour |
| --- | --- | --- | --- |
| Page title (`h1`) | 24px / 1.25 | 650, `-0.025em` | heading |
| Panel title (`h2`) | 16px / 1.35 | 600, `-0.02em` | heading |
| Eyebrow / column label | 12px / 1.3, uppercase | 600, `+0.08em` | subtle |
| Body, table cells, controls | 14px / 1.5 | 400–500 | text |
| Row title | 14px / 1.4 | 500 | heading |
| Metadata, hints, filter labels | 13px / 1.45 | 400 | subtle / muted |
| Pills, badges | 12px / 1.3 | 600 | status token |
| Editor body and preview | 16px / 1.82 | 400 | text (matches `.site-prose`) |
| Mobile body minimum | 14px | — | — (no admin text below 12px) |

### Spacing, size, radius

4px base scale: `4 / 8 / 12 / 16 / 20 / 24 / 32 / 48`. Page gutter 24px ≥850px, 16px
below. Panel padding 20px (16px on mobile). Row height 56px; list row vertical padding
12px. Control height 36px desktop, 44px touch height below 850px. Radius: 6px controls,
8px panels, 999px pills (public uses 3–6px; nothing rounder). Borders are 1px; the only
shadow allowed in the admin is the top edge of the sticky save bar and the mobile drawer
scrim.

### Layout and breakpoints

| Region | Rule |
| --- | --- |
| Sidebar | 240px fixed, `≥850px`; contains brand, nav, "View site", theme control, log out |
| Top bar | 64px, breadcrumb/current location on the left, status + site link + theme + logout on the right |
| List / dashboard measure | `min(100%, 1120px)` |
| Editor measure | `min(100%, 880px)` (wider than the public 656px column, still a readable editor) |
| Breakpoints | `<600px` stacked, single column, 44px controls, full-width rows with actions on their own line; `600–849px` same shell, two-column field grids; `≥850px` sidebar visible, inline row actions |

The public stylesheet uses `max-width: 850px` and `600px` (`globals.css:393`, `:402`);
the admin reuses those exact two numbers so one mental model covers the whole product.

### Focus, states, motion

- Focus: `outline: 2px solid var(--admin-heading); outline-offset: 2px` on
  `:focus-visible` for links, buttons, inputs, selects, textareas and custom controls —
  the public rule (`globals.css:293`) with a tighter offset for dense layout. Never
  `outline: none` without a replacement.
- Button states: default, hover (`--admin-hover` or `--admin-primary-hover`),
  focus-visible, active (1px translate), disabled (`opacity .5`, `cursor: not-allowed`,
  still focusable), loading (spinner kept inline with the label,
  `aria-busy="true"`).
- Field states: default, hover, focus-visible, `aria-invalid` + `--admin-danger` border,
  disabled. Error text sits below the field and is referenced by `aria-describedby`;
  hint text uses the same mechanism. Implemented and verified in §4.3.
- Spinner source: `src/components/ui/Spinner.tsx` is the legacy white-arc component this
  document originally named for the loading state, and its `role="status"` + `aria-label`
  would fight the button's own busy state. The admin primitives use Phosphor
  `CircleNotchIcon` with `aria-hidden` + `aria-busy` on the control instead, matching the
  rest of the admin chrome; `Spinner.tsx` is left in place for the public site.
- Row states: hover tint, `:focus-within` tint, and a visible pressed state for
  publish/unpublish so a row never looks half-applied.
- Motion: 150–180ms ease on colour and transform only; drawer 250ms; all of it collapses
  under `prefers-reduced-motion: reduce`, mirroring `globals.css:414-416`.

### Control primitives (phase 2 output)

`PageHeader`, `AdminButton`, `AdminInput`, `AdminTextarea`, `AdminSelect`,
`AdminLabel`+`AdminField`, `StatusLabel`, `Notice`, `AdminState` (empty / loading /
error), `ConfirmDialog`, `FormSection`. Icons come from `@phosphor-icons/react`, already
a dependency and already used by public components
(`src/components/public/SocialLinks.tsx:1` imports from `@phosphor-icons/react/ssr` for
server-safe rendering), always with an accessible name when icon-only and `aria-hidden`
when paired with a text label. The EmojiPicker stays — it edits subsection data, not
chrome.

## 5. Where admin density needs more width and stronger action hierarchy

- **Width.** The public 656px column is right for reading and wrong for editing: a post
  row needs title + parent + style + date + state + three actions. The admin content
  measure is `min(100%, 1120px)` and the editor is 880px, both still centred in the
  remaining space next to a 240px sidebar, so a 1440px screen gives ~1120px of usable
  width where the public page would give 656px.
- **Action hierarchy.** Today a row shows a filled button, grey text and red text
  simultaneously, and the dashboard's loudest element is a green "Live" pill that does
  nothing useful. The rule is: exactly one `--admin-primary` action per view (New post,
  Publish), `--admin-secondary` for the reversible local action (Save draft, Preview,
  Continue), `--admin-ghost` for row actions that are safe, and `--admin-danger` reserved
  for destructive confirmations. "View site" becomes a plain underlined external link
  with an external-arrow icon and `target="_blank" rel="noopener noreferrer"`; the green
  Live button and the four oversized stat cards are removed in favour of a single-line
  metrics strip that reports numbers the API can actually supply (published, drafts,
  sections, subsections, tags, hidden count).
- **Row actions on touch.** Actions never depend on hover; below 850px they move to a
  second line at 44px height instead of shrinking.
- **Which numbers the dashboard may show.** Published count, drafts count, sections,
  subsections, tags and the hidden count are all exact counts the server can compute;
  the drafts and hidden figures simply need two more `prisma.count` calls in
  `src/app/api/admin/stats/route.ts`, which today counts published posts only
  (`:20`). The "recently published / continue editing" rows use fields that already
  exist on `Post` (`publishedAt`, `views`, `readTime`, parent `subsection` +
  `topCategory`, `src/types/index.ts:36-60`); "last edited" additionally needs the
  existing `Post.updatedAt` column surfaced by the new list endpoint of checkpoint 6,
  which is stored data, not a derived guess. Nothing date-range, trend or performance
  based is added, because no endpoint can supply it.

## 6. Mockups

Static HTML rendered by Playwright at the same viewports as the audit; the shared
stylesheet is the token file itself, so the mockups and the future implementation cannot
drift apart silently. They were checked against the real fields and actions in
`src/schema/postsSchema.ts`, `src/schema/profileSchema.ts`, `src/types` and
`src/components/admin/post/postForm.tsx` before being drawn: every input in the editor
mockup maps to an existing post field, project URL / cover image appear only inside the
"Project details" group (rendered there because the mocked post is a project post), and
no mockup invents a metric that `src/app/api/admin/stats/route.ts` cannot compute.

| Mockup | Desktop dark | Desktop light | Mobile dark | Mobile light |
| --- | --- | --- | --- | --- |
| Dashboard | [png](mockups/mockup-dashboard-desktop-dark.png) | [png](mockups/mockup-dashboard-desktop-light.png) | [png](mockups/mockup-dashboard-mobile-dark.png) | [png](mockups/mockup-dashboard-mobile-light.png) |
| Post editor (full page) | [png](mockups/mockup-editor-desktop-dark.png) | [png](mockups/mockup-editor-desktop-light.png) | [png](mockups/mockup-editor-mobile-dark.png) | [png](mockups/mockup-editor-mobile-light.png) |
| Post editor (fold, sticky save bar) | [png](mockups/mockup-editor-desktop-dark-fold.png) | — | [png](mockups/mockup-editor-mobile-dark-fold.png) | — |

What the mockups settle: the sidebar/top-bar split and where the theme control lives;
that the dashboard reads as a work list rather than four numbers; that a post row fits
title + hierarchy + state + actions at 1440px and reflows to two lines at 375px; that
the editor keeps a persistent Delete / Save draft / Publish bar and an explicit Preview;
and that both themes hold AA contrast. Sources are committed next to the PNGs
(`mockup-dashboard.html`, `mockup-editor.html`, `admin-mock.css`); open either file with
`?theme=dark` or `?theme=light` and resize to 375px to re-inspect them without any
tooling.

Mockup typography renders in the container's Inter fallback (Liberation Sans) because
the standalone HTML cannot load the app's self-hosted `next/font` Inter; the
implementation applies `var(--font-site-sans)` and is verified in the real build, not in
these PNGs.

## 7. Known limitations of this phase

- No Cloudinary credentials exist in this environment, so the image-upload success path
  cannot be shown; the specification keeps upload as an explicitly designed state
  (in progress / failed / retained input) and the failure path is the one that will be
  tested.
- The pre-change screenshots are intentionally dark-only evidence: the identical light
  files are the measurement that the admin ignores the theme.
- Public CSS, public routes, auth and the API surface were not modified in this phase;
  the only intended public edits in later phases are the named `githubLink` reads in
  `src/components/public/SocialLinks.tsx` / `Sidebar.tsx`.
- Still open inside the shell checkpoint, deliberately deferred: `/admin/login` and
  `/admin/signup` keep their legacy card (no `.admin-shell`, so they remain theme-dead)
  and are converted in the auth-screen pass, and the shell offers "Log out" in both the
  top bar and the sidebar/drawer, which the checkpoint-4 button primitive will
  de-duplicate. `FullScreenLoader` still paints outside the shell with its own dark
  hexes until the checkpoint-4 loading state lands.
