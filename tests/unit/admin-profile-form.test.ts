import { describe, expect, it } from 'vitest';
import {
  EMPTY_PROFILE_FORM,
  buildProfilePayload,
  isProfileDirty,
  profileFormFromProfile,
  validateProfileForm,
} from '../../src/components/admin/profile/profileForm';
import { DEFAULT_GITHUB_URL } from '@/src/lib/githubLink';
import type { Profile } from '@/src/types';

/* The baseline posted the form verbatim: a half-typed `x.com/me` reached
   `z.string().url()` in src/schema/profileSchema.ts and the API answered the whole save with one
   "Invalid data" 400, and an empty optional field went out as `''`, which is not a URL either. Both
   rules now live in profileForm.ts and are checked here. */

const profile = (over: Partial<Profile> = {}): Profile => ({
  bio: null,
  email: null,
  githubLink: null,
  id: 'profile_1',
  instagramLink: null,
  linkedinLink: null,
  profilePicture: '',
  resumeUrl: null,
  xLink: null,
  ...over,
});

describe('profileFormFromProfile', () => {
  it('turns every null column into an empty field instead of the string "null"', () => {
    expect(profileFormFromProfile(profile())).toEqual(EMPTY_PROFILE_FORM);
  });

  it('keeps stored values exactly as they are', () => {
    const loaded = profileFormFromProfile(
      profile({
        bio: 'Building CodeMate.',
        email: 'hello@test.local',
        profilePicture: 'https://cdn.example.com/me.png',
        xLink: 'https://x.com/parththirwani',
      }),
    );
    expect(loaded.bio).toBe('Building CodeMate.');
    expect(loaded.xLink).toBe('https://x.com/parththirwani');
    expect(loaded.profilePicture).toBe('https://cdn.example.com/me.png');
  });
});

describe('validateProfileForm', () => {
  it('accepts an entirely empty form: every profile field is optional', () => {
    expect(validateProfileForm(EMPTY_PROFILE_FORM)).toEqual({});
  });

  it('accepts a fully filled form with real URLs', () => {
    expect(
      validateProfileForm({
        ...EMPTY_PROFILE_FORM,
        bio: 'Building CodeMate.',
        email: 'hello@test.local',
        githubLink: 'https://github.com/parththirwani',
        instagramLink: 'https://instagram.com/parththirwani',
        linkedinLink: 'https://linkedin.com/in/parththirwani',
        profilePicture: 'https://cdn.example.com/me.png',
        resumeUrl: 'https://example.com/resume.pdf',
        xLink: 'https://x.com/parththirwani',
      }),
    ).toEqual({});
  });

  it('names the field that holds the bad link instead of failing the whole save', () => {
    const errors = validateProfileForm({
      ...EMPTY_PROFILE_FORM,
      linkedinLink: 'linkedin.com/in/me',
      xLink: 'x.com/me',
    });
    expect(Object.keys(errors).sort()).toEqual(['linkedinLink', 'xLink']);
    expect(errors.xLink).toContain('https://');
  });

  it('checks the email shape, and only when something was typed', () => {
    expect(validateProfileForm({ ...EMPTY_PROFILE_FORM, email: 'not-an-email' }).email).toBeTruthy();
    expect(validateProfileForm({ ...EMPTY_PROFILE_FORM, email: '   ' })).toEqual({});
  });

  it('names the GitHub field when its link is half-typed, like the other social links', () => {
    const errors = validateProfileForm({ ...EMPTY_PROFILE_FORM, githubLink: 'github.com/me' });
    expect(Object.keys(errors)).toEqual(['githubLink']);
    expect(errors.githubLink).toContain('https://');
  });

  it('does not police the picture field, which can be a stored upload URL', () => {
    expect(
      validateProfileForm({ ...EMPTY_PROFILE_FORM, profilePicture: 'https://cdn.example.com/a.png' }),
    ).toEqual({});
  });
});

describe('buildProfilePayload', () => {
  it('sends null, never an empty string, for an untouched optional field', () => {
    const payload = buildProfilePayload(EMPTY_PROFILE_FORM);
    expect(payload.xLink).toBeNull();
    expect(payload.email).toBeNull();
    expect(payload.bio).toBeNull();
  });

  it('trims what it sends', () => {
    const payload = buildProfilePayload({ ...EMPTY_PROFILE_FORM, xLink: '  https://x.com/me  ' });
    expect(payload.xLink).toBe('https://x.com/me');
  });

  it('sends an emptied GitHub field as null so the read path falls back, not as an empty string', () => {
    const filled = profileFormFromProfile(profile({ githubLink: 'https://github.com/someone' }));
    expect(buildProfilePayload(filled).githubLink).toBe('https://github.com/someone');
    expect(buildProfilePayload({ ...filled, githubLink: '' }).githubLink).toBeNull();
  });
});

describe('isProfileDirty', () => {
  it('is false for a form that has not been touched', () => {
    const loaded = profileFormFromProfile(profile({ bio: 'Stored bio.' }));
    expect(isProfileDirty(loaded, loaded)).toBe(false);
  });

  it('is true as soon as one field differs, including a cleared one', () => {
    const loaded = profileFormFromProfile(profile({ bio: 'Stored bio.' }));
    expect(isProfileDirty({ ...loaded, bio: '' }, loaded)).toBe(true);
    expect(isProfileDirty({ ...loaded, email: 'a@b.co' }, loaded)).toBe(true);
  });

  it('treats editing or clearing the GitHub link as a change', () => {
    const loaded = profileFormFromProfile(profile({ githubLink: DEFAULT_GITHUB_URL }));
    expect(isProfileDirty({ ...loaded, githubLink: 'https://github.com/someone' }, loaded)).toBe(true);
    expect(isProfileDirty({ ...loaded, githubLink: '' }, loaded)).toBe(true);
  });
});
