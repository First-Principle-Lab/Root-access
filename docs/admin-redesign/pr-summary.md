# PR summary - admin redesign (`feat/admin-redesign-run` -> `dev`)

Deliverables are the seven rows of `docs/admin-redesign-plan.md:11-19`; each is mapped to the files
that carry it, with the tests and screenshots that prove it. Design rationale and the measured
verification tables are in [`README.md`](README.md) (sections 4.1-4.10); the acceptance run record is
[README 4.10](README.md#410-acceptance-run-record-checkpoint-10).

## 1. Admin design system

- `src/app/admin/admin.css` (new) - the token layer: theme-independent metric tokens (Inter via the
  public `--font-site-sans`, 12/13/14/16/24px type scale, 4px spacing scale, 1120px list / 880px
  editor / 240px sidebar / 64px header measures, radii, the 2px focus ring, form metrics, motion)
  plus the light colour set on `body:has(.admin-shell)` and the dark set on
  `html.dark body:has(.admin-shell)`, reusing the public palette from `src/app/globals.css:240-269`.
  Flat surfaces only - the public generative/tree background is deliberately not carried in. It also
  owns the one unlayered `:focus-visible` rule and the `.admin-md-preview` re-colouring.
- `src/app/admin/layout.tsx` - imports the stylesheet once, so it loads on `/admin` only.
- `src/components/admin/adminLayout.tsx` - the first consumer; its ten hard-coded hex values became
  token utilities.
- Proof: README 4.1 (9-row measured verification table, hard-coded colour census 304 -> 39 literals
  in 5 files with each exception named), `after-*` screenshots in both themes.

## 2. Shared shell

- `src/components/admin/shell/adminRoutes.ts`, `adminNav.tsx`, `AdminSidebar.tsx`, `AdminTopBar.tsx`
  (new) - route table, Phosphor nav icons replacing the six emoji glyphs, persistent 240px sidebar
  with `aria-current="page"`, an ordinary `target="_blank" rel="noopener noreferrer"` "View site"
  link, logout, the existing `next-themes` `ThemeToggleButton`, and the current location as
  `data-admin-location`.
- `src/components/admin/adminLayout.tsx` - composes the shell: drawer + scrim with `aria-expanded` /
  `aria-controls` / `role="dialog"`, body scroll lock, skip link to a focusable `main#admin-main`,
  stacking `top bar > drawer > scrim > sidebar`, auth redirect and `adminApi.logout()` preserved.
- `src/hooks/useFocusTrap.ts` (new) - Escape, two-way Tab containment with `preventDefault` on every
  Tab, and focus restoration; shared by the drawer and the dialog.
- Theme goes through the existing provider only (`src/app/layout.tsx:45`,
  `src/components/spaceui/theme-toggle.tsx`); no second implementation, no `localStorage` code.
- Proof: `tests/e2e/admin-shell.spec.ts` (17 tests), README 4.2.

## 3. Reusable controls

- `src/components/ui/`: `page-header.tsx`, `admin-button.tsx`, `admin-field.tsx` (input / textarea /
  select / checkbox with `aria-invalid` + `aria-describedby` delivered by context),
  `status-label.tsx`, `notice.tsx`, `admin-state.tsx` (empty / loading / error),
  `confirm-dialog.tsx`, `form-section.tsx`, `admin-filter-bar.tsx`, `contentTypeBadge.tsx`.
- `src/components/admin/contentTypes.ts` + `contentTypeBadge.tsx` - one display-style table, so the
  six-row emoji table copied across five files is gone.
- Every `window.confirm()` and `window.alert()` in the admin is gone; chrome emoji are gone.
- Proof: `tests/e2e/admin-controls.spec.ts` (6), the emoji grep (`grep -rnP` over
  `src/components/admin` returns only `EmojiPicker.tsx`, which is stored-data palette), README 4.3.

## 4. Content screens

- `src/components/admin/dashboard/adminDashboard.tsx` + `overviewRows.ts` + `recentEdits.ts` - the
  four oversized stat cards and the green "Live" `animate-ping` button are replaced by a draft
  notice, one overview row per screen with real counts, and "Recently edited" from the list
  endpoint.
- `src/components/admin/section/sectionManager.tsx`, `subsections/SubSection.tsx` +
  `subsectionFilters.ts`, `post/PostsManager.tsx` + `postListItem.tsx`, `tags/tagsManager.tsx`,
  `profile/profileManager.tsx` + `profileForm.ts` - all six screens rebuilt on the primitives with
  page title, one primary action, filters and row actions in the same positions, and the
  section -> subsection -> post hierarchy visible.
- Proof: `tests/e2e/admin-content-screens.spec.ts` (15), 48 screenshots in `after-screens/`, README
  4.4-4.5.

## 5. Publishing workflow (the functional core)

- `src/app/api/admin/posts/route.ts` (new) - one authenticated list endpoint with zod-validated
  query, server-side search / status / subsection / order / paging and 401 / 400 / 500 semantics;
  `src/lib/postFilters.ts` holds the pure where / order / paging / pagination-window rules.
- `src/components/admin/post/PostsManager.tsx` - the fan-out
  `allSubsections.map(sub => adminApi.getPosts(sub.slug).catch(() => ({ posts: [] })))` is deleted:
  9 API requests became 3, and a failed list is now an error state with retry instead of an empty
  list.
- `src/components/admin/post/PostEditor.tsx` behind `src/app/admin/posts/new/page.tsx` and
  `src/app/admin/posts/edit/[subsectionSlug]/[postSlug]/page.tsx` (App Router wrappers) replaces the
  old inline create form (`postForm.tsx`) and `PostEditModal.tsx`: full-width writing area, fixed
  save/publish bar, explicit markdown preview, unsaved-changes guard (`beforeunload` +
  `ConfirmDialog`), project-only URL/year fields, compact title-only flow, all post fields and the
  three style-specific validation rules preserved (`src/lib/postEditor.ts`, `postDraftSchema` in
  `src/schema/postsSchema.ts`).
- `src/components/admin/post/MarkDownEditor.tsx` - tokenised toolbar, named Write/Preview buttons,
  upload through `src/lib/api.ts` with an actionable failure message.
- Proof: `tests/e2e/admin-post-list.spec.ts` (8, including the request-count proof),
  `tests/e2e/admin-post-editor.spec.ts` (10, the per-display-style lifecycle with row counts
  asserted before and after), `tests/integration/admin-post-list*.test.ts` (10),
  `tests/unit/admin-post-filters.test.ts` (20), `tests/unit/admin-post-editor.test.ts` (25), README
  4.5-4.6.

## 6. Profile controls and the editable `githubLink`

- `prisma/schema.prisma` - `Profile.githubLink String?`.
- `prisma/migrations/20261103120000_profile_github_link/migration.sql` - `ADD COLUMN` plus a
  `UPDATE ... WHERE "githubLink" IS NULL` backfill, so the existing GitHub link survives.
- `src/schema/profileSchema.ts` - `profileUrlSchema` / `profileEmailSchema` exported and
  `githubLink` inside `updateProfileSchema`; the admin form and the PATCH route read the same rules.
- `src/components/admin/profile/profileManager.tsx` - the GitHub input sits at the head of the
  existing Social links group (Picture / Bio / Contact / Social links / Resume groups).
- `src/lib/githubLink.ts` (new) - `DEFAULT_GITHUB_URL` + `resolveGithubUrl()`, the only remaining
  literal `github.com/parththirwani` in `src/`; `src/components/public/SocialLinks.tsx` and
  `src/components/public/Sidebar.tsx` now use it instead of hard-coding the address, and the three
  public profile reads (`src/app/(site)/page.tsx`, `src/components/public/Sidebar/SidebarServer.tsx`,
  `src/app/api/public/layout/route.ts`) select the column.
- Proof: `tests/integration/admin-profile-github.test.ts` (10), `tests/unit/public-github-link.test.ts`
  (6), `tests/e2e/github-link.spec.ts` (6), the acceptance profile/resume round trip, README 4.7.

## 7. Verification package

- `tests/unit/` (9 files, 94 tests), `tests/integration/` (4 files, 24 tests), `tests/e2e/` (8 files,
  83 browser tests) plus `tests/e2e/helpers/adminAuth.ts` and `tests/integration/helpers/session.ts`,
  `vitest.config.ts`, `playwright.config.ts`, and `test` / `test:unit` / `test:e2e` scripts in
  `package.json`. Coverage map: README 4.8.
- `tests/e2e/admin-acceptance.spec.ts` (new, 12 tests) is the acceptance table: route protection and
  login/logout, the public site serving only published/visible content, publishing reaching the
  public site and unpublishing taking it away, the section / subsection / resume lifecycles, the
  375/768/1440 sweep, accessible names, visible focus and token contrast in both themes.
- Screenshots: `before/` 28, `mockups/` 10 (+ their HTML/CSS sources), `after-shell/` 26,
  `after-controls/` 24, `after-screens/` 48, `after-editor/` 22, `after-github-link/` 12,
  `after-auth/` 4.
- Written spec and run records: README sections 1-7.

## Migration and rollback

- Apply: `npx prisma migrate deploy` (verified on a rewound fresh copy of the database, on an empty
  database, and on the isolated dev database; `npx prisma migrate status` clean and an empty
  `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script`).
  Evidence: `/tmp/cora/evidence/admin-run-iter8/cp8-migration.log`.
- Shape: one nullable column plus a guarded `UPDATE`; no type changes, no data loss, and existing
  profile rows survive (asserted by the integration tests).
- Rollback: `ALTER TABLE "Profile" DROP COLUMN IF EXISTS "githubLink";` and delete the matching row
  from `_prisma_migrations`. Nothing else in this branch touches the schema, so the rest of the
  branch is a plain code revert.

## Known limitations

1. **No Cloudinary credentials in this environment.** The image-upload *success* path (profile
   picture, post cover) cannot be evidenced; the failure path is (visible actionable error, input
   retained, nothing stored) - `admin-failure-paths.spec.ts` and `admin-post-editor.spec.ts`.
2. **`/admin/login` and `/admin/signup` are still outside `.admin-shell`.** They keep their
   pre-redesign card and therefore ignore the light theme; `after-auth/`'s dark and light files are
   byte-identical, which is the measurement, not a capture bug. No acceptance row depends on them.
3. **No assistive technology is installed**, so screen-reader support is asserted through ARIA
   semantics, accessible names and focus restoration rather than by listening to a reader.
4. **Public pages are ISR (`revalidate = 60`, `stale-while-revalidate = 31535940`) and that is
   pre-existing behaviour this branch does not change**: a just-saved change can take up to a minute
   to appear in the rendered public HTML, and - measured, see README 4.10 - a withdrawn post can keep
   serving one stale cached response before it 404s. Tests use the uncached `/api/public/layout` read
   where an immediate answer is required and poll the rendered page otherwise. Revalidation on
   publish (instead of a timed window) is out of scope here.
5. Five files under `src/components/admin/post/` were already unreferenced at the branch base
   (`postList`, `postCard`, `blogPost`, `titleOnlyItem`, `filterBar`) and still carry their baseline
   hexes; they are named in README 4.9 rather than silently deleted.
6. Large-list behaviour is exercised at two pages of ten rows (the seed holds 17 posts), not at
   hundreds.
