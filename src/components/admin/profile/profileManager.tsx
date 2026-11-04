'use client';

import { useEffect, useRef, useState } from 'react';
import { ImageSquareIcon, TrashIcon, UploadSimpleIcon } from '@phosphor-icons/react';
import { adminApi, requestFailureMessage } from '@/src/lib/api';
import type { Profile } from '@/src/types';
import { AdminButton } from '@/src/components/ui/admin-button';
import { AdminField, AdminInput, AdminTextarea } from '@/src/components/ui/admin-field';
import { AdminErrorState, AdminLoadingState } from '@/src/components/ui/admin-state';
import { FormSection } from '@/src/components/ui/form-section';
import { Notice } from '@/src/components/ui/notice';
import { PageHeader } from '@/src/components/ui/page-header';
import {
  EMPTY_PROFILE_FORM,
  buildProfilePayload,
  isProfileDirty,
  profileFormFromProfile,
  validateProfileForm,
  type ProfileFieldKey,
  type ProfileFormValues,
} from './profileForm';

/* Profile screen (checkpoint 5 of docs/admin-redesign-plan.md, "Profile controls").
   The baseline was one long flat form: no grouping, no per-field validation (a half-typed URL came
   back from the API as an opaque "Invalid data"), no save state, and an image upload whose failure
   was swallowed by the promise it was thrown in - the button went back to "Change Picture" and
   nothing said the upload failed. Fields are grouped now (image, bio, contact, social, resume),
   each with its own error, and the save area stays reachable at the bottom of the form.
   GitHub sits in the same group (checkpoint 7); the only field whose public icon survives an empty
   value, because the icon predates the column - see DEFAULT_GITHUB_URL in src/lib/githubLink.ts. */

const SOCIAL_FIELDS: { hint: string; id: ProfileFieldKey; label: string; placeholder: string }[] = [
  {
    hint: 'Leave empty to keep the default address the public icon already points at.',
    id: 'githubLink',
    label: 'GitHub',
    placeholder: 'https://github.com/username',
  },
  {
    hint: 'Leave empty to hide the icon on the public site.',
    id: 'xLink',
    label: 'X (Twitter)',
    placeholder: 'https://x.com/username',
  },
  {
    hint: 'Leave empty to hide the icon on the public site.',
    id: 'linkedinLink',
    label: 'LinkedIn',
    placeholder: 'https://linkedin.com/in/username',
  },
  {
    hint: 'Leave empty to hide the icon on the public site.',
    id: 'instagramLink',
    label: 'Instagram',
    placeholder: 'https://instagram.com/username',
  },
];

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export function ProfileManager() {
  const [values, setValues] = useState<ProfileFormValues>(EMPTY_PROFILE_FORM);
  const [saved, setSaved] = useState<ProfileFormValues>(EMPTY_PROFILE_FORM);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<ProfileFieldKey, string>>>({});
  const [formError, setFormError] = useState('');
  const [savedNotice, setSavedNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchProfile = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = (await adminApi.getProfile()) as { profile: Profile };
      const next = profileFormFromProfile(res.profile);
      setValues(next);
      setSaved(next);
    } catch (err) {
      setLoadError(
        requestFailureMessage(err, 'Your profile could not be reached. Check your connection and try again.'),
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchProfile();
  }, []);

  const setField = (key: ProfileFieldKey, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => (current[key] ? { ...current, [key]: undefined } : current));
    setSavedNotice('');
  };

  const readImageAsDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('The file could not be read.'));
      reader.readAsDataURL(file);
    });

  /* The upload failure path is the one this environment can actually exercise: there are no
     Cloudinary credentials here, so /api/admin/upload answers 500 and the message has to land in
     the UI with the rest of the form intact. */
  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setUploadError('');
    if (!file.type.startsWith('image/')) {
      setUploadError('That is not an image. Choose a JPG, PNG or GIF.');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setUploadError(`${file.name} is larger than 5 MB. Pick a smaller file.`);
      return;
    }

    setUploading(true);
    try {
      const image = await readImageAsDataUrl(file);
      const uploaded = (await adminApi.uploadImage(image)) as { url: string };
      setField('profilePicture', uploaded.url);
      setSavedNotice('Picture uploaded. Save the profile to keep it.');
    } catch (err) {
      setUploadError(
        `${err instanceof Error ? err.message : 'The upload failed'} Your other answers are still here, and the profile picture is unchanged.`,
      );
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError('');
    setSavedNotice('');

    const errors = validateProfileForm(values);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setFormError('Some fields need fixing before this can be saved.');
      return;
    }

    setSaving(true);
    try {
      const response = (await adminApi.updateProfile(buildProfilePayload(values))) as {
        profile: Profile;
      };
      const next = profileFormFromProfile(response.profile);
      setValues(next);
      setSaved(next);
      setSavedNotice('Profile saved.');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Your profile could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <AdminLoadingState label="Loading profile" />;
  }

  if (loadError) {
    return (
      <>
        <PageHeader
          description="The picture, bio and links the public site reads from here."
          title="Profile"
        />
        <AdminErrorState message={loadError} onRetry={fetchProfile} title="Profile could not be loaded" />
      </>
    );
  }

  const dirty = isProfileDirty(values, saved);

  return (
    <>
      <PageHeader
        description="The picture, bio and links the public site reads from here. Every field is optional except the ones the public sidebar already shows."
        title="Profile"
      />

      <form
        className="flex flex-col gap-[var(--admin-space-5)]"
        /* The browser's own `type="url"` constraint bubble would answer before this form does, so a
           half-typed link would produce a native tooltip on one field and an inline message on the
           others. Every admin form reports through AdminField instead. */
        noValidate
        onSubmit={handleSubmit}
      >
        {(formError || savedNotice) && (
          <div className="flex flex-col gap-[var(--admin-space-2)]">
            {formError && (
              <Notice assertive onDismiss={() => setFormError('')} tone="error">
                {formError}
              </Notice>
            )}
            {savedNotice && !formError && (
              <Notice onDismiss={() => setSavedNotice('')} tone="success">
                {savedNotice}
              </Notice>
            )}
          </div>
        )}

        <FormSection
          description="Shown next to the bio on the public site."
          title="Picture"
        >
          <div className="flex flex-wrap items-center gap-[var(--admin-space-4)]">
            <span className="flex size-[80px] shrink-0 items-center justify-center overflow-hidden rounded-full border border-[color:var(--admin-border-strong)] bg-[color:var(--admin-surface-2)]">
              {values.profilePicture ? (
                // eslint-disable-next-line @next/next/no-img-element -- the stored value is an absolute Cloudinary URL of any size, and next/image would need a remote-pattern entry the deployment does not have yet.
                <img alt="Your current profile picture" className="size-full object-cover" src={values.profilePicture} />
              ) : (
                <ImageSquareIcon aria-hidden="true" className="size-7 text-[color:var(--admin-subtle)]" />
              )}
            </span>

            <div className="flex min-w-0 flex-col gap-[var(--admin-space-2)]">
              <div className="flex flex-wrap items-center gap-[var(--admin-space-2)]">
                <AdminButton
                  loading={uploading}
                  onClick={() => fileInputRef.current?.click()}
                  variant="secondary"
                >
                  <UploadSimpleIcon aria-hidden="true" className="size-4" />
                  {uploading ? 'Uploading' : 'Change picture'}
                </AdminButton>
                {values.profilePicture && (
                  <AdminButton
                    onClick={() => {
                      setField('profilePicture', '');
                      setUploadError('');
                    }}
                    variant="ghost"
                  >
                    <TrashIcon aria-hidden="true" className="size-4" />
                    Remove
                  </AdminButton>
                )}
                <input
                  accept="image/*"
                  aria-label="Choose a profile picture file"
                  className="hidden"
                  onChange={handleImageUpload}
                  ref={fileInputRef}
                  type="file"
                />
              </div>
              <p className="text-[length:var(--admin-text-micro)] text-[color:var(--admin-subtle)]">
                JPG, PNG or GIF, up to 5 MB. The upload only stages the picture - it is applied when
                you save.
              </p>
              {uploadError && (
                <Notice assertive onDismiss={() => setUploadError('')} tone="error">
                  {uploadError}
                </Notice>
              )}
            </div>
          </div>
        </FormSection>

        <FormSection description="One or two sentences, shown in the public sidebar." title="Bio">
          <AdminField
            aside={
              <span className="text-[length:var(--admin-text-micro)] text-[color:var(--admin-subtle)] tabular-nums">
                {values.bio.length} characters
              </span>
            }
            error={fieldErrors.bio}
            id="profile-bio"
            label="Bio"
          >
            <AdminTextarea
              /* The editor minimum (320px) is for a post body; a bio is one or two sentences, and
                 a form section that tall pushes the rest of the page off screen for no reason. */
              className="min-h-[120px]"
              onChange={(e) => setField('bio', e.target.value)}
              placeholder="Write a brief bio about yourself..."
              value={values.bio}
            />
          </AdminField>
        </FormSection>

        <FormSection description="Where readers can reach you." title="Contact">
          <AdminField
            error={fieldErrors.email}
            hint="Leave empty to hide the mail link."
            id="profile-email"
            label="Email"
          >
            <AdminInput
              onChange={(e) => setField('email', e.target.value)}
              placeholder="you@example.com"
              type="email"
              value={values.email}
            />
          </AdminField>
        </FormSection>

        <FormSection
          description="The icons in the public sidebar and footer point at these addresses."
          title="Social links"
        >
          <div className="grid gap-[var(--admin-space-4)] min-[600px]:grid-cols-2">
            {SOCIAL_FIELDS.map((field) => (
              <AdminField
                error={fieldErrors[field.id]}
                hint={field.hint}
                id={`profile-${field.id}`}
                key={field.id}
                label={field.label}
              >
                <AdminInput
                  onChange={(e) => setField(field.id, e.target.value)}
                  placeholder={field.placeholder}
                  type="url"
                  value={values[field.id]}
                />
              </AdminField>
            ))}
          </div>
        </FormSection>

        <FormSection description="A public PDF link, offered as a resume button." title="Resume">
          <AdminField
            error={fieldErrors.resumeUrl}
            hint="Host it anywhere public (Google Drive, Dropbox, your own site) and paste the link."
            id="profile-resumeUrl"
            label="Resume link"
          >
            <AdminInput
              onChange={(e) => setField('resumeUrl', e.target.value)}
              placeholder="https://example.com/resume.pdf"
              type="url"
              value={values.resumeUrl}
            />
          </AdminField>
        </FormSection>

        <div className="sticky bottom-0 -mx-[var(--admin-gutter)] flex flex-wrap items-center gap-[var(--admin-space-3)] border-t border-[color:var(--admin-border)] bg-[color:var(--admin-surface)] px-[var(--admin-gutter)] py-[var(--admin-space-3)] shadow-[var(--admin-shadow-bar)]">
          <AdminButton loading={saving} type="submit" variant="primary">
            Save profile
          </AdminButton>
          <AdminButton
            disabled={!dirty}
            onClick={() => {
              setValues(saved);
              setFieldErrors({});
              setFormError('');
              setSavedNotice('');
            }}
            variant="ghost"
          >
            Discard changes
          </AdminButton>
          <p
            aria-live="polite"
            className="text-[length:var(--admin-text-micro)] text-[color:var(--admin-subtle)]"
          >
            {dirty ? 'Unsaved changes' : 'Everything on this page is saved.'}
          </p>
        </div>
      </form>
    </>
  );
}
