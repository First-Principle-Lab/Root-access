'use client';

import { useEffect, useState } from 'react';
import { PencilSimpleIcon, PlusIcon, TrashIcon } from '@phosphor-icons/react';
import { adminApi } from '@/src/lib/api';
import { TopCategory } from '@/src/types';
import { AdminButton } from '@/src/components/ui/admin-button';
import { AdminEmptyState, AdminErrorState, AdminLoadingState } from '@/src/components/ui/admin-state';
import { AdminCheckbox, AdminField, AdminInput } from '@/src/components/ui/admin-field';
import { ConfirmDialog } from '@/src/components/ui/confirm-dialog';
import { FormSection } from '@/src/components/ui/form-section';
import { Notice } from '@/src/components/ui/notice';
import { PageHeader } from '@/src/components/ui/page-header';
import { StatusLabel } from '@/src/components/ui/status-label';

/* Sections screen on the checkpoint-4 primitives. The baseline row was name + a green/grey
   pill + two text buttons with the same visual weight, `confirm()` naming nothing
   (src/components/admin/section/sectionManager.tsx:57), and a visibility checkbox with no
   word about what it does. The consequence of deleting a section is real and not obvious:
   `Subsection.topCategory` cascades (prisma/schema.prisma:56) while `Post.subsection`
   restricts (`:81`), so the subsections go with it and the delete fails if any post is left
   inside them. That is now said out loud, in the dialog, before the click. */
const EMPTY_FORM = { name: '', isVisible: true };

export function SectionsManager() {
  const [sections, setSections] = useState<TopCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [pendingDelete, setPendingDelete] = useState<TopCategory | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    void fetchSections();
  }, []);

  const fetchSections = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = (await adminApi.getSections()) as { sections: TopCategory[] };
      setSections(res.sections);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load sections.');
      setSections([]);
    } finally {
      setLoading(false);
    }
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData(EMPTY_FORM);
    setError('');
  };

  const openCreate = () => {
    setFormData(EMPTY_FORM);
    setEditingId(null);
    setError('');
    setShowForm(true);
  };

  const openEdit = (section: TopCategory) => {
    setFormData({ name: section.name, isVisible: section.isVisible });
    setEditingId(section.id);
    setError('');
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      if (editingId) {
        await adminApi.updateSection(editingId, formData);
      } else {
        await adminApi.createSection(formData);
      }
      closeForm();
      void fetchSections();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the section.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await adminApi.deleteSection(pendingDelete.id);
      setPendingDelete(null);
      void fetchSections();
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
    return <AdminLoadingState label="Loading sections" />;
  }

  if (loadError) {
    return (
      <>
        <PageHeader description="The top level of the site navigation." title="Sections" />
        <AdminErrorState
          message={loadError}
          onRetry={fetchSections}
          title="Sections could not be loaded"
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        actions={
          showForm ? null : (
            <AdminButton onClick={openCreate} variant="primary">
              <PlusIcon aria-hidden="true" className="size-4" />
              New section
            </AdminButton>
          )
        }
        description="The top level of the site navigation. Each section holds subsections, and each subsection holds posts."
        title="Sections"
      />

      {deleteError && (
        <Notice className="mb-[var(--admin-space-4)]" onDismiss={() => setDeleteError('')} tone="error">
          {deleteError}
        </Notice>
      )}

      {showForm && (
        <FormSection
          className="mb-[var(--admin-space-6)]"
          description={editingId ? 'Renaming a section does not change its subsections.' : undefined}
          title={editingId ? 'Edit section' : 'New section'}
        >
          <form onSubmit={handleSubmit}>
            <AdminField
              error={error}
              hint="Shown in the public navigation exactly as typed."
              id="section-name"
              label="Section name"
              required
            >
              <AdminInput
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Craft, Lists"
                required
                value={formData.name}
              />
            </AdminField>

            <AdminCheckbox
              checked={formData.isVisible}
              className="mt-[var(--admin-space-4)]"
              id="section-is-visible"
              label="Visible on the public site"
              onChange={(e) => setFormData({ ...formData, isVisible: e.target.checked })}
            />
            <p className="mt-1 text-[length:var(--admin-text-micro)] text-[color:var(--admin-subtle)]">
              {formData.isVisible
                ? 'The section and its subsections appear in the public navigation.'
                : 'The section is hidden from the public navigation. Its posts stay in the database.'}
            </p>

            <div className="mt-[var(--admin-space-5)] flex items-center gap-[var(--admin-space-2)]">
              <AdminButton loading={saving} type="submit" variant="primary">
                {editingId ? 'Save changes' : 'Create section'}
              </AdminButton>
              <AdminButton onClick={closeForm} variant="ghost">
                Cancel
              </AdminButton>
            </div>
          </form>
        </FormSection>
      )}

      {sections.length === 0 ? (
        <AdminEmptyState
          action={
            <AdminButton onClick={openCreate} variant="secondary">
              <PlusIcon aria-hidden="true" className="size-4" />
              Create your first section
            </AdminButton>
          }
          description="Start with a section, then add subsections to it. Posts live in subsections."
          title="No sections yet"
        />
      ) : (
        <ul className="flex flex-col overflow-hidden rounded-[var(--admin-radius-panel)] border border-[color:var(--admin-border)] bg-[color:var(--admin-surface)]">
          {sections.map((section) => (
            <li
              className="flex flex-wrap items-center gap-[var(--admin-space-3)] border-t border-[color:var(--admin-border)] px-[var(--admin-space-5)] py-[var(--admin-space-3)] transition-colors first:border-t-0 hover:bg-[color:var(--admin-hover)] focus-within:bg-[color:var(--admin-hover)]"
              key={section.id}
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-[var(--admin-space-2)]">
                  <span className="truncate text-[length:var(--admin-text-body)] font-medium text-[color:var(--admin-heading)]">
                    {section.name}
                  </span>
                  <StatusLabel tone={section.isVisible ? 'live' : 'neutral'}>
                    {section.isVisible ? 'Visible' : 'Hidden'}
                  </StatusLabel>
                </div>
                <span className="mt-0.5 block text-[length:var(--admin-text-micro)] text-[color:var(--admin-subtle)]">
                  {section.subsections?.length || 0}{' '}
                  {section.subsections?.length === 1 ? 'subsection' : 'subsections'}
                </span>
              </div>

              <div className="flex items-center gap-[var(--admin-space-1)]">
                <AdminButton
                  aria-label={`Edit ${section.name}`}
                  onClick={() => openEdit(section)}
                  size="icon-sm"
                  variant="ghost"
                >
                  <PencilSimpleIcon aria-hidden="true" className="size-4" />
                </AdminButton>
                <AdminButton
                  aria-label={`Delete ${section.name}`}
                  onClick={() => {
                    setDeleteError('');
                    setPendingDelete(section);
                  }}
                  size="sm"
                  variant="danger"
                >
                  <TrashIcon aria-hidden="true" className="size-4" />
                  Delete
                </AdminButton>
              </div>
            </li>
          ))}
        </ul>
      )}

      {pendingDelete && (
        <ConfirmDialog
          busy={deleting}
          description={
            pendingDelete.subsections?.length
              ? `Its ${pendingDelete.subsections.length} ${
                  pendingDelete.subsections.length === 1 ? 'subsection is' : 'subsections are'
                } deleted with it. Posts inside them are not deleted, so this will be refused until those posts are moved or deleted.`
              : 'It disappears from the public navigation. There are no subsections to lose.'
          }
          itemName={pendingDelete.name}
          onCancel={() => setPendingDelete(null)}
          onConfirm={confirmDelete}
          title="Delete section"
        />
      )}
    </>
  );
}
