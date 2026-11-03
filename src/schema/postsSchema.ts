import { z } from "zod";

const coverImageSchema = z.string().refine(
  (value) => value === "" || z.url().safeParse(value).success || /^\/(?!\/)[^\s]+$/.test(value),
  "Use a full image URL or a site path starting with /",
).optional();

export const postsSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional().default(""), // Optional for title_only posts
  content: z.string().optional(), // Optional - may be empty for project/title_only subsections
  excerpt: z.string().optional(),
  coverImage: coverImageSchema,
  published: z.boolean().default(false),
  archiveYear: z.number().int().min(1900).max(2100).nullable().optional(),
  tags: z.array(z.string()).optional(),
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
  
  // Project-specific field (only used when subsection displayStyle is 'project')
  projectLink: z.string().url().optional().or(z.literal("")),
});

export const updatePostSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  content: z.string().optional(),
  excerpt: z.string().optional(),
  coverImage: coverImageSchema,
  published: z.boolean().optional(),
  archiveYear: z.number().int().min(1900).max(2100).nullable().optional(),
  tags: z.array(z.string()).optional(),
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
  
  // Project-specific field
  projectLink: z.string().url().optional().or(z.literal("")),
});
