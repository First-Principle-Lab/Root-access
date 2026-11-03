import { DisplayStyle } from "@/prisma/generated/client";

export interface Profile {
  id: string;
  bio: string | null;
  xLink: string | null;
  instagramLink: string | null;
  linkedinLink: string | null;
  email: string | null;
  resumeUrl: string | null;
  profilePicture: string;
}

export interface TopCategory {
  id: string;
  name: string;
  isVisible: boolean;
  subsections: Subsection[];
}


export interface Subsection {
  id: string;
  name: string;
  slug: string;
  icon: string;
  isVisible: boolean;
  postCount: number;
  displayStyle: DisplayStyle;
  topCategoryId: string;
  topCategory?: {
    name: string;
  };
  posts?: Post[];
}

export interface Post {
  id: string;
  title: string;
  description: string;
  slug: string;
  content: string;
  excerpt: string | null;
  coverImage: string | null;
  published: boolean;
  publishedAt: string | null;
  archiveYear: number | null;
  views: number;
  readTime: number | null;
  metaTitle: string | null;
  metaDescription: string | null;
  // Project-specific field
  projectLink: string | null;
  // Only the admin list endpoint reports it (src/app/api/admin/posts/route.ts); the public
  // serializers do not, so it stays optional.
  updatedAt?: string;
  subsection: {
    name: string;
    slug: string;
    displayStyle: DisplayStyle;
    topCategory?: {
      name: string;
    };
  };
  tags: Tag[];
}

export interface Tag {
  id: string;
  name: string;
  slug: string;
  posts?: Post[];
}

export interface Admin {
  id: string;
  email: string;
  name: string;
}

/* One row of the admin post list (src/app/api/admin/posts/route.ts). It is `Post` without
   `content`: the list never ships markdown for a whole page of rows, and the editor loads a
   single post when it opens. */
export interface PostListItem extends Omit<Post, 'content'> {
  updatedAt: string;
}

export interface PostListResponse {
  posts: PostListItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/* Every number on the dashboard, all of them counts the API can actually make
   (src/app/api/admin/stats/route.ts). */
export interface DashboardStats {
  sections: number;
  hiddenSections: number;
  subsections: number;
  hiddenSubsections: number;
  published: number;
  drafts: number;
  totalPosts: number;
  tags: number;
}
