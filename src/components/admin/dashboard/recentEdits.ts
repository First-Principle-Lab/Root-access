/* Time label for the dashboard's "recently edited" rows. A component may not call `Date.now()`
   during render (react-hooks/purity, and the baseline hit it at
   src/components/admin/post/titleOnlyItem.tsx:8), so the caller passes the current time in and
   this stays a pure function that can be unit-tested (tests/unit/admin-dashboard-time.test.ts). */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

const DATE_FORMAT = new Intl.DateTimeFormat('en-US', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

export function formatRelativeTime(iso: string | null | undefined, now: number): string {
  if (!iso) return 'no date';
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return 'no date';

  const diff = now - then;
  if (diff < MINUTE) return 'just now';
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)} min ago`;
  if (diff < DAY) {
    const hours = Math.floor(diff / HOUR);
    return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  }
  if (diff < WEEK) {
    const days = Math.floor(diff / DAY);
    return `${days} ${days === 1 ? 'day' : 'days'} ago`;
  }
  return DATE_FORMAT.format(new Date(then));
}

/** The destination of a post on the public site: /(site)/[subsectionSlug]/[postSlug]. */
export function publicPostPath(subsectionSlug: string, postSlug: string): string {
  return `/${subsectionSlug}/${postSlug}`;
}
