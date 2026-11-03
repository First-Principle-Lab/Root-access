import type { Subsection, TopCategory } from '@/src/types';

/* Subsection list filtering (checkpoint 5 of docs/admin-redesign-plan.md).
   The baseline had no filter on this screen and flattened the sections response into one long
   list, which is where the section -> subsection -> post hierarchy got lost. The grouping stays a
   tree (a section header, then its subsections), and all three filters are one pure function so
   they are unit-testable without a browser (tests/unit/admin-subsection-filters.test.ts). */

export interface SubsectionFilterState {
  /** Matches the subsection name or its public slug. */
  search: string;
  /** A section name, or '' for every section. */
  section: string;
  visibility: 'all' | 'visible' | 'hidden';
}

export const EMPTY_SUBSECTION_FILTERS: SubsectionFilterState = {
  search: '',
  section: '',
  visibility: 'all',
};

export interface SectionGroup {
  section: TopCategory;
  subsections: Subsection[];
}

export interface SubsectionGroups {
  groups: SectionGroup[];
  /** Subsections that survived the filters. */
  matched: number;
  /** Subsections on the site, whatever the filters say. */
  total: number;
}

export function isSubsectionFilterActive(filters: SubsectionFilterState): boolean {
  return filters.search.trim() !== '' || filters.section !== '' || filters.visibility !== 'all';
}

function matchesSubsection(subsection: Subsection, filters: SubsectionFilterState): boolean {
  if (filters.visibility === 'visible' && !subsection.isVisible) return false;
  if (filters.visibility === 'hidden' && subsection.isVisible) return false;

  const search = filters.search.trim().toLowerCase();
  if (!search) return true;
  return (
    subsection.name.toLowerCase().includes(search) || subsection.slug.toLowerCase().includes(search)
  );
}

/**
 * One pass over the sections response: filter the leaves, drop a section whose subsections all
 * dropped out (an empty group is noise in a filtered list), and report both counts so the
 * "3 of 7 subsections" line and the list can never disagree.
 */
export function groupSubsections(
  sections: TopCategory[],
  filters: SubsectionFilterState = EMPTY_SUBSECTION_FILTERS,
): SubsectionGroups {
  const groups: SectionGroup[] = [];
  let matched = 0;
  /* The whole site, whatever the filters say: the list footer reads "3 of 7 subsections", and the
     7 must not shrink because a section was picked. */
  const total = sections.reduce((sum, section) => sum + (section.subsections?.length ?? 0), 0);

  for (const section of sections) {
    if (filters.section && filters.section !== section.name) continue;

    const subsections = (section.subsections ?? []).filter((subsection) =>
      matchesSubsection(subsection, filters),
    );
    matched += subsections.length;

    if (subsections.length > 0) groups.push({ section, subsections });
  }

  return { groups, matched, total };
}
