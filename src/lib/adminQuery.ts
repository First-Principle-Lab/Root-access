'use client';

import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';

/* A small stale-while-revalidate cache for the admin screens.

   Each screen used to fetch on mount behind a spinner, so moving between screens (or coming
   back to one) always meant waiting again. Now a screen renders whatever it last saw at once,
   refreshes in the background, and requests for the same key share one network call: the
   sections list, which three screens read, is fetched once. Entries are immutable snapshots so
   `useSyncExternalStore` can tell when one changed. */

interface Entry<T = unknown> {
  data?: T;
  error?: unknown;
  promise?: Promise<T>;
  updatedAt: number;
}

const EMPTY: Entry = { updatedAt: 0 };
/* A screen mounted again within this window reuses the entry without asking the server. */
const FRESH_MS = 2000;

const cache = new Map<string, Entry>();
const listeners = new Map<string, Set<() => void>>();

function write(key: string, entry: Entry) {
  cache.set(key, entry);
  listeners.get(key)?.forEach((notify) => notify());
}

function load<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const current = cache.get(key) ?? EMPTY;
  if (current.promise) return current.promise as Promise<T>;

  const promise = fetcher().then(
    (data) => {
      write(key, { data, updatedAt: Date.now() });
      return data;
    },
    (error: unknown) => {
      // Keep the last good data on screen; the caller decides how loudly to report the error.
      write(key, { data: (cache.get(key) ?? EMPTY).data, error, updatedAt: Date.now() });
      throw error;
    },
  );
  write(key, { ...current, promise });
  return promise;
}

/** Warm the cache before a screen needs it (e.g. when a nav link is hovered). */
export function prefetchAdminQuery<T>(key: string, fetcher: () => Promise<T>) {
  const current = cache.get(key);
  if (current?.promise || (current?.data !== undefined && Date.now() - current.updatedAt < FRESH_MS * 5)) return;
  load(key, fetcher).catch(() => {});
}

/**
 * Mark every cached key starting with `prefix` as stale. Keys a mounted screen is showing are
 * refetched straight away; the rest refetch the next time a screen asks for them.
 */
export function invalidateAdminQueries(prefix: string) {
  for (const [key, entry] of cache) {
    if (!key.startsWith(prefix)) continue;
    cache.set(key, { ...entry, updatedAt: 0 });
    listeners.get(key)?.forEach((notify) => notify());
  }
}

/** Forget everything, e.g. on logout, so the next session never sees the last one's data. */
export function clearAdminQueries() {
  cache.clear();
  listeners.forEach((set) => set.forEach((notify) => notify()));
}

/** Replace a cached value in place, for optimistic updates. */
export function setAdminQueryData<T>(key: string, update: (current: T | undefined) => T | undefined) {
  const current = cache.get(key) ?? EMPTY;
  write(key, { ...current, data: update(current.data as T | undefined) });
}

export interface AdminQuery<T> {
  data: T | undefined;
  error: unknown;
  /** True only before the first response: nothing to show yet. */
  isLoading: boolean;
  /** True whenever a request for this key is in flight, including background refreshes. */
  isValidating: boolean;
  refresh: () => Promise<T | undefined>;
}

export function useAdminQuery<T>(key: string | null, fetcher: () => Promise<T>): AdminQuery<T> {
  const fetcherRef = useRef(fetcher);
  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  const subscribe = useCallback(
    (notify: () => void) => {
      if (!key) return () => {};
      let set = listeners.get(key);
      if (!set) listeners.set(key, (set = new Set()));
      set.add(notify);
      return () => {
        set.delete(notify);
      };
    },
    [key],
  );
  const entry = useSyncExternalStore(
    subscribe,
    () => (key ? cache.get(key) ?? EMPTY : EMPTY),
    () => EMPTY,
  ) as Entry<T>;

  // Fetch when the key appears, and again whenever the entry goes stale while mounted.
  useEffect(() => {
    if (!key || entry.promise) return;
    if (entry.updatedAt !== 0 && Date.now() - entry.updatedAt < FRESH_MS) return;
    load(key, () => fetcherRef.current()).catch(() => {});
  }, [key, entry.promise, entry.updatedAt]);

  const refresh = useCallback(async () => {
    if (!key) return undefined;
    cache.set(key, { ...(cache.get(key) ?? EMPTY), updatedAt: 0 });
    try {
      return await load(key, () => fetcherRef.current());
    } catch {
      return undefined;
    }
  }, [key]);

  return {
    data: entry.data,
    error: entry.error,
    isLoading: Boolean(key) && entry.data === undefined && entry.error === undefined,
    isValidating: Boolean(entry.promise),
    refresh,
  };
}
