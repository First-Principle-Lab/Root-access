import { profileEmailSchema, profileUrlSchema } from '@/src/schema/profileSchema';
import type { Profile } from '@/src/types';

/* Profile form logic (checkpoint 5 of docs/admin-redesign-plan.md, "Profile controls").
   The rules the baseline got wrong are encoded here.
   1. It posted every field verbatim, so a half-typed `x.com/me` reached `z.string().url()` in
      src/schema/profileSchema.ts and the whole save came back as one opaque "Invalid data" 400.
      The URL and e-mail shape is checked here, per field, before anything is sent.
   2. An empty optional field must go out as `null`, not as `''`: the API schema only accepts a URL
      or null, so an empty string would fail the request.
   3. `githubLink` (checkpoint 7) behaves like the other social links here, with one difference the
      admin has to be told about: an empty value does not hide the public GitHub icon, it falls back
      to DEFAULT_GITHUB_URL in src/lib/githubLink.ts, which is the address the icon carried before
      the field existed. */

export interface ProfileFormValues {
  bio: string;
  email: string;
  githubLink: string;
  instagramLink: string;
  linkedinLink: string;
  profilePicture: string;
  resumeUrl: string;
  xLink: string;
}

export type ProfileFieldKey = keyof ProfileFormValues;

export const EMPTY_PROFILE_FORM: ProfileFormValues = {
  bio: '',
  email: '',
  githubLink: '',
  instagramLink: '',
  linkedinLink: '',
  profilePicture: '',
  resumeUrl: '',
  xLink: '',
};

/** The admin `Profile` row (`src/app/api/admin/profile/route.ts`) is a database record: every
 *  column is nullable, and `profilePicture` is `''` for an account that never uploaded one. */
export function profileFormFromProfile(profile: Profile): ProfileFormValues {
  return {
    bio: profile.bio ?? '',
    email: profile.email ?? '',
    githubLink: profile.githubLink ?? '',
    instagramLink: profile.instagramLink ?? '',
    linkedinLink: profile.linkedinLink ?? '',
    profilePicture: profile.profilePicture ?? '',
    resumeUrl: profile.resumeUrl ?? '',
    xLink: profile.xLink ?? '',
  };
}

function isUrl(value: string): boolean {
  return profileUrlSchema.safeParse(value).success;
}

/** Field-level messages, keyed by field, in a fixed order so the first one is deterministic. */
export function validateProfileForm(values: ProfileFormValues): Partial<Record<ProfileFieldKey, string>> {
  const errors: Partial<Record<ProfileFieldKey, string>> = {};

  const email = values.email.trim();
  if (email && !profileEmailSchema.safeParse(email).success) {
    errors.email = 'Enter a full email address, like you@example.com.';
  }

  const urlFields: [ProfileFieldKey, string][] = [
    ['githubLink', 'GitHub link'],
    ['xLink', 'X link'],
    ['linkedinLink', 'LinkedIn link'],
    ['instagramLink', 'Instagram link'],
    ['resumeUrl', 'Resume link'],
  ];
  for (const [key, label] of urlFields) {
    const value = values[key].trim();
    if (value && !isUrl(value)) {
      errors[key] = `${label} must be a full address starting with https://`;
    }
  }

  return errors;
}

/** Empty optional fields are sent as null so the API sees "no value" instead of an invalid URL. */
export function buildProfilePayload(values: ProfileFormValues) {
  const trimOrNull = (value: string) => {
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
  };
  return {
    bio: trimOrNull(values.bio),
    email: trimOrNull(values.email),
    githubLink: trimOrNull(values.githubLink),
    instagramLink: trimOrNull(values.instagramLink),
    linkedinLink: trimOrNull(values.linkedinLink),
    profilePicture: trimOrNull(values.profilePicture),
    resumeUrl: trimOrNull(values.resumeUrl),
    xLink: trimOrNull(values.xLink),
  };
}

export function isProfileDirty(values: ProfileFormValues, original: ProfileFormValues): boolean {
  return (Object.keys(values) as ProfileFieldKey[]).some((key) => values[key] !== original[key]);
}
