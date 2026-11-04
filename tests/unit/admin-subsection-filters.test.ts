import { describe, expect, it } from 'vitest';
import {
  EMPTY_SUBSECTION_FILTERS,
  groupSubsections,
  isSubsectionFilterActive,
} from '../../src/components/admin/subsections/subsectionFilters';
import type { Subsection, TopCategory } from '@/src/types';

/* Mirrors the seeded shape of the isolated database (6 sections, 7 subsections, one of them
   hidden under "Draft Playground") so the grouping rules the redesigned screen depends on are
   checked without a browser. */
const sub = (over: Partial<Subsection>): Subsection => ({
  displayStyle: 'BLOG',
  id: over.slug ?? over.name ?? 'sub',
  icon: '*',
  isVisible: true,
  name: 'Writing',
  postCount: 0,
  slug: 'writing',
  topCategoryId: 'cat',
  ...over,
});

const WRITING: TopCategory = {
  id: 'cat_writing',
  isVisible: true,
  name: 'Writing',
  subsections: [
    sub({ id: 'sub_engineering', name: 'Engineering', slug: 'engineering' }),
    sub({ id: 'sub_essays', name: 'Essays', slug: 'essays' }),
  ],
};

const PROJECTS: TopCategory = {
  id: 'cat_projects',
  isVisible: true,
  name: 'Projects',
  subsections: [sub({ id: 'sub_projects', name: 'Projects', slug: 'projects' })],
};

const PLAYGROUND: TopCategory = {
  id: 'cat_playground',
  isVisible: false,
  name: 'Draft Playground',
  subsections: [
    sub({ id: 'sub_scratch', isVisible: false, name: 'Scratch', slug: 'scratch' }),
  ],
};

const SECTIONS = [WRITING, PROJECTS, PLAYGROUND];

describe('groupSubsections', () => {
  it('keeps the section -> subsection tree with no filters', () => {
    const { groups, matched, total } = groupSubsections(SECTIONS);
    expect(groups.map((group) => group.section.name)).toEqual([
      'Writing',
      'Projects',
      'Draft Playground',
    ]);
    expect(groups[0]?.subsections.map((item) => item.slug)).toEqual(['engineering', 'essays']);
    expect(matched).toBe(4);
    expect(total).toBe(4);
  });

  it('searches the name and the public slug, case-insensitively', () => {
    expect(
      groupSubsections(SECTIONS, { ...EMPTY_SUBSECTION_FILTERS, search: 'PROJ' }).groups,
    ).toEqual([
      { section: PROJECTS, subsections: [expect.objectContaining({ slug: 'projects' })] },
    ]);
    expect(
      groupSubsections(SECTIONS, { ...EMPTY_SUBSECTION_FILTERS, search: 'engineer' }).matched,
    ).toBe(1);
  });

  it('separates sibling subsections of the same section', () => {
    const essays = groupSubsections(SECTIONS, { ...EMPTY_SUBSECTION_FILTERS, search: 'essays' });
    expect(essays.groups).toHaveLength(1);
    expect(essays.groups[0]?.subsections.map((item) => item.slug)).toEqual(['essays']);
    /* The group header is still the parent section, so the list keeps saying what the subsection
       sits under even while it is filtered down to one row. */
    expect(essays.groups[0]?.section.name).toBe('Writing');
  });

  it('filters by visibility without losing the total', () => {
    const visible = groupSubsections(SECTIONS, { ...EMPTY_SUBSECTION_FILTERS, visibility: 'visible' });
    expect(visible.matched).toBe(3);
    expect(visible.total).toBe(4);
    expect(visible.groups.flatMap((group) => group.subsections).every((item) => item.isVisible)).toBe(
      true,
    );

    const hidden = groupSubsections(SECTIONS, { ...EMPTY_SUBSECTION_FILTERS, visibility: 'hidden' });
    expect(hidden.matched).toBe(1);
    expect(hidden.groups[0]?.section.name).toBe('Draft Playground');
  });

  it('filters by one section and drops the others entirely', () => {
    const { groups, matched } = groupSubsections(SECTIONS, {
      ...EMPTY_SUBSECTION_FILTERS,
      section: 'Writing',
    });
    expect(groups.map((group) => group.section.name)).toEqual(['Writing']);
    expect(matched).toBe(2);
  });

  it('combines the section filter with search instead of letting one win', () => {
    const writingEssays = groupSubsections(SECTIONS, {
      search: 'essays',
      section: 'Writing',
      visibility: 'all',
    });
    expect(writingEssays.matched).toBe(1);

    const wrongSection = groupSubsections(SECTIONS, {
      search: 'essays',
      section: 'Projects',
      visibility: 'all',
    });
    expect(wrongSection.groups).toEqual([]);
    expect(wrongSection.matched).toBe(0);
    // The total is still the whole site, so "0 of 4 subsections" is a truthful empty message.
    expect(wrongSection.total).toBe(4);
  });

  it('drops a section whose subsections all filtered away', () => {
    const { groups } = groupSubsections(SECTIONS, { ...EMPTY_SUBSECTION_FILTERS, search: 'zzz' });
    expect(groups).toEqual([]);
  });
});

describe('isSubsectionFilterActive', () => {
  it('is false for the untouched filter row, including an all-whitespace search', () => {
    expect(isSubsectionFilterActive(EMPTY_SUBSECTION_FILTERS)).toBe(false);
    expect(isSubsectionFilterActive({ ...EMPTY_SUBSECTION_FILTERS, search: '   ' })).toBe(false);
    expect(isSubsectionFilterActive({ ...EMPTY_SUBSECTION_FILTERS, visibility: 'all' })).toBe(false);
  });

  it('is true for any real filter, so "Clear filters" can appear and disappear correctly', () => {
    expect(isSubsectionFilterActive({ ...EMPTY_SUBSECTION_FILTERS, search: 'a' })).toBe(true);
    expect(isSubsectionFilterActive({ ...EMPTY_SUBSECTION_FILTERS, section: 'Writing' })).toBe(true);
    expect(isSubsectionFilterActive({ ...EMPTY_SUBSECTION_FILTERS, visibility: 'hidden' })).toBe(
      true,
    );
  });
});
