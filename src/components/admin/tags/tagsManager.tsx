'use client';

import { useEffect, useState } from 'react';
import { HashIcon, PlusIcon, TrashIcon } from '@phosphor-icons/react';
import { adminApi } from '@/src/lib/api';
import { Tag } from '@/src/types';
import { AdminButton } from '@/src/components/ui/admin-button';
import { AdminEmptyState, AdminErrorState, AdminLoadingState } from '@/src/components/ui/admin-state';
import { AdminField, AdminInput } from '@/src/components/ui/admin-field';
import { ConfirmDialog } from '@/src/components/ui/confirm-dialog';
import { FormSection } from '@/src/components/ui/form-section';
import { Notice } from '@/src/components/ui/notice';
import { PageHeader } from '@/src/components/ui/page-header';

/* Tags screen, rebuilt on the checkpoint-4 primitives. Three baseline problems are fixed
   here: the delete control was an unnamed icon button, deletion went through window.confirm
   (which named neither the tag nor the consequence), and a failed delete was reported with
   window.alert. The API refuses to delete a tag that is still on posts with a 409 that
   already says what to do about it (src/app/api/admin/tags/[tagSlug]/route.ts:146), so that
   message is now surfaced in an inline Notice next to the row instead of a modal alert. */
export function TagsManager() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [tagName, setTagName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [pendingDelete, setPendingDelete] = useState<Tag | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    void fetchTags();
  }, []);

  const fetchTags = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = (await adminApi.getTags()) as { tags: Tag[] };
      setTags(res.tags);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load tags.');
      setTags([]);
    } finally {
      setLoading(false);
    }
  };

  const closeForm = () => {
    setShowForm(false);
    setTagName('');
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await adminApi.createTag({ name: tagName });
      closeForm();
      void fetchTags();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the tag.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await adminApi.deleteTag(pendingDelete.slug);
      setPendingDelete(null);
      void fetchTags();
    } catch (err) {
      // Close the dialog on failure too: the row it referred to is still there in the list,
      // where the explanation belongs, and a 409 from this endpoint is a normal outcome.
      setDeleteError(err instanceof Error ? err.message : 'Could not delete the tag.');
      setPendingDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return <AdminLoadingState label="Loading tags" />;
  }

  if (loadError) {
    return (
      <>
        <PageHeader description="One shared list, used by every post." title="Tags" />
        <AdminErrorState message={loadError} onRetry={fetchTags} title="Tags could not be loaded" />
      </>
    );
  }

  return (
    <>
      <PageHeader
        actions={
          showForm ? null : (
            <AdminButton onClick={() => setShowForm(true)} variant="primary">
              <PlusIcon aria-hidden="true" className="size-4" />
              New tag
            </AdminButton>
          )
        }
        description="One shared list. Names are stored in upper case and shown that way on the public site."
        title="Tags"
      />

      {deleteError && (
        <Notice className="mb-[var(--admin-space-4)]" onDismiss={() => setDeleteError('')} tone="error">
          {deleteError}
        </Notice>
      )}

      {showForm && (
        <FormSection
          className="mb-[var(--admin-space-6)]"
          title="New tag"
        >
          <form onSubmit={handleSubmit}>
            <AdminField
              /* The API's duplicate-name 409 is a problem with this one value, so it is
                 reported on the field it belongs to rather than above the form. */
              error={error}
              hint="Names are converted to upper case and must be unique."
              id="tag-name"
              label="Tag name"
              required
            >
              <AdminInput
                onChange={(e) => setTagName(e.target.value)}
                placeholder="AI, Memory, etc."
                required
                value={tagName}
              />
            </AdminField>
            <div className="mt-[var(--admin-space-5)] flex items-center gap-[var(--admin-space-2)]">
              <AdminButton loading={saving} type="submit" variant="primary">
                Create tag
              </AdminButton>
              <AdminButton onClick={closeForm} variant="ghost">
                Cancel
              </AdminButton>
            </div>
          </form>
        </FormSection>
      )}

      {tags.length === 0 ? (
        <AdminEmptyState
          action={
            <AdminButton onClick={() => setShowForm(true)} variant="secondary">
              <PlusIcon aria-hidden="true" className="size-4" />
              Create your first tag
            </AdminButton>
          }
          description="Tags are optional. Add one and it becomes available on every post."
          icon={HashIcon}
          title="No tags yet"
        />
      ) : (
        <ul className="grid grid-cols-1 gap-[var(--admin-space-3)] min-[600px]:grid-cols-2 min-[850px]:grid-cols-3">
          {tags.map((tag) => (
            <li
              className="flex items-center gap-[var(--admin-space-3)] rounded-[var(--admin-radius-panel)] border border-[color:var(--admin-border)] bg-[color:var(--admin-surface)] px-[var(--admin-space-4)] min-h-[var(--admin-row-h)] transition-colors hover:border-[color:var(--admin-border-strong)] focus-within:border-[color:var(--admin-heading)]"
              key={tag.id}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[length:var(--admin-text-body)] font-medium text-[color:var(--admin-heading)]">
                  {tag.name}
                </span>
                <span className="block text-[length:var(--admin-text-micro)] text-[color:var(--admin-subtle)]">
                  {tag.posts?.length || 0} {tag.posts?.length === 1 ? 'post' : 'posts'}
                </span>
              </span>
              <AdminButton
                aria-label={`Delete tag ${tag.name}`}
                onClick={() => {
                  setDeleteError('');
                  setPendingDelete(tag);
                }}
                size="icon-sm"
                variant="ghost"
              >
                <TrashIcon aria-hidden="true" className="size-4" />
              </AdminButton>
            </li>
          ))}
        </ul>
      )}

      {pendingDelete && (
        <ConfirmDialog
          busy={deleting}
          onCancel={() => setPendingDelete(null)}
          onConfirm={confirmDelete}
          title="Delete tag"
          itemName={pendingDelete.name}
          description={
            pendingDelete.posts?.length
              ? `This tag is on ${pendingDelete.posts.length} ${
                  pendingDelete.posts.length === 1 ? 'post' : 'posts'
                }, so deleting it will be refused until it is removed from them.`
              : 'It disappears from the post editor and from the public tag pages. Nothing else changes.'
          }
        />
      )}
    </>
  );
}
