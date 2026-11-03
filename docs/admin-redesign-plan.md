# Admin redesign plan

## Goal and references

Make `/admin` feel like the editing side of the public portfolio while making common publishing work faster and clearer. Use the current public site as the source for type, colors, spacing, borders, and dark/light behavior. The original Anthony Fu reference is captured in [`docs/design-review/reference-dark-desktop.png`](design-review/reference-dark-desktop.png) and its light and mobile counterparts. Those images show a public portfolio, not an admin interface; adapt their visual language to an editor rather than copying their page layout.

The public site already has theme tokens in `src/app/globals.css` under `.site-shell`. The admin still uses hard-coded dark colors, emoji navigation, a fixed sidebar, and separate styling across pages. Preserve the current content model, public URLs, authentication, and published content while replacing the admin presentation and improving the workflows below.

## Deliverables

| Deliverable | Required result |
| --- | --- |
| Admin design system | Scoped admin color, type, spacing, border, focus, and form tokens for dark and light modes. Reuse the public site's Inter font and palette values where appropriate. Avoid copying public background effects into dense forms and lists. |
| Shared shell | Responsive admin header/navigation with clear current location, a link to the live site, a visible theme control, and logout. On mobile, navigation opens and closes with keyboard and screen reader support. |
| Reusable controls | One set of page headers, buttons, inputs, selects, status labels, notices, empty/loading/error states, confirmation dialog, and form sections. Replace emoji used as navigation or content type icons with the existing Phosphor icon family. |
| Content screens | Redesign dashboard, sections, subsections, posts, tags, and profile. Keep page titles, primary actions, filters, and row actions in consistent positions. Show hierarchy as section → subsection → post. |
| Publishing workflow | Make draft/published state and destination clear; support search, subsection and status filtering, create/edit, preview, publish/unpublish, and delete with feedback. Preserve all existing post fields and style-specific validation for writing, projects, and title-only items. |
| Profile controls | Group bio, image, contact, social links, and resume settings. Move the currently hard-coded GitHub profile URL into an editable profile field, with the necessary Prisma migration, API validation, admin form, and public reads. Existing profile data and the current GitHub link must survive migration. |
| Verification package | Before/after screenshots at agreed desktop and mobile sizes, a short manual test record, automated test output, and a PR summary mapping each deliverable to changed files. |

## Work sequence for the implementing agent

### 1. Audit and design specification

1. Start from updated `main` on a feature branch. Record the current behavior of `/admin`, `/admin/sections`, `/admin/subsections`, `/admin/posts`, `/admin/tags`, `/admin/profile`, and `/admin/login` at 1440 × 900 and 375 × 844. Use an authorized local test account and isolated test data. Do not use production content for delete tests.
2. Compare those screens with the public site's dark and light pages and the reference images in `docs/design-review/`. Record the visual rules that should carry over: restrained monochrome palette, Inter, quiet borders, clear type hierarchy, compact metadata, and generous reading space. Record where admin density calls for a wider content area and stronger action hierarchy.
3. Produce a compact design specification with color tokens, type sizes, spacing, breakpoints, control states, and two representative mockups: the dashboard and post editor at desktop and mobile widths. Check the mockups against the real fields and actions before building.

### 2. Build the shared shell and theme

1. Replace the hard-coded colors in `src/components/admin/adminLayout.tsx` with admin-scoped tokens in `src/app/globals.css` or a dedicated admin stylesheet. Keep the scope separate from `.site-shell` to prevent public regressions.
2. Use the existing `site-theme` preference for both public and admin pages. Default to the current public-site behavior when no preference exists. Apply the preference before paint if possible so navigation between public and admin does not flash the wrong theme. Respect system reduced-motion settings.
3. Build the shared controls before converting individual pages. Make icon buttons have accessible names, visible focus rings, and sufficiently large touch targets.
4. Convert the login screen to the same visual language while preserving the existing authentication flow and error handling.

### 3. Redesign information architecture and workflows

1. Dashboard: replace the four large statistic cards and the ambiguous green “Live” button with a concise overview of published posts, drafts, sections, and recent editing tasks. Make “View site” an ordinary external link. Avoid adding metrics that the API cannot supply accurately.
2. Sections and subsections: show the hierarchy and visibility clearly. Keep create/edit controls near the list they affect. Explain the public impact of hiding a section or subsection. Preserve names, slugs, display styles, and existing CRUD behavior.
3. Posts: use a scannable list with title, parent subsection, type, date, and publication state. Add search, status, and subsection filters; keep row actions visible on touch devices. The current `PostsManager` fetches posts once per subsection and silently turns failed requests into empty lists. Provide a single authenticated list endpoint with server-side filtering/pagination or another measured approach that avoids that fan-out and reports loading errors.
4. Editor: give writing a full-width editing area, a persistent save/publish area, an explicit preview, and a clear unsaved-changes warning. Show project URL and image fields only for project posts, and keep the title-only flow compact. Make save/publish failures and upload progress visible. Preserve markdown, image upload, tags, year, and all current field values.
5. Tags and profile: use the same form and list patterns. Replace browser `confirm()` calls with one accessible confirmation dialog that names the item and consequence. Ensure delete controls remain visible without hover.
6. Keep API and database changes focused on the workflow. In particular, add an editable `githubLink` with a safe migration/backfill so the GitHub icon continues to link to `https://github.com/parththirwani` after release.

### 4. Polish and review

1. Remove dead CSS and duplicated admin controls after each page moves to the new system. Keep public-site CSS and routes unchanged unless a planned profile or theme integration requires a small edit.
2. Review dark and light modes at 375, 768, and 1440 px. Check long titles, empty lists, validation errors, upload failures, and a large post list.
3. Put screenshots and a brief change log in the PR. Note any known limitations and confirm migration and rollback steps before merging.

## Acceptance tests

| Area | Test and pass condition |
| --- | --- |
| Build and static checks | `npm run build` and TypeScript pass. ESLint passes on touched files; report any existing unrelated lint failures separately. |
| Theme | Dark/light choice persists across refresh and public/admin navigation. Text, borders, controls, and editor preview remain readable in both modes without a theme flash. |
| Responsive layout | At 375, 768, and 1440 px, no horizontal page overflow; navigation, forms, lists, and editor actions remain usable. |
| Accessibility | Keyboard can reach and operate navigation, dialogs, forms, filters, and editor actions. Focus is visible; dialogs trap and restore focus; icons have names; error messages are associated with fields. Check contrast and reduced motion. |
| Content lifecycle | On isolated test data, create, edit, preview, publish, unpublish, filter, and delete each supported post type. Refresh after every saved action to confirm persistence. Verify public pages reflect only published content and expected visibility rules. |
| Structure and profile | Create/edit/hide sections and subsections; create/delete tags; update bio, social URLs including GitHub, image, and resume. Verify public links and content remain correct. |
| Failure paths | Simulate failed list, save, upload, and delete requests. The UI shows an actionable error and retains unsaved input. Canceling a destructive action changes nothing. |
| Regression | Login/logout and route protection still work. Existing public home, archives, articles, project links, social links, and theme toggle behave as before. |

Use focused unit tests for new filtering/validation logic, API integration tests for list and profile changes, and browser tests for the critical authenticated flows. Visual snapshots support review but do not replace the interaction tests. Avoid tests that merely restate component markup.

## Agent handoff

Give the implementing agent this instruction with the plan file:

> Implement `docs/admin-redesign-plan.md` from current `main`. First audit the existing admin screens and public design, then produce the two representative mockups and design tokens. Build the shared shell and controls, migrate each admin page, and complete the publishing and profile workflows. Preserve current data, auth, public URLs, and published behavior. Use an isolated test database for destructive tests. Run the acceptance checks, attach desktop/mobile dark/light screenshots, and open a PR with a deliverable checklist, migration notes, and any remaining issues. Do not claim visual similarity from a score alone; show the actual screens and working flows.

The agent should finish one phase before widening the next. Review the shell and dashboard first, then the editor and remaining CRUD pages. The PR is ready when the acceptance table passes and the screenshots show a coherent admin interface in both themes.
