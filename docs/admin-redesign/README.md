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
| `src/components/admin/shell/AdminTopBar.tsx` | 64px bar: current location as the visible heading, 44px hamburger with `aria-expanded` + `aria-controls`, `ThemeToggleButton` from `src/components/spaceui/theme-toggle.tsx`, "Log out" |
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
| Exactly one `a[aria-current="page"]` per shell route, and the top bar heading names the same section, on all 6 routes | pass |
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
  still focusable), loading (spinner from `src/components/ui/Spinner.tsx`, label kept,
  `aria-busy="true"`).
- Field states: default, hover, focus-visible, `aria-invalid` + `--admin-danger` border,
  disabled. Error text sits below the field and is referenced by `aria-describedby`;
  hint text uses the same mechanism.
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
