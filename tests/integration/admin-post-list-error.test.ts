import { describe, expect, it, vi } from 'vitest';

/* The failure path the PostsManager fan-out used to hide (checkpoint 6 of
   docs/admin-redesign-plan.md): a database error must come back as a reported error, never as an
   empty list that the UI renders as "no posts yet". Only the two `post` delegates are broken here;
   every other model still reaches the real isolated database, so the session cookie in this test
   comes from the real login endpoint like everywhere else. */
vi.mock('@/src/lib/prisma', async () => {
  const actual = await vi.importActual<typeof import('@/src/lib/prisma')>('@/src/lib/prisma');
  const failure = () => Promise.reject(new Error('simulated connection reset'));
  const post = { count: failure, findMany: failure };
  return {
    prisma: new Proxy(actual.prisma, {
      get(target, property, receiver) {
        if (property === 'post') return post;
        return Reflect.get(target, property, receiver);
      },
    }),
  };
});

const { GET } = await import('@/src/app/api/admin/posts/route');
const { authedRequest } = await import('./helpers/session');

describe('GET /api/admin/posts when the database fails', () => {
  it('returns a 500 with a message instead of an empty list', async () => {
    const response = await GET(await authedRequest('/api/admin/posts'));
    const body = (await response.json()) as { posts?: unknown; total?: unknown; message?: string };

    expect(response.status).toBe(500);
    expect(typeof body.message).toBe('string');
    expect(body.message && body.message.length).toBeGreaterThan(0);
    // The distinction the whole endpoint exists for: a failed read is not "zero posts".
    expect(body).not.toHaveProperty('posts');
    expect(body).not.toHaveProperty('total');
  });
});
