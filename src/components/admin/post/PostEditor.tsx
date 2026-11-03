'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeftIcon, ArrowSquareOutIcon, ImageSquareIcon, UploadSimpleIcon, XIcon } from '@phosphor-icons/react';
import { adminApi, requestFailureMessage } from '@/src/lib/api';
import { contentTypeFor, contentTypeKey } from '@/src/components/admin/contentTypes';
import { ContentTypeBadge } from '@/src/components/admin/contentTypeBadge';
import type { Post, TopCategory } from '@/src/types';
import { publicPostPath } from '@/src/components/admin/dashboard/recentEdits';
import {
  EMPTY_POST_DRAFT,
  buildPostPayload,
  fieldsForStyle,
  isDraftDirty,
  postEditPath,
  postToDraft,
  validatePostDraft,
  POST_FIELD_IDS,
  type PostDraft,
  type PostDraftErrors,
} from '@/src/lib/postEditor';
import { AdminButton, adminButtonClass } from '@/src/components/ui/admin-button';
import { AdminField, AdminInput, AdminSelect, AdminTextarea } from '@/src/components/ui/admin-field';
import { AdminErrorState, AdminLoadingState } from '@/src/components/ui/admin-state';
import { ConfirmDialog } from '@/src/components/ui/confirm-dialog';
import { FormSection } from '@/src/components/ui/form-section';
import { Notice } from '@/src/components/ui/notice';
import { PageHeader } from '@/src/components/ui/page-header';
import { StatusLabel } from '@/src/components/ui/status-label';
import { MarkdownEditor } from './MarkDownEditor';

/* Post editor page (checkpoint 6 of docs/admin-redesign-plan.md): one screen for both halves of
   "create/edit", reached from `/admin/posts` and from the dashboard, at a URL a person can reload
   or hand to someone else.

   It replaces two hand-maintained copies of the same form: `PostEditModal.tsx` (a max-w-4xl modal
   whose writing box was one of nine stacked fields, whose close button discarded edits with no
   warning, and which re-rendered `markdownToHtml` output into a `prose-invert` panel that is
   unreadable in the light theme) and `postForm.tsx` (create, with a different field set and its own
   copy of the upload code). The rules both forms disagreed about now live once, in
   src/lib/postEditor.ts. */

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

interface PostEditorProps {
  mode: 'create' | 'edit';
  /** Only for `edit`: the address carries both slugs because the post endpoints do. */
  subsectionSlug?: string;
  postSlug?: string;
}

export function PostEditor({ mode, subsectionSlug, postSlug }: PostEditorProps) {
  const router = useRouter();
  const isCreate = mode === 'create';

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reloadToken, setReloadToken] = useState(0);
  const [post, setPost] = useState<Post | null>(null);

  const [sections, setSections] = useState<TopCategory[]>([]);
  const [selectedSubsection, setSelectedSubsection] = useState('');

  const [draft, setDraft] = useState<PostDraft>(EMPTY_POST_DRAFT);
  const [saved, setSaved] = useState<PostDraft>(EMPTY_POST_DRAFT);
  const [published, setPublished] = useState(false);

  const [fieldErrors, setFieldErrors] = useState<PostDraftErrors>({});
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const [coverError, setCoverError] = useState('');
  const [leaveTarget, setLeaveTarget] = useState<string | null>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const subsections = useMemo(() => sections.flatMap((section) => section.subsections ?? []), [sections]);

  /* In create mode there is no content type until a subsection is picked, and until then no
     style-specific rule can be applied (asking for markdown while the person has not chosen where
     the post goes would be noise). */
  const style = isCreate
    ? selectedSubsection
      ? contentTypeKey(subsections.find((sub) => sub.slug === selectedSubsection)?.displayStyle)
      : null
    : post
      ? contentTypeKey(post.subsection.displayStyle)
      : null;
  const fields = style ? fieldsForStyle(style) : null;
  const dirty = isDraftDirty(draft, saved);

  /* Editing an existing post: fetch the single post (the list response omits `content` on purpose),
     and keep the loaded copy as the dirty-check baseline. */
  useEffect(() => {
    if (isCreate || !subsectionSlug || !postSlug) return;
    let active = true;
    setLoading(true);
    setLoadError('');
    (async () => {
      try {
        const res = (await adminApi.getPost(subsectionSlug, postSlug)) as { post: Post };
        if (!active) return;
        setPost(res.post);
        const next = postToDraft(res.post);
        setDraft(next);
        setSaved(next);
        setPublished(res.post.published);
      } catch (err) {
        if (!active) return;
        setLoadError(
          requestFailureMessage(
            err,
            'This post could not be loaded, so nothing here is editable yet. Check that the address is right and try again.',
          ),
        );
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [isCreate, postSlug, reloadToken, subsectionSlug]);

  /* Creating: the subsection picker needs the same section -> subsection tree the list screen
     uses for its filter. */
  useEffect(() => {
    if (!isCreate) return;
    let active = true;
    setLoading(true);
    (async () => {
      try {
        const res = (await adminApi.getSections()) as { sections: TopCategory[] };
        if (active) setSections(res.sections);
      } catch (err) {
        if (active) {
          setLoadError(
            `There are no subsections to file this post under yet. ${requestFailureMessage(err, 'The request failed.')}`,
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [isCreate]);

  /* Closing the tab or reloading with unsaved text is the browser's decision to make, but not
     silently: this is the warning the modal did not have. */
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const setField = (key: keyof PostDraft, value: string) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => (current[key] ? { ...current, [key]: undefined } : current));
    setNotice('');
  };

  const readImageAsDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('The file could not be read.'));
      reader.readAsDataURL(file);
    });

  /* Cover image. The success path needs Cloudinary credentials, which this environment does not
     have; the failure path is the one that must behave, and it keeps whatever was typed into the
     URL box and the rest of the form. */
  const handleCoverUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setCoverError('');
    if (!file.type.startsWith('image/')) {
      setCoverError('That is not an image. Choose a JPG, PNG or GIF.');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setCoverError(`${file.name} is larger than 5 MB. Pick a smaller file.`);
      return;
    }

    setCoverUploading(true);
    try {
      const image = await readImageAsDataUrl(file);
      const uploaded = (await adminApi.uploadImage(image)) as { url: string };
      setField('coverImage', uploaded.url);
      setNotice('Cover uploaded. Save the post to keep it.');
    } catch (err) {
      setCoverError(
        `${err instanceof Error ? err.message : 'The upload failed.'} The cover image is unchanged and nothing else on this page was lost.`,
      );
    } finally {
      setCoverUploading(false);
    }
  };

  const goTo = (href: string) => {
    if (dirty) {
      setLeaveTarget(href);
      return;
    }
    router.push(href);
  };

  const handleSubmit = async (event: React.FormEvent, publishOnCreate = false) => {
    event.preventDefault();
    setFormError('');
    setNotice('');
    setFieldErrors({});

    if (isCreate && !selectedSubsection) {
      setFieldErrors({ subsection: 'Choose which subsection this post belongs to.' });
      return;
    }
    if (!style) return;

    const errors = validatePostDraft(draft, style);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      const first = Object.keys(errors)[0] as keyof PostDraftErrors;
      document.getElementById(POST_FIELD_IDS[first])?.focus();
      setFormError('The post was not saved. Fix the highlighted field and try again.');
      return;
    }

    const payload = buildPostPayload(draft);
    setSaving(true);
    try {
      if (isCreate) {
        const created = (await adminApi.createPost(selectedSubsection, {
          ...payload,
          published: publishOnCreate,
        })) as { post: Post };
        const href = postEditPath(created.post.subsection.slug, created.post.slug);
        /* The draft is no longer at risk, so the unsaved-changes guard must not fire on the way to
           the address the new post actually lives at. */
        setSaved(draft);
        router.push(href);
        return;
      }
      if (!post) return;
      const res = (await adminApi.updatePost(post.subsection.slug, post.slug, {
        ...payload,
        published,
      })) as { post: Post };
      setPost(res.post);
      setSaved(draft);
      setPublished(res.post.published);

      /* Renaming a post renames its address: the PUT route regenerates the slug from the title, so
         the editor has to move with it or a reload lands on "post not found". That navigation
         remounts this page and refetches, which would throw a save notice away mid-flight, so the
         notice is for the ordinary case only - the reloaded editor answers "what state am I in?"
         with its own saved line and the new title in the heading. */
      if (res.post.slug !== post.slug || res.post.subsection.slug !== post.subsection.slug) {
        router.replace(postEditPath(res.post.subsection.slug, res.post.slug));
      } else {
        setNotice('Your changes are saved.');
      }
    } catch (err) {
      setFormError(
        `${requestFailureMessage(err, 'The server did not accept the post.')} Nothing was saved and everything you typed is still here.`,
      );
    } finally {
      setSaving(false);
    }
  };

  /* Publish/unpublish is its own explicit action rather than a checkbox that only takes effect on
     save: it is a PATCH on the post, so a person can publish without touching the text. */
  const handleTogglePublish = async () => {
    if (!post) return;
    setFormError('');
    setNotice('');
    setPublishing(true);
    try {
      await adminApi.togglePublish(post.subsection.slug, post.slug, !published);
      setPublished(!published);
      setNotice(
        published
          ? `“${post.title}” is no longer on the public site. It is still a draft you can keep editing.`
          : `“${post.title}” is live on the public site.`,
      );
    } catch (err) {
      setFormError(
        `${requestFailureMessage(err, 'The publish state could not be changed.')} The post is ${
          published ? 'still live' : 'still a draft'
        }.`,
      );
    } finally {
      setPublishing(false);
    }
  };

  const hierarchy = post
    ? [post.subsection.topCategory?.name, post.subsection.name].filter(Boolean).join(' / ')
    : '';

  const heading = isCreate ? 'New post' : post ? `Edit “${post.title}”` : 'Edit post';

  const backLink = (
    <AdminButton
      onClick={() => goTo('/admin/posts')}
      variant="ghost"
    >
      <ArrowLeftIcon aria-hidden="true" className="size-4" />
      Back to posts
    </AdminButton>
  );

  const body = () => {
    if (loading) return <AdminLoadingState label={isCreate ? "Loading subsections" : "Loading post"} />;
    if (loadError && !isCreate) {
      return (
        <AdminErrorState
          message={loadError}
          onRetry={() => setReloadToken((token) => token + 1)}
          retryLabel="Try again"
          title="This post could not be opened"
        />
      );
    }
    if (!isCreate && !post) return null;

    return (
      <form onSubmit={(event) => void handleSubmit(event)} data-slot="post-editor">
        <div className="flex flex-col gap-[var(--admin-space-5)] pb-32">
          <FormSection
            description={
              isCreate
                ? 'Where the post appears on the public site decides which fields it needs.'
                : hierarchy
            }
            title="Placement"
          >
            {isCreate ? (
              <AdminField
                error={fieldErrors.subsection}
                hint="Content type is set by the subsection, and it decides the rest of this form."
                id={POST_FIELD_IDS.subsection}
                label="Subsection"
                required
              >
                <AdminSelect
                  onChange={(event) => {
                    setSelectedSubsection(event.target.value);
                    setFieldErrors((current) => ({ ...current, subsection: undefined }));
                  }}
                  value={selectedSubsection}
                >
                  <option value="">Select a subsection</option>
                  {sections.map((section) => (
                    <optgroup key={section.id} label={section.name}>
                      {(section.subsections ?? []).map((sub) => (
                        /* An <option> can only hold text, so the content type is named in words.
                           `sub.icon` is stored subsection data, not chrome. */
                        <option key={sub.id} value={sub.slug}>
                          {sub.icon} {sub.name} ({contentTypeFor(sub.displayStyle).label})
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </AdminSelect>
              </AdminField>
            ) : (
              <div className="flex flex-wrap items-center gap-[var(--admin-space-3)] text-[length:var(--admin-text-meta)] text-[color:var(--admin-muted)]">
                <span>{hierarchy}</span>
                {post && <ContentTypeBadge displayStyle={post.subsection.displayStyle} />}
                <StatusLabel tone={published ? 'live' : 'draft'}>{published ? 'Live' : 'Draft'}</StatusLabel>
                {post?.publishedAt && <span>Published {new Date(post.publishedAt).toLocaleDateString()}</span>}
                {post && (
                  <span>
                    {post.views} {post.views === 1 ? 'view' : 'views'}
                  </span>
                )}
              </div>
            )}
            {style && (
              <p className="mt-[var(--admin-space-3)] text-[length:var(--admin-text-micro)] text-[color:var(--admin-subtle)]">
                {contentTypeFor(style).description} on the public site.
              </p>
            )}
          </FormSection>

          <FormSection
            description="The title is what readers scan; the description is what the list under it says."
            title="Content"
          >
            <div className="flex flex-col gap-[var(--admin-space-4)]">
              <AdminField error={fieldErrors.title} id={POST_FIELD_IDS.title} label="Title" required>
                <AdminInput
                  onChange={(event) => setField('title', event.target.value)}
                  placeholder="Your post title"
                  value={draft.title}
                />
              </AdminField>

              {fields?.description && (
                <AdminField
                  error={fieldErrors.description}
                  hint="Shown in listings and archive rows."
                  id={POST_FIELD_IDS.description}
                  label="Description"
                  required
                >
                  <AdminTextarea
                    onChange={(event) => setField('description', event.target.value)}
                    placeholder="A short description shown in post listings"
                    rows={2}
                    value={draft.description}
                  />
                </AdminField>
              )}

              {fields?.excerpt && (
                <AdminField
                  error={fieldErrors.excerpt}
                  hint="Optional. Left empty, the first lines of the post are used."
                  id={POST_FIELD_IDS.excerpt}
                  label="Excerpt"
                >
                  <AdminTextarea
                    onChange={(event) => setField('excerpt', event.target.value)}
                    placeholder="Short summary for search results and link previews"
                    rows={2}
                    value={draft.excerpt}
                  />
                </AdminField>
              )}
            </div>
          </FormSection>

          {fields?.content && (
            <FormSection
              description="Markdown, at the width you will actually read it in. Preview renders the same markup the published page uses."
              title="Writing"
            >
              <AdminField error={fieldErrors.content} id={POST_FIELD_IDS.content} label="Content">
                <MarkdownEditor
                  onChange={(value) => setField('content', value)}
                  placeholder={'Write your post in Markdown...\n\nDrag an image onto the page or use the Image button to add one.'}
                  value={draft.content}
                />
              </AdminField>
            </FormSection>
          )}

          {fields?.projectLink && (
            <FormSection
              description="Only project posts get these; the public card links straight to the address below."
              title="Project details"
            >
              <div className="flex flex-col gap-[var(--admin-space-4)]">
                <AdminField
                  error={fieldErrors.projectLink}
                  hint="The public card opens this in a new tab."
                  id={POST_FIELD_IDS.projectLink}
                  label="Project link"
                  required
                >
                  <AdminInput
                    inputMode="url"
                    onChange={(event) => setField('projectLink', event.target.value)}
                    placeholder="https://github.com/you/project"
                    value={draft.projectLink}
                  />
                </AdminField>
                <AdminField
                  error={fieldErrors.archiveYear}
                  hint="Leave empty to group the project by the year it was published."
                  id={POST_FIELD_IDS.archiveYear}
                  label="Archive year"
                >
                  <AdminInput
                    inputMode="numeric"
                    onChange={(event) => setField('archiveYear', event.target.value)}
                    placeholder="2024"
                    value={draft.archiveYear}
                  />
                </AdminField>
              </div>
            </FormSection>
          )}

          {fields?.coverImage && (
            <FormSection
              description="Uploads go to Cloudinary (max 5 MB); a public URL or a site path such as /projects/cover.png works too."
              title="Cover image"
            >
              <div className="flex flex-col gap-[var(--admin-space-3)]">
                {draft.coverImage && (
                  <div className="relative h-40 w-full overflow-hidden rounded-[var(--admin-radius-panel)] border border-[color:var(--admin-border)] bg-[color:var(--admin-surface-2)]">
                    {/* The stored value may be a site path that does not resolve here, so the box
                        keeps its size instead of collapsing when the picture is missing. */}
                    <ImageSquareIcon
                      aria-hidden="true"
                      className="absolute inset-0 m-auto size-6 text-[color:var(--admin-subtle)]"
                    />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      alt={`Cover of ${draft.title || 'this post'}`}
                      className="relative size-full object-cover"
                      onError={(event) => {
                        event.currentTarget.style.visibility = 'hidden';
                      }}
                      src={draft.coverImage}
                    />
                    <button
                      aria-label="Remove cover image"
                      className={adminButtonClass({ className: 'absolute right-2 top-2', size: 'icon-sm', variant: 'secondary' })}
                      onClick={() => setField('coverImage', '')}
                      type="button"
                    >
                      <XIcon aria-hidden="true" className="size-4" />
                    </button>
                  </div>
                )}

                {coverError && (
                  <Notice assertive onDismiss={() => setCoverError('')} tone="error">
                    {coverError}
                  </Notice>
                )}

                <input
                  accept="image/*"
                  aria-label="Upload a cover image file"
                  className="hidden"
                  onChange={(event) => void handleCoverUpload(event)}
                  ref={coverInputRef}
                  type="file"
                />

                <div className="flex flex-wrap items-end gap-[var(--admin-space-3)]">
                  <AdminField
                    className="min-w-[240px] flex-1"
                    error={fieldErrors.coverImage}
                    hint="Paste a URL or a site path, or upload a file."
                    id={POST_FIELD_IDS.coverImage}
                    label="Image URL or site path"
                  >
                    <AdminInput
                      inputMode="url"
                      onChange={(event) => setField('coverImage', event.target.value)}
                      placeholder="/projects/cover.png"
                      value={draft.coverImage}
                    />
                  </AdminField>
                  <AdminButton
                    loading={coverUploading}
                    onClick={() => coverInputRef.current?.click()}
                    variant="secondary"
                  >
                    <UploadSimpleIcon aria-hidden="true" className="size-4" />
                    {coverUploading ? 'Uploading' : 'Upload'}
                  </AdminButton>
                </div>
              </div>
            </FormSection>
          )}

          <FormSection description="Comma separated. New tags are created when the post is saved." title="Tags">
            <AdminField
              error={fieldErrors.tags}
              hint="Tags are stored upper-case."
              id={POST_FIELD_IDS.tags}
              label="Tags"
            >
              <AdminInput
                onChange={(event) => setField('tags', event.target.value)}
                placeholder="python, reinforcement-learning, ml"
                value={draft.tags}
              />
            </AdminField>
          </FormSection>

          {/* Persistent save/publish area: fixed to the bottom of the viewport (not `sticky`,
              because `body { overflow: hidden auto }` in src/app/globals.css:14 makes the body the
              scroll container and a sticky bar then never leaves its natural position below the
              fold), clear of the 240px sidebar and below the scrim/drawer/dialog stacking levels,
              so an open mobile navigation drawer really does cover it. */}
          <div
            className="fixed inset-x-0 bottom-0 z-20 border-t border-[color:var(--admin-border)] bg-[color:var(--admin-surface)] px-[var(--admin-gutter)] py-[var(--admin-space-3)] shadow-[var(--admin-shadow-bar)] min-[850px]:left-[var(--admin-sidebar-w)]"
            data-slot="editor-save-bar"
          >
            <div className="mx-auto flex w-full max-w-[var(--admin-editor-max)] flex-wrap items-center gap-[var(--admin-space-3)]">
            {isCreate ? (
              <>
                <AdminButton loading={saving} onClick={(event) => void handleSubmit(event, false)} variant="primary">
                  Save as draft
                </AdminButton>
                <AdminButton loading={saving} onClick={(event) => void handleSubmit(event, true)} variant="secondary">
                  Save and publish
                </AdminButton>
              </>
            ) : (
              <>
                <AdminButton disabled={!dirty} loading={saving} type="submit" variant="primary">
                  Save changes
                </AdminButton>
                <AdminButton loading={publishing} onClick={() => void handleTogglePublish()} variant={published ? 'secondary' : 'primary'}>
                  {published ? 'Unpublish' : 'Publish'}
                </AdminButton>
              </>
            )}
            <p
              aria-live="polite"
              className="text-[length:var(--admin-text-micro)] text-[color:var(--admin-subtle)]"
              data-slot="editor-save-state"
            >
              {dirty
                ? 'You have unsaved changes.'
                : isCreate
                  ? 'Nothing has been saved yet.'
                  : 'Everything on this page is saved.'}
            </p>
            </div>
          </div>
        </div>
      </form>
    );
  };

  return (
    <div className="mx-auto w-full max-w-[var(--admin-editor-max)]">
      <PageHeader
        actions={
          <>
            {backLink}
            {post && published && (
              <Link
                className={adminButtonClass({ size: 'sm', variant: 'ghost' })}
                href={publicPostPath(post.subsection.slug, post.slug)}
                rel="noopener noreferrer"
                target="_blank"
              >
                <ArrowSquareOutIcon aria-hidden="true" className="size-4" />
                View on site
              </Link>
            )}
          </>
        }
        description={
          isCreate
            ? 'Write it once, publish it when it is ready. Nothing here is visible to readers until you publish.'
            : 'Edits are saved when you press Save changes; publishing is a separate decision.'
        }
        title={heading}
      />

      {formError && (
        <Notice assertive className="mb-[var(--admin-space-4)]" onDismiss={() => setFormError('')} tone="error">
          {formError}
        </Notice>
      )}
      {notice && (
        <Notice className="mb-[var(--admin-space-4)]" onDismiss={() => setNotice('')} tone="success">
          {notice}
        </Notice>
      )}
      {isCreate && loadError && (
        <Notice assertive className="mb-[var(--admin-space-4)]" onDismiss={() => setLoadError('')} tone="error">
          {loadError}
        </Notice>
      )}

      {body()}

      {/* Navigating away inside the app is the part the browser guard cannot cover, so the editor
          asks here too and the dialog traps focus like every other confirmation. */}
      {leaveTarget && (
        <ConfirmDialog
          cancelLabel="Keep editing"
          confirmLabel="Discard and leave"
          description="Anything you have typed in this editor since the last save will be lost."
          itemName={draft.title || 'This unsaved post'}
          onCancel={() => setLeaveTarget(null)}
          onConfirm={() => {
            const href = leaveTarget;
            setLeaveTarget(null);
            setDraft(saved);
            router.push(href);
          }}
          title="Leave without saving?"
        />
      )}
    </div>
  );
}
