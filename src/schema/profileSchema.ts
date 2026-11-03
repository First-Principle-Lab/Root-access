import {z} from "zod"

export const updateProfileSchema = z.object({
  bio: z.string().nullable().optional(),
  xLink: z.string().url().nullable().optional(),
  instagramLink: z.string().url().nullable().optional(),
  linkedinLink: z.string().url().nullable().optional(),
  githubLink: z.string().url().nullable().optional(),
  email: z.string().email().nullable().optional(),
  resumeUrl: z.string().url().nullable().optional(),
  profilePicture: z.string().url().nullable().optional(), 
});