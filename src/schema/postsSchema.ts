import { z } from "zod";

export const coverImageSchema = z.string().refine(
  (value) => value === "" || z.url().safeParse(value).success || /^\/(?!\/)[^\s]+$/.test(value),
  "Use a full image URL or a site path starting with /",
).optional();

/* The same rule as a sentence a person can act on, for the editor's own project-link field
   (an empty value is allowed here: `postsSchema` below lets a non-project post carry "", and
   the create/update routes store that as null). */
export const projectLinkSchema = z.string().refine(
  (value) => value === "" || z.url().safeParse(value).success,
  "Use a full link starting with https://",
);

/* Post editor draft (checkpoint 6 of docs/admin-redesign-plan.md). The endpoints above validate
   what arrives over HTTP; this validates what is typed into `/admin/posts/new` and
   `/admin/posts/edit/...` *before* a request is made, in the shapes the form actually holds:
   tags as one comma-separated string and archive year as raw text input. The style-specific
   rules (a writing needs a body, a project needs its link) are layered on in
   src/lib/postEditor.ts because they depend on the subsection, which is not part of the payload. */
export const postDraftSchema = z.object({
  title: z.string().trim().min(1, "A post needs a title"),
  description: z.string().trim().max(600, "Keep the description under 600 characters").optional(),
  content: z.string().optional(),
  excerpt: z.string().trim().max(400, "Keep the excerpt under 400 characters").optional(),
  coverImage: coverImageSchema,
  tags: z.string().optional(),
  projectLink: projectLinkSchema.optional(),
  archiveYear: z.string().refine(
    (value) => value === "" || (/^\d{4}$/.test(value) && Number(value) >= 1900 && Number(value) <= 2100),
    "Use a year between 1900 and 2100, or leave it empty",
  ).optional(),
});

export type PostDraftInput = z.input<typeof postDraftSchema>;

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
