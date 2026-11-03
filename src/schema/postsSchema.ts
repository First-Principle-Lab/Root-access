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

/* Query contract for the single authenticated post list endpoint
   (src/app/api/admin/posts/route.ts, checkpoint 6 of docs/admin-redesign-plan.md). It replaces
   the per-subsection fan-out, so the filters that used to live in PostsManager state now have a
   server-side shape: status is one of three values (never a free string), `limit` is capped so a
   client cannot ask for every post at once, and a malformed page/limit is a 400 rather than a
   silently ignored parameter. */
export const postListQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  status: z.enum(["all", "published", "draft"]).optional().default("all"),
  subsection: z.string().trim().min(1).optional(),
  sort: z.enum(["updated", "created", "title"]).optional().default("updated"),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export type PostListQuery = z.infer<typeof postListQuerySchema>;
