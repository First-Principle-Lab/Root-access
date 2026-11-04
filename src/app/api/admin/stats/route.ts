import { prisma } from "@/src/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/src/lib/authWrapper";

/* Dashboard counts (checkpoint 5 of docs/admin-redesign-plan.md).
   The baseline reported one number per content type and got "Posts" wrong: it counted
   `published: true` only, so five drafts existed in the database and the dashboard said the
   site had 12 posts with none in progress. Every number here is a direct count, and drafts and
   hidden rows are broken out because those are the two states the old dashboard made invisible.
   "Recently edited" is deliberately NOT here: it is a list of posts, and the post list endpoint
   (src/app/api/admin/posts/route.ts) is the one place that answers questions about posts. */
async function getHandler(req: NextRequest) {
  try {
    const [sections, hiddenSections, subsections, hiddenSubsections, published, drafts, tags] =
      await Promise.all([
        prisma.topCategory.count(),
        prisma.topCategory.count({ where: { isVisible: false } }),
        prisma.subsection.count(),
        prisma.subsection.count({ where: { isVisible: false } }),
        prisma.post.count({ where: { published: true } }),
        prisma.post.count({ where: { published: false } }),
        prisma.tag.count(),
      ]);

    return NextResponse.json(
      {
        sections,
        hiddenSections,
        subsections,
        hiddenSubsections,
        published,
        drafts,
        totalPosts: published + drafts,
        tags,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("GET stats error:", error);
    return NextResponse.json(
      { message: "Something went wrong" },
      { status: 500 }
    );
  }
}

export const GET = withAuth(getHandler);
