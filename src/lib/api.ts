// src/lib/api.ts (UPDATED)

import { buildPostListSearchParams, type PostListRequest } from './postFilters';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

async function fetcher<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${url}`, {
    ...options,
    credentials: 'include', // Important: Include cookies
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Something went wrong' }));
    throw new Error(error.message || 'Request failed');
  }

  return res.json();
}

function withQuery(path: string, params: URLSearchParams): string {
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

/* A server error carries a message worth showing ("Cannot delete tag with 3 associated post(s)"),
   but a request that never reached the server rejects with a bare `TypeError` whose text is
   "Failed to fetch" / "Load failed" depending on the browser. That string is not actionable, so
   every admin error state turns it into the sentence in `fallback`. */
const TRANSPORT_ONLY_MESSAGE = /failed to fetch|load failed|networkerror|err_network|network request failed/i;

export function requestFailureMessage(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message.trim() : '';
  if (!message || TRANSPORT_ONLY_MESSAGE.test(message)) return fallback;
  return message;
}

// Public APIs (no auth required)
export const publicApi = {
  // Optimized: Single call for layout data (admin, profile, sections)
  getLayout: () => fetcher('/api/public/layout'),
  
  // Legacy endpoints (kept for backward compatibility)
  getProfile: () => fetcher('/api/public/profile'),
  getSubsections: () => fetcher('/api/public/subsections'),
  getSubsection: (slug: string) => fetcher(`/api/public/subsections/${slug}`),
  getPost: (postSlug: string) => fetcher(`/api/public/posts/${postSlug}`),
  getTags: () => fetcher('/api/public/tags'),
  getTag: (slug: string) => fetcher(`/api/public/tags/${slug}`),
};

// Admin APIs (auth required - cookies sent automatically)
export const adminApi = {
  login: (data: { email: string; secretKey: string }) =>
    fetcher('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  logout: () =>
    fetcher('/api/admin/logout', {
      method: 'POST',
    }),

  // Optimized: Single call for dashboard stats
  getStats: () => fetcher('/api/admin/stats'),

  // Profile
  getProfile: () => fetcher('/api/admin/profile'),
  updateProfile: (data: any) =>
    fetcher('/api/admin/profile', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  // Sections
  getSections: () => fetcher('/api/admin/sections'),
  createSection: (data: any) =>
    fetcher('/api/admin/sections', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateSection: (id: string, data: any) =>
    fetcher(`/api/admin/sections/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteSection: (id: string) =>
    fetcher(`/api/admin/sections/${id}`, {
      method: 'DELETE',
    }),

  // Subsections
  createSubsection: (data: any) =>
    fetcher('/api/admin/subsections', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateSubsection: (slug: string, data: any) =>
    fetcher(`/api/admin/subsections/${slug}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteSubsection: (slug: string) =>
    fetcher(`/api/admin/subsections/${slug}`, {
      method: 'DELETE',
    }),

  // Posts (subsection-based endpoints)
  getPosts: (subsectionSlug: string) =>
    fetcher(`/api/admin/subsections/${subsectionSlug}/posts`),

  /* Single authenticated post list (checkpoint 6 of docs/admin-redesign-plan.md). This replaces
     the `PostsManager` fan-out, which issued one request per subsection and turned every failed
     request into an empty list; filtering and paging are query parameters now. */
  listPosts: (filters: PostListRequest = {}) =>
    fetcher(withQuery('/api/admin/posts', buildPostListSearchParams(filters))),

  createPost: (subsectionSlug: string, data: any) =>
    fetcher(`/api/admin/subsections/${subsectionSlug}/posts`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getPost: (subsectionSlug: string, postSlug: string) =>
    fetcher(`/api/admin/subsections/${subsectionSlug}/posts/${postSlug}`),
  updatePost: (subsectionSlug: string, postSlug: string, data: any) =>
    fetcher(`/api/admin/subsections/${subsectionSlug}/posts/${postSlug}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deletePost: (subsectionSlug: string, postSlug: string) =>
    fetcher(`/api/admin/subsections/${subsectionSlug}/posts/${postSlug}`, {
      method: 'DELETE',
    }),
  togglePublish: (subsectionSlug: string, postSlug: string, published: boolean) =>
    fetcher(`/api/admin/subsections/${subsectionSlug}/posts/${postSlug}`, {
      method: 'PATCH',
      body: JSON.stringify({ published }),
    }),

  // Direct post endpoints (by slug only) - NEW
  getPostBySlug: (postSlug: string) =>
    fetcher(`/api/admin/posts/${postSlug}`),
  updatePostBySlug: (postSlug: string, data: any) =>
    fetcher(`/api/admin/posts/${postSlug}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deletePostBySlug: (postSlug: string) =>
    fetcher(`/api/admin/posts/${postSlug}`, {
      method: 'DELETE',
    }),

  // Image upload (profile picture and post covers; the route wraps Cloudinary)
  uploadImage: (image: string) =>
    fetcher('/api/admin/upload', {
      method: 'POST',
      body: JSON.stringify({ image }),
    }),

  // Tags
  getTags: () => fetcher('/api/admin/tags'),
  createTag: (data: any) =>
    fetcher('/api/admin/tags', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateTag: (tagSlug: string, data: any) =>
    fetcher(`/api/admin/tags/${tagSlug}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteTag: (tagSlug: string) =>
    fetcher(`/api/admin/tags/${tagSlug}`, {
      method: 'DELETE',
    }),
};