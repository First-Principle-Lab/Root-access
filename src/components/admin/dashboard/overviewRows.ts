import type { DashboardStats } from '@/src/types';

/* The dashboard's overview rows (checkpoint 5 of docs/admin-redesign-plan.md). Kept out of the
   component so the wording rules are unit-testable (tests/unit/admin-dashboard-overview.test.ts)
   and so the dashboard cannot invent a number the stats endpoint does not answer: every value is
   read out of `DashboardStats`, which mirrors src/app/api/admin/stats/route.ts field for field. */
export interface OverviewRow {
  href: string;
  hint: string;
  key: string;
  label: string;
  value: number;
}

interface OverviewSource {
  hintKey?: keyof DashboardStats;
  hintText: (hidden: number) => string;
  href: string;
  key: keyof DashboardStats;
  label: string;
}

const OVERVIEW_ROWS: OverviewSource[] = [
  {
    key: 'published',
    label: 'Published posts',
    href: '/admin/posts',
    hintText: () => 'on the public site',
  },
  {
    key: 'drafts',
    label: 'Drafts',
    href: '/admin/posts',
    hintText: () => 'not public yet',
  },
  {
    key: 'sections',
    label: 'Sections',
    href: '/admin/sections',
    hintKey: 'hiddenSections',
    hintText: (value) => `${value} hidden`,
  },
  {
    key: 'subsections',
    label: 'Subsections',
    href: '/admin/subsections',
    hintKey: 'hiddenSubsections',
    hintText: (value) => `${value} hidden`,
  },
  {
    key: 'tags',
    label: 'Tags',
    href: '/admin/tags',
    hintText: () => 'shared across posts',
  },
];

export function buildOverviewRows(stats: DashboardStats): OverviewRow[] {
  return OVERVIEW_ROWS.map((row) => {
    const value = stats[row.key];
    const hidden = row.hintKey ? stats[row.hintKey] : undefined;
    return {
      href: row.href,
      key: row.key,
      label: row.label,
      value,
      hint: row.hintKey
        ? hidden
          ? row.hintText(hidden)
          : 'all visible'
        : row.hintText(value),
    };
  });
}
