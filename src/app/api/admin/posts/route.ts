import { prisma } from "@/src/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/src/lib/authWrapper";
import { serializePosts } from "@/src/lib/serialize";
import {
  buildPostListOrderBy,
  buildPostListPageInfo,
  buildPostListWhere,
  parsePostListParams,
} from "@/src/lib/postFilters";

/* The single authenticated post list (checkpoint 6 of docs/admin-redesign-plan.md).
   Before this, `/admin/posts` issued one request per subsection and swallowed each failure into
   an empty list (`src/components/admin/post/PostsManager.tsx:55-58`), so a failed subsection read
   looked like "this subsection has no posts". Filtering, ordering and paging happen here instead,
   and a database failure is reported as a 500 the client can show. */
const POST_LIST_SELECT = {
  id: true,
  title: true,
  slug: true,
  description: true,
  excerpt: true,
  coverImage: true,
  projectLink: true,
  published: true,
  publishedAt: true,
  archiveYear: true,
  views: true,
  readTime: true,
  createdAt: true,
  updatedAt: true,
  subsection: {
    select: {
      name: true,
      slug: true,
      displayStyle: true,
      topCategory: { select: { name: true } },
    },
  },
  tags: { select: { id: true, name: true, slug: true } },
} as const;

async function getHandler(req: NextRequest) {
  const parsed = parsePostListParams(req.nextUrl.searchParams);
  if (!parsed.ok) {
    return NextResponse.json({ message: parsed.message }, { status: 400 });
  }

  const { page, limit } = parsed.query;
  const where = buildPostListWhere(parsed.query);
  const orderBy = buildPostListOrderBy(parsed.query);

  try {
    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        select: POST_LIST_SELECT,
      }),
      prisma.post.count({ where }),
    ]);

    return NextResponse.json(
      {
        posts: serializePosts(posts),
        ...buildPostListPageInfo(total, page, limit),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("GET /api/admin/posts error:", error);
    return NextResponse.json(
      { message: "Posts could not be loaded. Your filters are fine - the request failed." },
      { status: 500 }
    );
  }
}

export const GET = withAuth(getHandler);
