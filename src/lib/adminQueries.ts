'use client';

import { adminApi } from './api';
import { buildPostListSearchParams, type PostListRequest } from './postFilters';
import { invalidateAdminQueries, prefetchAdminQuery } from './adminQuery';
import type { DashboardStats, PostListResponse, Profile, Tag, TopCategory } from '@/src/types';

/* Cache keys and loaders for every admin read, in one place so a screen and the sidebar's
   hover-prefetch always agree on what a key means. */

export const adminQueryKeys = {
  stats: 'stats',
  sections: 'sections',
  tags: 'tags',
  profile: 'profile',
  posts: (request: PostListRequest) => `posts?${buildPostListSearchParams(request)}`,
} as const;

export const loadStats = () => adminApi.getStats() as Promise<DashboardStats>;
export const loadSections = () =>
  (adminApi.getSections() as Promise<{ sections: TopCategory[] }>).then((res) => res.sections);
export const loadTags = () => (adminApi.getTags() as Promise<{ tags: Tag[] }>).then((res) => res.tags);
export const loadProfile = () =>
  (adminApi.getProfile() as Promise<{ profile: Profile }>).then((res) => res.profile);
export const loadPosts = (request: PostListRequest) => adminApi.listPosts(request) as Promise<PostListResponse>;

/* The first request each screen makes, with the same arguments the screen uses. */
export const DASHBOARD_RECENT_REQUEST: PostListRequest = { limit: 5 };
export const POSTS_FIRST_PAGE_REQUEST: PostListRequest = {
  search: '',
  status: 'all',
  subsection: '',
  sort: 'updated',
  page: 1,
  limit: 10,
};

const ROUTE_PREFETCH: Record<string, () => void> = {
  '/admin': () => {
    prefetchAdminQuery(adminQueryKeys.stats, loadStats);
    prefetchAdminQuery(adminQueryKeys.posts(DASHBOARD_RECENT_REQUEST), () => loadPosts(DASHBOARD_RECENT_REQUEST));
  },
  '/admin/sections': () => prefetchAdminQuery(adminQueryKeys.sections, loadSections),
  '/admin/subsections': () => prefetchAdminQuery(adminQueryKeys.sections, loadSections),
  '/admin/posts': () => {
    prefetchAdminQuery(adminQueryKeys.sections, loadSections);
    prefetchAdminQuery(adminQueryKeys.posts(POSTS_FIRST_PAGE_REQUEST), () => loadPosts(POSTS_FIRST_PAGE_REQUEST));
  },
  '/admin/tags': () => prefetchAdminQuery(adminQueryKeys.tags, loadTags),
  '/admin/profile': () => prefetchAdminQuery(adminQueryKeys.profile, loadProfile),
};

/** Start loading a screen's data as soon as the pointer or focus lands on its link. */
export function prefetchAdminRoute(href: string) {
  ROUTE_PREFETCH[href]?.();
}

/* What a write makes stale. Every content write can change the dashboard counts. */
export const invalidateAfter = {
  post: () => {
    invalidateAdminQueries('posts?');
    invalidateAdminQueries(adminQueryKeys.stats);
    // Tag counts and subsection post counts follow posts.
    invalidateAdminQueries(adminQueryKeys.tags);
    invalidateAdminQueries(adminQueryKeys.sections);
  },
  structure: () => {
    invalidateAdminQueries(adminQueryKeys.sections);
    invalidateAdminQueries(adminQueryKeys.stats);
    invalidateAdminQueries('posts?');
  },
  tags: () => {
    invalidateAdminQueries(adminQueryKeys.tags);
    invalidateAdminQueries(adminQueryKeys.stats);
  },
  profile: () => invalidateAdminQueries(adminQueryKeys.profile),
};
