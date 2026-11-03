'use client';

import { useState, useRef } from 'react';
import { LinkIcon, QuotesIcon } from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';
import { markdownToHtml } from '@/src/lib/markdown';

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function MarkdownEditor({ value, onChange, placeholder }: MarkdownEditorProps) {
  const [activeTab, setActiveTab] = useState<'write' | 'preview'>('write');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Insert text at cursor position
  const insertAtCursor = (before: string, after: string = '', placeholder: string = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end   = textarea.selectionEnd;
    const selected = value.substring(start, end) || placeholder;
    const newValue =
      value.substring(0, start) + before + selected + after + value.substring(end);

    onChange(newValue);

    setTimeout(() => {
      textarea.focus();
      const cursorPos = start + before.length + selected.length + after.length;
      textarea.setSelectionRange(cursorPos, cursorPos);
    }, 0);
  };

  // Upload image to Cloudinary via your existing endpoint
  const handleImageUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setUploadError('Please select an image file');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('Image must be under 5MB');
      return;
    }

    setUploading(true);
    setUploadError('');

    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        const base64 = reader.result as string;

        const response = await fetch('/api/admin/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ image: base64 }),
        });

        if (!response.ok) throw new Error('Upload failed');

        const data = await response.json();
        const imageMarkdown = `![${file.name.replace(/\.[^.]+$/, '')}](${data.url})`;

        // Insert at cursor
        const textarea = textareaRef.current;
        if (textarea) {
          const start = textarea.selectionStart;
          const newValue = value.substring(0, start) + '\n' + imageMarkdown + '\n' + value.substring(start);
          onChange(newValue);
        } else {
          onChange(value + '\n' + imageMarkdown + '\n');
        }

        setUploading(false);
      };
      reader.onerror = () => {
        setUploadError('Failed to read file');
        setUploading(false);
      };
    } catch {
      setUploadError('Upload failed. Try again.');
      setUploading(false);
    }
  };

  // Drag and drop onto textarea
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleImageUpload(file);
  };

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();

  /* Toolbar buttons. Glyph-free entries carry an icon *component* rather than an element:
     building elements here tripped react-hooks/refs, and a component reference is the value
     that belongs in a table like this anyway. */
  const toolbar: { label: string; icon?: Icon; title: string; action: () => void }[] = [
    { label: 'B',   title: 'Bold',          action: () => insertAtCursor('**', '**', 'bold text') },
    { label: 'I',   title: 'Italic',         action: () => insertAtCursor('*', '*', 'italic text') },
    { label: 'H2',  title: 'Heading 2',      action: () => insertAtCursor('## ', '', 'Heading') },
    { label: 'H3',  title: 'Heading 3',      action: () => insertAtCursor('### ', '', 'Heading') },
    { label: '`',   title: 'Inline Code',    action: () => insertAtCursor('`', '`', 'code') },
    { label: '```', title: 'Code Block',     action: () => insertAtCursor('```python\n', '\n```', 'code here') },
    { label: '—',   title: 'Divider',        action: () => insertAtCursor('\n---\n') },
    { label: '', icon: QuotesIcon, title: 'Blockquote', action: () => insertAtCursor('> ', '', 'quote') },
    { label: '•',   title: 'Bullet List',    action: () => insertAtCursor('- ', '', 'list item') },
    { label: '1.',  title: 'Numbered List',  action: () => insertAtCursor('1. ', '', 'list item') },
    { label: '', icon: LinkIcon, title: 'Link', action: () => insertAtCursor('[', '](url)', 'link text') },
  ];

  // Live preview reuses the same renderer as the published page (lib/markdown.ts)
  const renderPreview = (md: string) => markdownToHtml(md);

  return (
    <div className="border border-[#2a2a2a] rounded-lg overflow-hidden bg-[#0a0a0a]">
      {/* Tabs */}
      <div className="flex items-center border-b border-[#2a2a2a] bg-[#0a0a0a]">
        <button
          type="button"
          onClick={() => setActiveTab('write')}
          className={`px-4 py-2 text-sm font-medium transition ${
            activeTab === 'write' ? 'text-white border-b-2 border-white' : 'text-[#707070] hover:text-white'
          }`}
        >
          Write
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('preview')}
          className={`px-4 py-2 text-sm font-medium transition ${
            activeTab === 'preview' ? 'text-white border-b-2 border-white' : 'text-[#707070] hover:text-white'
          }`}
        >
          Preview
        </button>
      </div>

      {/* Toolbar (only in write mode) */}
      {activeTab === 'write' && (
        <div className="flex flex-wrap items-center gap-1 px-3 py-2 border-b border-[#2a2a2a] bg-[#0a0a0a]">
          {toolbar.map(({ action, icon: BtnIcon, label, title }) => (
            <button
              aria-label={title}
              className="flex min-h-[var(--admin-control-h)] min-w-[var(--admin-control-h)] items-center justify-center rounded px-2 py-1 font-mono text-xs text-[#707070] transition hover:bg-[#1a1a1a] hover:text-white"
              key={title}
              onClick={action}
              title={title}
              type="button"
            >
              {BtnIcon ? <BtnIcon aria-hidden="true" className="size-3.5" /> : label}
            </button>
          ))}

          {/* Divider */}
          <div className="w-px h-4 bg-[#2a2a2a] mx-1" />

          {/* Image Upload Button */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImageUpload(file);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            title="Upload Image"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1 px-2 py-1 text-xs text-[#707070] hover:text-white hover:bg-[#1a1a1a] rounded transition disabled:opacity-40"
          >
            {uploading ? (
              <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
            ) : (
              <>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Image
              </>
            )}
          </button>

          <span className="text-[10px] text-[#444] ml-1">or drag & drop image onto editor</span>
        </div>
      )}

      {uploadError && (
        <div className="px-4 py-2 bg-red-950/50 text-red-400 text-xs border-b border-[#2a2a2a]">
          {uploadError}
        </div>
      )}

      {/* Content Area */}
      <div className="min-h-100">
        {activeTab === 'write' ? (
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            placeholder={placeholder || 'Write your content in Markdown...\n\nTip: Drag and drop images directly here, or use the Image button above.'}
            className="w-full h-full min-h-100 px-4 py-3 bg-[#0a0a0a] text-white text-[14px] font-mono leading-relaxed focus:outline-none resize-none"
          />
        ) : (
          <div
            className="px-6 py-4 min-h-100 prose prose-invert max-w-none
              prose-img:rounded-lg prose-img:w-full prose-img:h-auto
              prose-pre:overflow-x-auto prose-code:break-words"
            dangerouslySetInnerHTML={{ __html: renderPreview(value) }}
          />
        )}
      </div>

      {/* Footer */}
      {activeTab === 'write' && (
        <div className="border-t border-[#2a2a2a] bg-[#0a0a0a] px-4 py-2">
          <details className="text-xs text-[#707070]">
            <summary className="cursor-pointer hover:text-white transition select-none">
              Markdown cheatsheet
            </summary>
            <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 font-mono text-[11px] pb-2">
              <span># Heading 1</span>
              <span>## Heading 2</span>
              <span>**bold**</span>
              <span>*italic*</span>
              <span>`inline code`</span>
              <span>```code block```</span>
              <span>[link](url)</span>
              <span>![alt](image-url)</span>
              <span>- bullet list</span>
              <span>1. numbered list</span>
              <span>&gt; blockquote</span>
              <span>--- divider</span>
            </div>
          </details>
        </div>
      )}
    </div>
  );
}