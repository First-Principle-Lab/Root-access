'use client';

import { useRef, useState } from 'react';
import { XIcon } from '@phosphor-icons/react';
import { ContentTypeBadge } from '@/src/components/admin/contentTypeBadge';
import { contentTypeFor } from '@/src/components/admin/contentTypes';
import { MarkdownEditor } from '../post/MarkDownEditor';

interface PostFormData {
  title: string;
  description: string;
  content: string;
  excerpt: string;
  coverImage: string;
  published: boolean;
  tags: string;
  projectLink: string;
  archiveYear: number | null;
}

type DisplayStyleInput = 'blog' | 'project' | 'title_only';

interface PostFormProps {
  formData: PostFormData;
  onChange: (data: PostFormData) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  subsections: Array<{
    id: string;
    slug: string;
    name: string;
    icon: string;
    displayStyle: string;
  }>;
  selectedSubsection: string;
  onSubsectionChange: (slug: string) => void;
  error?: string;
  displayStyle: DisplayStyleInput;
}

export function PostForm({
  formData,
  onChange,
  onSubmit,
  onCancel,
  subsections,
  selectedSubsection,
  onSubsectionChange,
  error,
  displayStyle,
}: PostFormProps) {
  const [coverUploading, setCoverUploading] = useState(false);
  const [coverUploadError, setCoverUploadError] = useState('');
  const coverInputRef = useRef<HTMLInputElement>(null);

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
        onChange({ ...formData, coverImage: data.url });
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

  return (
    <form onSubmit={onSubmit} className="bg-[#101010] p-6 rounded-xl border border-[#1a1a1a] mb-6">
      {error && (
        <div className="mb-4 p-3 bg-red-950/50 border border-red-900/50 rounded-lg text-[13px] text-red-400">
          {error}
        </div>
      )}

      {/* ── Subsection ── */}
      <div className="mb-4">
        <label className="block text-[13px] font-medium text-[#e5e5e5] mb-2">
          Subsection *
        </label>
        <select
          value={selectedSubsection}
          onChange={(e) => onSubsectionChange(e.target.value)}
          required
          className="w-full px-4 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-white text-[14px] focus:outline-none focus:border-white transition"
        >
          <option value="">Select a subsection</option>
          {subsections.map((sub) => (
            /* An <option> can only hold text, so the content type is named in words here.
               `sub.icon` is stored subsection data edited by the EmojiPicker, not chrome. */
            <option key={sub.id} value={sub.slug}>
              {sub.icon} {sub.name} ({contentTypeFor(sub.displayStyle).label})
            </option>
          ))}
        </select>
      </div>

      {/* ── Display Style Badge ── */}
      {selectedSubsection && (
        <div className="mb-4 p-3 bg-[#1a1a1a] rounded-lg border border-[#2a2a2a]">
          <ContentTypeBadge displayStyle={displayStyle} showDescription />
        </div>
      )}

      {/* ── Title ── */}
      <div className="mb-4">
        <label className="block text-[13px] font-medium text-[#e5e5e5] mb-2">
          Title *
        </label>
        <input
          type="text"
          value={formData.title}
          onChange={(e) => onChange({ ...formData, title: e.target.value })}
          required
          placeholder="Your Post Title"
          className="w-full px-4 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-white text-[14px] focus:outline-none focus:border-white transition"
        />
      </div>

      {/* ── Cover Image (blog + project only) ── */}
      {(displayStyle === 'blog' || displayStyle === 'project') && (
        <div className="mb-4">
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
                className="absolute top-2 right-2 flex size-6 items-center justify-center rounded-full bg-[color:var(--admin-scrim)] text-[color:var(--admin-primary-text)] opacity-100 transition group-hover:opacity-100 max-[849px]:size-[var(--admin-touch-h)]"
                onClick={() => onChange({ ...formData, coverImage: '' })}
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
              onChange={(e) => onChange({ ...formData, coverImage: e.target.value })}
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
      {displayStyle !== 'title_only' && (
        <div className="mb-4">
          <label className="block text-[13px] font-medium text-[#e5e5e5] mb-2">
            Description *
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => onChange({ ...formData, description: e.target.value })}
            required
            placeholder="A short description shown in post listings"
            rows={2}
            className="w-full px-4 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-white text-[14px] focus:outline-none focus:border-white transition resize-none"
          />
        </div>
      )}

      {/* ── Project Link (project only) ── */}
      {displayStyle === 'project' && (
        <div className="mb-4">
          <label className="block text-[13px] font-medium text-[#e5e5e5] mb-2">
            Project Link *
          </label>
          <input
            type="url"
            value={formData.projectLink}
            onChange={(e) => onChange({ ...formData, projectLink: e.target.value })}
            required
            placeholder="https://github.com/you/project"
            className="w-full px-4 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-white text-[14px] focus:outline-none focus:border-white transition"
          />
        </div>
      )}

      {displayStyle === 'project' && (
        <div className="mb-4">
          <label htmlFor="new-post-archive-year" className="block text-[13px] font-medium text-[#e5e5e5] mb-2">Archive year</label>
          <input id="new-post-archive-year" type="number" min="1900" max="2100" value={formData.archiveYear ?? ''}
            onChange={(e) => onChange({ ...formData, archiveYear: e.target.value ? Number(e.target.value) : null })}
            placeholder="Uses publish year if empty"
            className="w-full px-4 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-white text-[14px] focus:outline-none focus:border-white transition" />
        </div>
      )}

      {/* ── Markdown Content (blog only) ── */}
      {displayStyle === 'blog' && (
        <div className="mb-4">
          <label className="block text-[13px] font-medium text-[#e5e5e5] mb-2">
            Content (Markdown) *
          </label>
          <MarkdownEditor
            value={formData.content}
            onChange={(value) => onChange({ ...formData, content: value })}
          />
          <p className="text-[11px] text-[#707070] mt-1.5">
            Drag &amp; drop images into the editor or use the Image button in the toolbar — they upload to Cloudinary automatically
          </p>
        </div>
      )}

      {/* ── Excerpt (blog + project only) ── */}
      {displayStyle !== 'title_only' && (
        <div className="mb-4">
          <label className="block text-[13px] font-medium text-[#e5e5e5] mb-2">
            Excerpt{' '}
            <span className="font-normal text-[#707070]">(optional — auto-generated if empty)</span>
          </label>
          <textarea
            value={formData.excerpt}
            onChange={(e) => onChange({ ...formData, excerpt: e.target.value })}
            rows={2}
            placeholder="Short summary for SEO and link previews..."
            className="w-full px-4 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-white text-[14px] focus:outline-none focus:border-white transition resize-none"
          />
        </div>
      )}

      {/* ── Tags ── */}
      <div className="mb-4">
        <label className="block text-[13px] font-medium text-[#e5e5e5] mb-2">
          Tags{' '}
          <span className="font-normal text-[#707070]">(comma-separated)</span>
        </label>
        <input
          type="text"
          value={formData.tags}
          onChange={(e) => onChange({ ...formData, tags: e.target.value })}
          placeholder="PYTHON, REINFORCEMENT-LEARNING, ML"
          className="w-full px-4 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-white text-[14px] focus:outline-none focus:border-white transition"
        />
        <p className="text-[11px] text-[#707070] mt-1">Tags are automatically uppercased</p>
      </div>

      {/* ── Publish Toggle ── */}
      <div className="mb-6">
        <label className="flex items-center gap-3 cursor-pointer">
          <button
            type="button"
            onClick={() => onChange({ ...formData, published: !formData.published })}
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
            {formData.published ? 'Publish immediately' : 'Save as draft'}
          </span>
        </label>
      </div>

      {/* ── Actions ── */}
      <div className="flex gap-3">
        <button
          type="submit"
          className="px-4 py-2 bg-white text-[#0a0a0a] rounded-lg hover:opacity-90 transition text-[13px] font-medium"
        >
          Create Post
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 bg-[#1a1a1a] text-white rounded-lg hover:bg-[#2a2a2a] transition text-[13px] font-medium"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
