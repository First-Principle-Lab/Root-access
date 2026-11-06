'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowUpRightIcon,
  PencilSimpleIcon,
  PlusIcon,
  TrashIcon,
} from '@phosphor-icons/react';
import { adminApi, requestFailureMessage } from '@/src/lib/api';
import { useAdminQuery } from '@/src/lib/adminQuery';
import { adminQueryKeys, invalidateAfter, loadSections } from '@/src/lib/adminQueries';
import { CONTENT_TYPES, contentTypeFor } from '@/src/components/admin/contentTypes';
import type { Subsection } from '@/src/types';
import { cn } from '@/src/lib/cn';
import { AdminButton, adminButtonClass } from '@/src/components/ui/admin-button';
import {
  AdminCheckbox,
  AdminField,
  AdminInput,
  AdminSelect,
} from '@/src/components/ui/admin-field';
import { AdminFilterBar } from '@/src/components/ui/admin-filter-bar';
import { AdminEmptyState, AdminErrorState, AdminLoadingState } from '@/src/components/ui/admin-state';
import { ConfirmDialog } from '@/src/components/ui/confirm-dialog';
import { FormSection } from '@/src/components/ui/form-section';
import { Notice } from '@/src/components/ui/notice';
import { PageHeader } from '@/src/components/ui/page-header';
import { StatusLabel } from '@/src/components/ui/status-label';
import { EmojiPicker } from './EmojiPicker';
import {
  EMPTY_SUBSECTION_FILTERS,
  groupSubsections,
  isSubsectionFilterActive,
  type SubsectionFilterState,
} from './subsectionFilters';

type DisplayStyleInput = 'blog' | 'project' | 'title_only';

const STYLE_OPTIONS: { value: DisplayStyleInput; key: 'blog' | 'project' | 'title_only' }[] = [
  { key: 'blog', value: 'blog' },
  { key: 'project', value: 'project' },
  { key: 'title_only', value: 'title_only' },
];

const PRISMA_TO_INPUT: Record<string, DisplayStyleInput> = {
  BLOG: 'blog',
  PROJECT: 'project',
  TITLE_ONLY: 'title_only',
};

/* Stored data, not chrome: `Subsection.icon` is an emoji column (prisma/schema.prisma:46) that
   the admin edits with EmojiPicker, and this is the value a brand-new subsection starts with.
   Hoisted to one named constant so the emoji-grep for checkpoint 4 has exactly one honest hit
   in this file outside the picker itself. */
const DEFAULT_SUBSECTION_ICON = '\u{1F4C4}';

const EMPTY_FORM = {
  name: '',
  isVisible: true,
  icon: DEFAULT_SUBSECTION_ICON,
  topCategoryName: '',
  displayStyle: 'blog' as DisplayStyleInput,
};

/* Subsections screen (checkpoint 5 of docs/admin-redesign-plan.md §3.2).
   The baseline flattened every section into one alphabetical list, so nothing on the screen said
   which section a subsection belonged to; it reported a failed read only to the console, and its
   create form was a wall of hand-styled inputs. The list is a tree again (section header, then its
   subsections), the three filters sit in the same row they sit in on Posts, and every control is a
   checkpoint-4 primitive. */
export function SubsectionsManager() {
  const sectionsQuery = useAdminQuery(adminQueryKeys.sections, loadSections);
  const sections = useMemo(() => sectionsQuery.data ?? [], [sectionsQuery.data]);
  const loading = sectionsQuery.isLoading;
  const loadError =
    sectionsQuery.data === undefined && sectionsQuery.error !== undefined
      ? requestFailureMessage(sectionsQuery.error, 'Subsections could not be reached. Check your connection and try again.')
      : '';
  const fetchData = () => void sectionsQuery.refresh();
  const [filters, setFilters] = useState<SubsectionFilterState>(EMPTY_SUBSECTION_FILTERS);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [pendingDelete, setPendingDelete] = useState<Subsection | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const { groups, matched, total } = useMemo(() => groupSubsections(sections, filters), [sections, filters]);

  const closeForm = () => {
    setShowForm(false);
    setEditingSlug(null);
    setFormData(EMPTY_FORM);
    setError('');
  };

  const openCreate = () => {
    setFormData({ ...EMPTY_FORM, topCategoryName: filters.section || '' });
    setEditingSlug(null);
    setError('');
    setShowForm(true);
  };

  const openEdit = (subsection: Subsection, sectionName: string) => {
    setFormData({
      name: subsection.name,
      isVisible: subsection.isVisible,
      icon: subsection.icon,
      topCategoryName: sectionName,
      displayStyle: PRISMA_TO_INPUT[subsection.displayStyle] ?? 'blog',
    });
    setEditingSlug(subsection.slug);
    setError('');
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      if (editingSlug) {
        await adminApi.updateSubsection(editingSlug, formData);
      } else {
        await adminApi.createSubsection(formData);
      }
      closeForm();
      invalidateAfter.structure();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the subsection.');
    } finally {
      setSaving(false);
    }
  };

  /* Baseline used window.confirm, which named neither the subsection nor what happens to its
     posts. The API restricts the delete while posts reference it (prisma/schema.prisma:81), so the
     count is stated up front and a refusal is reported inline instead of with window.alert. */
  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await adminApi.deleteSubsection(pendingDelete.slug);
      setPendingDelete(null);
      invalidateAfter.structure();
    } catch (err) {
      setDeleteError(
        `${pendingDelete.name} was not deleted. ${
          err instanceof Error ? err.message : 'The request failed.'
        }`,
      );
      setPendingDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return <AdminLoadingState label="Loading subsections" />;
  }

  const pageHeader = (
    <PageHeader
      actions={
        showForm ? null : (
          <AdminButton onClick={openCreate} variant="primary">
            <PlusIcon aria-hidden="true" className="size-4" />
            New subsection
          </AdminButton>
        )
      }
      title="Subsections"
    />
  );

  if (loadError) {
    return (
      <>
        {pageHeader}
        <AdminErrorState
          message={loadError}
          onRetry={fetchData}
          title="Subsections could not be loaded"
        />
      </>
    );
  }

  const filtersActive = isSubsectionFilterActive(filters);

  return (
    <>
      {pageHeader}

      {deleteError && (
        <Notice className="mb-[var(--admin-space-4)]" onDismiss={() => setDeleteError('')} tone="error">
          {deleteError}
        </Notice>
      )}

      {showForm && (
        <FormSection
          className="mb-[var(--admin-space-6)]"
          description={
            editingSlug
              ? 'Renaming a subsection changes its public URL; existing links to the old address stop working.'
              : 'A subsection is a page of the public site. Posts go inside it.'
          }
          title={editingSlug ? 'Edit subsection' : 'New subsection'}
        >
          <form onSubmit={handleSubmit}>
            {error && (
              <Notice assertive className="mb-[var(--admin-space-4)]" onDismiss={() => setError('')} tone="error">
                {error}
              </Notice>
            )}

            <div className="grid gap-[var(--admin-space-4)] min-[600px]:grid-cols-2">
              <AdminField
                hint="The public address is built from this, e.g. /writing."
                id="subsection-name"
                label="Subsection name"
                required
              >
                <AdminInput
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Writing, Projects"
                  required
                  value={formData.name}
                />
              </AdminField>

              <EmojiPicker
                onChange={(emoji) => setFormData({ ...formData, icon: emoji })}
                value={formData.icon}
              />
            </div>

            <AdminField
              className="mt-[var(--admin-space-4)] max-w-[360px]"
              hint="Every subsection must live in one section."
              id="subsection-section"
              label="Parent section"
              required
            >
              <AdminSelect
                onChange={(e) => setFormData({ ...formData, topCategoryName: e.target.value })}
                required
                value={formData.topCategoryName}
              >
                <option value="">Select a section</option>
                {sections.map((section) => (
                  <option key={section.id} value={section.name}>
                    {section.name}
                  </option>
                ))}
              </AdminSelect>
            </AdminField>

            <fieldset className="mt-[var(--admin-space-4)] border-0 p-0">
              <legend className="mb-[var(--admin-field-gap)] text-[length:var(--admin-text-meta)] font-medium text-[color:var(--admin-heading)]">
                Display style
              </legend>
              <div className="grid gap-[var(--admin-space-2)] min-[600px]:grid-cols-3">
                {STYLE_OPTIONS.map((option) => {
                  const meta = CONTENT_TYPES[option.key];
                  const TypeIcon = contentTypeFor(option.value).icon;
                  const checked = formData.displayStyle === option.value;
                  return (
                    <label
                      className={cn(
                        'flex cursor-pointer items-start gap-[var(--admin-space-2)] rounded-[var(--admin-radius-control)] border p-[var(--admin-space-3)] transition-colors',
                        checked
                          ? 'border-[color:var(--admin-heading)] bg-[color:var(--admin-surface-2)]'
                          : 'border-[color:var(--admin-border-strong)] hover:border-[color:var(--admin-heading)]',
                      )}
                      key={option.value}
                    >
                      <input
                        checked={checked}
                        className="mt-0.5 size-4 shrink-0 cursor-pointer accent-[color:var(--admin-primary-bg)]"
                        name="subsection-display-style"
                        onChange={() => setFormData({ ...formData, displayStyle: option.value })}
                        type="radio"
                        value={option.value}
                      />
                      <span className="min-w-0">
                        <span className="flex items-center gap-[var(--admin-space-1)] text-[length:var(--admin-text-body)] font-medium text-[color:var(--admin-heading)]">
                          <TypeIcon aria-hidden="true" className="size-4" />
                          {meta.label}
                        </span>
                        <span className="mt-0.5 block text-[length:var(--admin-text-micro)] text-[color:var(--admin-subtle)]">
                          {meta.description}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <AdminCheckbox
              checked={formData.isVisible}
              className="mt-[var(--admin-space-4)]"
              id="subsection-is-visible"
              label="Visible on the public site"
              onChange={(e) => setFormData({ ...formData, isVisible: e.target.checked })}
            />
            <p className="mt-1 text-[length:var(--admin-text-micro)] text-[color:var(--admin-subtle)]">
              {formData.isVisible
                ? 'It appears in the public navigation and its published posts are readable.'
                : 'It disappears from the public navigation. Its posts stay in the database, and their URLs stop resolving.'}
            </p>

            <div className="mt-[var(--admin-space-5)] flex items-center gap-[var(--admin-space-2)]">
              <AdminButton loading={saving} type="submit" variant="primary">
                {editingSlug ? 'Save changes' : 'Create subsection'}
              </AdminButton>
              <AdminButton onClick={closeForm} variant="ghost">
                Cancel
              </AdminButton>
            </div>
          </form>
        </FormSection>
      )}

      {total > 0 && (
        <AdminFilterBar
          onClear={
            filtersActive
              ? () => setFilters(EMPTY_SUBSECTION_FILTERS)
              : undefined
          }
          result={`${matched} of ${total} ${total === 1 ? 'subsection' : 'subsections'}`}
        >
          <AdminField className="min-w-[200px] max-w-[280px] flex-1" id="subsection-search" label="Search">
            <AdminInput
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              placeholder="Name or public address"
              type="search"
              value={filters.search}
            />
          </AdminField>
          <AdminField className="min-w-[180px]" id="subsection-filter-section" label="Section">
            <AdminSelect
              compact
              onChange={(e) => setFilters({ ...filters, section: e.target.value })}
              value={filters.section}
            >
              <option value="">All sections</option>
              {sections.map((section) => (
                <option key={section.id} value={section.name}>
                  {section.name}
                </option>
              ))}
            </AdminSelect>
          </AdminField>
          <AdminField className="min-w-[180px]" id="subsection-filter-visibility" label="Visibility">
            <AdminSelect
              compact
              onChange={(e) =>
                setFilters({
                  ...filters,
                  visibility: e.target.value as SubsectionFilterState['visibility'],
                })
              }
              value={filters.visibility}
            >
              <option value="all">Visible and hidden</option>
              <option value="visible">Visible only</option>
              <option value="hidden">Hidden only</option>
            </AdminSelect>
          </AdminField>
        </AdminFilterBar>
      )}

      {total === 0 ? (
        <AdminEmptyState
          action={
            <AdminButton onClick={openCreate} variant="secondary">
              <PlusIcon aria-hidden="true" className="size-4" />
              Create your first subsection
            </AdminButton>
          }
          description="Start with a section if you have not made one yet, then add a subsection to it."
          title="No subsections yet"
        />
      ) : matched === 0 ? (
        <AdminEmptyState
          action={
            <AdminButton onClick={() => setFilters(EMPTY_SUBSECTION_FILTERS)} variant="secondary">
              Clear filters
            </AdminButton>
          }
          description="Nothing matches the search, section and visibility you picked."
          title="No subsections match"
        />
      ) : (
        <div className="flex flex-col gap-[var(--admin-space-6)]">
          {groups.map(({ section, subsections }) => (
            <section aria-label={`${section.name} subsections`} key={section.id}>
              <div className="mb-[var(--admin-space-2)] flex flex-wrap items-center gap-[var(--admin-space-2)]">
                <h2 className="text-[length:var(--admin-text-micro)] font-medium uppercase tracking-[var(--admin-tracking-eyebrow)] text-[color:var(--admin-subtle)]">
                  {section.name}
                </h2>
                {!section.isVisible && <StatusLabel tone="hidden">Section hidden</StatusLabel>}
                <span className="text-[length:var(--admin-text-micro)] text-[color:var(--admin-subtle)]">
                  {subsections.length} {subsections.length === 1 ? 'subsection' : 'subsections'}
                </span>
              </div>

              <ul className="border-t border-[color:var(--admin-border)]">
                {subsections.map((subsection) => (
                  <li
                    className="flex items-center gap-[var(--admin-space-3)] border-b border-[color:var(--admin-border)] px-[var(--admin-space-2)] py-[var(--admin-space-3)] hover:bg-[color:var(--admin-hover)] focus-within:bg-[color:var(--admin-hover)]"
                    key={subsection.id}
                  >
                    {/* Stored subsection data (edited with the EmojiPicker), not chrome. */}
                    <span aria-hidden="true" className="text-[length:var(--admin-text-panel-title)]">
                      {subsection.icon}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-[var(--admin-space-2)]">
                        <span className="truncate text-[length:var(--admin-text-body)] font-medium text-[color:var(--admin-heading)]">
                          {subsection.name}
                        </span>
                        {!subsection.isVisible && <StatusLabel tone="hidden">Hidden</StatusLabel>}
                      </div>
                      <span className="mt-0.5 block text-[length:var(--admin-text-micro)] text-[color:var(--admin-subtle)]">
                        {contentTypeFor(subsection.displayStyle).label} · {subsection.postCount}{' '}
                        {subsection.postCount === 1 ? 'post' : 'posts'} ·{' '}
                        <span className="font-[family-name:var(--admin-font-mono)]">/{subsection.slug}</span>
                      </span>
                    </div>

                    <div className="flex items-center gap-[var(--admin-space-1)]">
                      {subsection.isVisible && (
                        <Link
                          aria-label={`View ${subsection.name} on the public site`}
                          className={adminButtonClass({
                            className: 'hidden min-[600px]:inline-flex',
                            size: 'icon-sm',
                            variant: 'ghost',
                          })}
                          href={`/${subsection.slug}`}
                          rel="noopener"
                          target="_blank"
                        >
                          <ArrowUpRightIcon aria-hidden="true" className="size-4" />
                        </Link>
                      )}
                      <AdminButton
                        aria-label={`Edit ${subsection.name}`}
                        onClick={() => openEdit(subsection, section.name)}
                        size="icon-sm"
                        variant="ghost"
                      >
                        <PencilSimpleIcon aria-hidden="true" className="size-4" />
                      </AdminButton>
                      <AdminButton
                        aria-label={`Delete ${subsection.name}`}
                        onClick={() => {
                          setDeleteError('');
                          setPendingDelete(subsection);
                        }}
size="icon-sm"
                        variant="ghost"
                        className="hover:bg-[color:var(--admin-danger-bg)] hover:text-[color:var(--admin-danger)]"
                      >
                        <TrashIcon aria-hidden="true" className="size-4" />
                      </AdminButton>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {pendingDelete && (
        <ConfirmDialog
          busy={deleting}
          description={
            pendingDelete.postCount
              ? `${pendingDelete.postCount} ${pendingDelete.postCount === 1 ? 'post' : 'posts'} live in it, so the delete will be refused until they are moved or deleted.`
              : 'It disappears from the public navigation and from the post editor. No posts are inside it.'
          }
          itemName={pendingDelete.name}
          onCancel={() => setPendingDelete(null)}
          onConfirm={confirmDelete}
          title="Delete subsection"
        />
      )}
    </>
  );
}
