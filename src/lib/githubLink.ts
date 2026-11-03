// Public link rules. `githubLink` (prisma/schema.prisma, Profile) only exists since
// prisma/migrations/20261103120000_profile_github_link, and that migration backfills this exact
// address into every existing row, so an unset column is a profile that never edited it: the
// GitHub icon keeps pointing at the author's own account instead of vanishing from the sidebar.
export const DEFAULT_GITHUB_URL = 'https://github.com/parththirwani';

/** The address the public GitHub icon points at for a profile row. */
export function resolveGithubUrl(profile: { githubLink?: string | null } | null | undefined): string {
  const stored = profile?.githubLink?.trim();
  return stored ? stored : DEFAULT_GITHUB_URL;
}
