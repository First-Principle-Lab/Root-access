'use client';

import { useRef, useState } from 'react';
import { Post } from '@/src/types';
import { XIcon } from '@phosphor-icons/react';
import { ContentTypeBadge } from '@/src/components/admin/contentTypeBadge';
import { MarkdownEditor } from '../post/MarkDownEditor';

interface PostEditModalProps {
  post: Post;
  onClose: () => void;
  onSave: () => void;
}

export function PostEditModal({ post, onClose, onSave }: PostEditModalProps) {
  const [formData, setFormData] = useState({
    title: post.title,
    description: post.description,
    content: post.content,
    excerpt: post.excerpt || '',
    coverImage: post.coverImage || '',
    published: post.published,
    tags: post.tags.map((t) => t.name).join(', '),
    projectLink: post.projectLink || '',
    archiveYear: post.archiveYear,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [coverUploading, setCoverUploading] = useState(false);
  const [coverUploadError, setCoverUploadError] = useState('');
  const coverInputRef = useRef<HTMLInputElement>(null);

  const displayStyle = post.subsection.displayStyle as string;
  const isBlog      = displayStyle === 'BLOG';
  const isProject   = displayStyle === 'PROJECT';
  const isTitleOnly = displayStyle === 'TITLE_ONLY';

  // Reuse the same /api/admin/upload endpoint your profile picture uses.
  // It sends base64 → Cloudinary → returns { url, publicId }
  const handleCoverUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setCoverUploadError('Please select an image file');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setCoverUploadError('Image must be under 5MB');
      return;
    }

    setCoverUploading(true);
    setCoverUploadError('');

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      try {
        const response = await fetch('/api/admin/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ image: reader.result }),
        });
        if (!response.ok) throw new Error('Upload failed');
        const data = await response.json();
        setFormData((prev) => ({ ...prev, coverImage: data.url }));
      } catch {
        setCoverUploadError('Upload failed. Make sure CLOUDINARY_* env vars are set.');
      } finally {
        setCoverUploading(false);
      }
    };
    reader.onerror = () => {
      setCoverUploadError('Failed to read file');
      setCoverUploading(false);
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const tags = formData.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const response = await fetch(
        `/api/admin/subsections/${post.subsection.slug}/posts/${post.slug}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ ...formData, tags }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to update post');
      }

      onSave();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update post');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">

        {/* ── Header ── */}
        <div className="sticky top-0 bg-[#0a0a0a] border-b border-[#1a1a1a] p-4 sm:p-6 flex items-center justify-between z-10">
          <div>
            <h2 className="text-xl sm:text-2xl text-white font-normal">Edit Post</h2>
            <p className="text-sm text-neutral-500 mt-0.5">
              <span className="inline-flex flex-wrap items-center gap-[var(--admin-space-2)]">
                {post.subsection.name}
                <span aria-hidden="true">·</span>
                <ContentTypeBadge displayStyle={post.subsection.displayStyle} />
              </span>
            </p>
          </div>
          <button
            aria-label="Close editor"
            className="flex size-[var(--admin-control-h)] shrink-0 items-center justify-center rounded-[var(--admin-radius-control)] text-[color:var(--admin-muted)] transition hover:bg-[color:var(--admin-hover)] hover:text-[color:var(--admin-heading)] max-[849px]:size-[var(--admin-touch-h)]"
            onClick={onClose}
            type="button"
          >
            <XIcon aria-hidden="true" className="size-5" />
          </button>
        </div>

        {/* ── Form ── */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-950/50 border border-red-900/50 rounded-lg text-[13px] text-red-400">
              {error}
            </div>
          )}

          {/* Display Style Info */}
          <div className="p-3 bg-[#1a1a1a] rounded-lg border border-[#2a2a2a]">
            <ContentTypeBadge displayStyle={post.subsection.displayStyle} showDescription />
          </div>

          {/* ── Title ── */}
          <div>
            <label className="block text-[13px] font-medium text-[#e5e5e5] mb-2">
              Title *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
              className="w-full px-4 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-white text-[14px] focus:outline-none focus:border-white transition"
            />
          </div>

          {/* ── Cover Image (blog + project only) ── */}
          {!isTitleOnly && (
            <div>
              <label className="block text-[13px] font-medium text-[#e5e5e5] mb-2">
                Cover Image
              </label>

              {/* Preview thumbnail */}
              {formData.coverImage && (
                <div className="relative group mb-2 w-full h-40 rounded-lg overflow-hidden bg-[#1a1a1a]">
                  <img
                    src={formData.coverImage}
                    alt="Cover preview"
                    className="w-full h-full object-cover"
                  />
                  <button
                    aria-label="Remove cover image"
                    className="absolute top-2 right-2 flex size-6 items-center justify-center rounded-full bg-[color:var(--admin-scrim)] text-[color:var(--admin-primary-text)] transition max-[849px]:size-[var(--admin-touch-h)]"
                    onClick={() => setFormData({ ...formData, coverImage: '' })}
                    type="button"
                  >
                    <XIcon aria-hidden="true" className="size-3.5" />
                  </button>
                </div>
              )}

              {coverUploadError && (
                <p className="text-xs text-red-400 mb-2">{coverUploadError}</p>
              )}

              {/* Hidden file input */}
              <input
                ref={coverInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleCoverUpload(file);
                  e.target.value = '';
                }}
              />

              <div className="flex gap-2">
                {/* Upload button — hits /api/admin/upload → Cloudinary */}
                <button
                  type="button"
                  onClick={() => coverInputRef.current?.click()}
                  disabled={coverUploading}
                  className="flex items-center gap-1.5 px-3 py-2 bg-[#1a1a1a] text-white rounded-lg hover:bg-[#2a2a2a] transition text-[13px] whitespace-nowrap disabled:opacity-50"
                >
                  {coverUploading ? (
                    <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                  ) : (
                    <>
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      Upload
                    </>
                  )}
                </button>

                {/* URL fallback */}
                <input
                  type="text"
                  inputMode="url"
                  value={formData.coverImage}
                  onChange={(e) => setFormData({ ...formData, coverImage: e.target.value })}
                  placeholder="Image URL or /projects/cover.png"
                  className="flex-1 px-4 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-white text-[14px] focus:outline-none focus:border-white transition"
                />
              </div>
              <p className="text-[11px] text-[#707070] mt-1.5">
                Uploads go to Cloudinary (max 5MB) · You can also use a public image URL or a site path such as /projects/cover.png
              </p>
            </div>
          )}

          {/* ── Description (blog + project only) ── */}
          {!isTitleOnly && (
            <div>
              <label className="block text-[13px] font-medium text-[#e5e5e5] mb-2">
                Description *
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                required
                placeholder="A short description shown in post listings"
                rows={2}
                className="w-full px-4 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-white text-[14px] focus:outline-none focus:border-white transition resize-none"
              />
            </div>
          )}

          {/* ── Project Link (project only) ── */}
          {isProject && (
            <div>
              <label className="block text-[13px] font-medium text-[#e5e5e5] mb-2">
                Project Link *
              </label>
              <input
                type="url"
                value={formData.projectLink}
                onChange={(e) => setFormData({ ...formData, projectLink: e.target.value })}
                required
                placeholder="https://github.com/you/project"
                className="w-full px-4 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-white text-[14px] focus:outline-none focus:border-white transition"
              />
            </div>
          )}

          {isProject && (
            <div>
              <label htmlFor="edit-post-archive-year" className="block text-[13px] font-medium text-[#e5e5e5] mb-2">Archive year</label>
              <input id="edit-post-archive-year" type="number" min="1900" max="2100" value={formData.archiveYear ?? ''}
                onChange={(e) => setFormData({ ...formData, archiveYear: e.target.value ? Number(e.target.value) : null })}
                placeholder="Uses publish year if empty"
                className="w-full px-4 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-white text-[14px] focus:outline-none focus:border-white transition" />
            </div>
          )}

          {/* ── Markdown Content (blog only) ── */}
          {isBlog && (
            <div>
              <label className="block text-[13px] font-medium text-[#e5e5e5] mb-2">
                Content (Markdown) *
              </label>
              <MarkdownEditor
                value={formData.content}
                onChange={(value) => setFormData({ ...formData, content: value })}
              />
              <p className="text-[11px] text-[#707070] mt-1.5">
                Drag &amp; drop images into the editor or use the Image button in the toolbar — they upload to Cloudinary automatically
              </p>
            </div>
          )}

          {/* ── Excerpt (blog + project only) ── */}
          {!isTitleOnly && (
            <div>
              <label className="block text-[13px] font-medium text-[#e5e5e5] mb-2">
                Excerpt{' '}
                <span className="font-normal text-[#707070]">(optional — auto-generated if empty)</span>
              </label>
              <textarea
                value={formData.excerpt}
                onChange={(e) => setFormData({ ...formData, excerpt: e.target.value })}
                rows={2}
                placeholder="Short summary for SEO and link previews..."
                className="w-full px-4 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-white text-[14px] focus:outline-none focus:border-white transition resize-none"
              />
            </div>
          )}

          {/* ── Tags ── */}
          <div>
            <label className="block text-[13px] font-medium text-[#e5e5e5] mb-2">
              Tags{' '}
              <span className="font-normal text-[#707070]">(comma-separated)</span>
            </label>
            <input
              type="text"
              value={formData.tags}
              onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
              placeholder="PYTHON, REINFORCEMENT-LEARNING, ML"
              className="w-full px-4 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-white text-[14px] focus:outline-none focus:border-white transition"
            />
            <p className="text-[11px] text-[#707070] mt-1">Tags are automatically uppercased</p>
          </div>

          {/* ── Publish Toggle ── */}
          <div>
            <label className="flex items-center gap-3 cursor-pointer">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, published: !formData.published })}
                className={`relative w-10 h-5 rounded-full transition-colors focus:outline-none ${
                  formData.published ? 'bg-white' : 'bg-[#2a2a2a]'
                }`}
              >
                <span
                  className={`absolute top-0.5 w-4 h-4 rounded-full transition-transform ${
                    formData.published ? 'translate-x-5 bg-[#0a0a0a]' : 'translate-x-0.5 bg-[#707070]'
                  }`}
                />
              </button>
              <span className="text-[13px] text-[#e5e5e5]">
                {formData.published ? 'Published' : 'Draft'}
              </span>
            </label>
          </div>

          {/* ── Sticky action bar ── */}
          <div className="flex flex-col sm:flex-row gap-3 sticky bottom-0 bg-[#0a0a0a] pt-4 pb-2 border-t border-[#1a1a1a] -mx-4 sm:-mx-6 px-4 sm:px-6">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-white text-[#0a0a0a] rounded-lg hover:opacity-90 transition text-[13px] font-medium disabled:opacity-50"
            >
              {loading ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Save Changes
                </span>
              ) : (
                'Save Changes'
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-[#1a1a1a] text-white rounded-lg hover:bg-[#2a2a2a] transition text-[13px] font-medium"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
