'use client';

import { adminApi } from '@/src/lib/api';
import { Subsection, TopCategory } from '@/src/types';
import { useEffect, useState } from 'react';
import { EmojiPicker } from './EmojiPicker';
import { ContentTypeBadge } from '@/src/components/admin/contentTypeBadge';
import { CONTENT_TYPES, contentTypeFor } from '@/src/components/admin/contentTypes';
import { AdminButton } from '@/src/components/ui/admin-button';
import { ConfirmDialog } from '@/src/components/ui/confirm-dialog';
import { Notice } from '@/src/components/ui/notice';
import { StatusLabel } from '@/src/components/ui/status-label';
import { ContentLoader } from '../../ui/Spinner';

type DisplayStyleInput = 'blog' | 'project' | 'title_only';

export function SubsectionsManager() {
  const [sections, setSections] = useState<TopCategory[]>([]);
  const [subsections, setSubsections] = useState<Subsection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    isVisible: true,
    icon: '📄',
    topCategoryName: '',
    displayStyle: 'blog' as DisplayStyleInput,
  });
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [pendingDelete, setPendingDelete] = useState<Subsection | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const res = await adminApi.getSections() as { sections: TopCategory[] };
      setSections(res.sections);
      
      // Flatten all subsections from all sections
      const allSubsections = res.sections.flatMap((section) => 
        section.subsections?.map(sub => ({
          ...sub,
          topCategory: { name: section.name }
        })) || []
      );
      setSubsections(allSubsections);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      if (editingSlug) {
        await adminApi.updateSubsection(editingSlug, formData);
      } else {
        await adminApi.createSubsection(formData);
      }
      setFormData({ name: '', isVisible: true, icon: '📄', topCategoryName: '', displayStyle: 'blog' });
      setEditingSlug(null);
      setShowForm(false);
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the subsection.');
    }
  };

  const handleEdit = (subsection: Subsection) => {
    // Map Prisma enum to form input
    const displayStyleMap: Record<string, DisplayStyleInput> = {
      'BLOG': 'blog',
      'PROJECT': 'project',
      'TITLE_ONLY': 'title_only'
    };

    setFormData({
      name: subsection.name,
      isVisible: subsection.isVisible,
      icon: subsection.icon,
      topCategoryName: subsection.topCategory?.name || '',
      displayStyle: displayStyleMap[subsection.displayStyle] || 'blog',
    });
    setEditingSlug(subsection.slug);
    setShowForm(true);
  };

  /* Baseline used window.confirm (src/components/admin/subsections/SubSection.tsx:89), which
     named neither the subsection nor what happens to its posts. The API restricts the delete
     while posts reference it (prisma/schema.prisma:81), so the count is stated up front and a
     refusal is reported inline instead of with window.alert. */
  const handleDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await adminApi.deleteSubsection(pendingDelete.slug);
      setPendingDelete(null);
      void fetchData();
    } catch (err) {
      setDeleteError(`${pendingDelete.name} was not deleted. ${err instanceof Error ? err.message : 'The request failed.'}`);
      setPendingDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingSlug(null);
    setFormData({ name: '', isVisible: true, icon: '📄', topCategoryName: '', displayStyle: 'blog' });
    setError('');
  };

  if (loading) {
    return <ContentLoader />;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-[28px] font-normal text-white">Subsections</h1>
        <button
          onClick={() => {
            setShowForm(!showForm);
            if (showForm) handleCancel();
          }}
          className="px-4 py-2 bg-white text-[#0a0a0a] rounded-lg hover:opacity-90 transition text-[13px] font-medium"
        >
          {showForm ? 'Cancel' : '+ New Subsection'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-[#101010] p-6 rounded-xl border border-[#1a1a1a] mb-6">
          {error && (
            <div className="mb-4 p-3 bg-red-950/50 border border-red-900/50 rounded-lg text-[13px] text-red-400">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-[13px] font-medium text-[#e5e5e5] mb-2">
                Subsection Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                placeholder="e.g., Writing, Projects"
                className="w-full px-4 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-white text-[14px] focus:outline-none focus:border-white transition"
              />
            </div>

            <div>
              <EmojiPicker
                value={formData.icon}
                onChange={(emoji) => setFormData({ ...formData, icon: emoji })}
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-[13px] font-medium text-[#e5e5e5] mb-2">
              Parent Section *
            </label>
            <select
              value={formData.topCategoryName}
              onChange={(e) => setFormData({ ...formData, topCategoryName: e.target.value })}
              required
              className="w-full px-4 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-white text-[14px] focus:outline-none focus:border-white transition"
            >
              <option value="">Select a section</option>
              {sections.map((section) => (
                <option key={section.id} value={section.name}>
                  {section.name}
                </option>
              ))}
            </select>
          </div>

          {/* Display Style Selector */}
          <div className="mb-4">
            <label className="block text-[13px] font-medium text-[#e5e5e5] mb-2">
              Display Style *
            </label>
            <div className="grid grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, displayStyle: 'blog' })}
                className={`p-4 rounded-lg border-2 transition ${
                  formData.displayStyle === 'blog'
                    ? 'border-white bg-[#1a1a1a]'
                    : 'border-[#2a2a2a] bg-[#0a0a0a] hover:border-[#3a3a3a]'
                }`}
              >
                <div className="text-left">
                  <ContentTypeHeading displayStyle="blog" />
                </div>
              </button>

              <button
                type="button"
                onClick={() => setFormData({ ...formData, displayStyle: 'project' })}
                className={`p-4 rounded-lg border-2 transition ${
                  formData.displayStyle === 'project'
                    ? 'border-white bg-[#1a1a1a]'
                    : 'border-[#2a2a2a] bg-[#0a0a0a] hover:border-[#3a3a3a]'
                }`}
              >
                <div className="text-left">
                  <ContentTypeHeading displayStyle="project" />
                </div>
              </button>

              <button
                type="button"
                onClick={() => setFormData({ ...formData, displayStyle: 'title_only' })}
                className={`p-4 rounded-lg border-2 transition ${
                  formData.displayStyle === 'title_only'
                    ? 'border-white bg-[#1a1a1a]'
                    : 'border-[#2a2a2a] bg-[#0a0a0a] hover:border-[#3a3a3a]'
                }`}
              >
                <div className="text-left">
                  <ContentTypeHeading displayStyle="title_only" />
                </div>
              </button>
            </div>
          </div>

          <div className="mb-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isVisible}
                onChange={(e) => setFormData({ ...formData, isVisible: e.target.checked })}
                className="w-4 h-4 rounded"
              />
              <span className="text-[13px] text-[#e5e5e5]">Visible on public site</span>
            </label>
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              className="px-4 py-2 bg-white text-[#0a0a0a] rounded-lg hover:opacity-90 transition text-[13px] font-medium"
            >
              {editingSlug ? 'Update Subsection' : 'Create Subsection'}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2 bg-[#1a1a1a] text-white rounded-lg hover:bg-[#2a2a2a] transition text-[13px] font-medium"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {deleteError && (
        <Notice className="mb-[var(--admin-space-4)]" onDismiss={() => setDeleteError('')} tone="error">
          {deleteError}
        </Notice>
      )}

      {/* Subsections List */}
      <div className="space-y-3">
        {subsections.map((subsection) => {
          return (
            <div
              key={subsection.id}
              className="bg-[#101010] p-5 rounded-xl border border-[#1a1a1a] hover:border-[#2a2a2a] transition"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    {/* Stored subsection data (edited with the EmojiPicker), not chrome. */}
                    <span aria-hidden="true" className="text-lg">{subsection.icon}</span>
                    <h3 className="text-[15px] text-white font-medium">{subsection.name}</h3>
                    <StatusLabel tone={subsection.isVisible ? 'live' : 'neutral'}>
                      {subsection.isVisible ? 'Visible' : 'Hidden'}
                    </StatusLabel>
                    <ContentTypeBadge displayStyle={subsection.displayStyle} />
                  </div>
                  <div className="text-[13px] text-[#707070]">
                    {subsection.topCategory?.name} • {subsection.postCount} posts • /{subsection.slug}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <AdminButton
                    aria-label={`Edit ${subsection.name}`}
                    onClick={() => handleEdit(subsection)}
                    size="sm"
                    variant="ghost"
                  >
                    Edit
                  </AdminButton>
                  <AdminButton
                    aria-label={`Delete ${subsection.name}`}
                    onClick={() => {
                      setDeleteError('');
                      setPendingDelete(subsection);
                    }}
                    size="sm"
                    variant="danger"
                  >
                    Delete
                  </AdminButton>
                </div>
              </div>
            </div>
          );
        })}

        {subsections.length === 0 && (
          <div className="bg-[#101010] p-8 rounded-xl border border-[#1a1a1a] text-center">
            <p className="text-[14px] text-[#707070] mb-4">No subsections yet</p>
            <button
              onClick={() => setShowForm(true)}
              className="text-[13px] text-white hover:opacity-70 transition"
            >
              Create your first subsection
            </button>
          </div>
        )}
      </div>

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
          onConfirm={handleDelete}
          title="Delete subsection"
        />
      )}
    </div>
  );
}

/* Heading of one display-style choice in the create form. The wording comes from the shared
   table so the picker cannot promise something the badge on the row does not. */
function ContentTypeHeading({ displayStyle }: { displayStyle: string }): React.ReactElement {
  const type = contentTypeFor(displayStyle);
  const TypeIcon = type.icon;
  const meta = CONTENT_TYPES[type.key];
  return (
    <>
      <span className="mb-1 flex items-center gap-[var(--admin-space-1)] text-[length:var(--admin-text-body)] font-medium text-[color:var(--admin-heading)]">
        <TypeIcon aria-hidden="true" className="size-4" />
        {meta.label}
      </span>
      <span className="block text-[length:var(--admin-text-micro)] text-[color:var(--admin-subtle)]">{meta.description}</span>
    </>
  );
}
