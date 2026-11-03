import {z} from "zod"

/* The single-value shapes behind the profile columns. The admin form checks a half-typed value
   field by field before it sends anything (src/components/admin/profile/profileForm.ts) and the
   PATCH route validates the payload; both now read these, so the two can never drift apart. */
export const profileUrlSchema = z.string().url()
export const profileEmailSchema = z.string().email()

export const updateProfileSchema = z.object({
  bio: z.string().nullable().optional(),
  xLink: profileUrlSchema.nullable().optional(),
  instagramLink: profileUrlSchema.nullable().optional(),
  linkedinLink: profileUrlSchema.nullable().optional(),
  githubLink: profileUrlSchema.nullable().optional(),
  email: profileEmailSchema.nullable().optional(),
  resumeUrl: profileUrlSchema.nullable().optional(),
  profilePicture: profileUrlSchema.nullable().optional(), 
});