import { prisma } from "@/src/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/src/lib/authWrapper";

interface StatsRow {
  sections: number;
  hiddenSections: number;
  subsections: number;
  hiddenSubsections: number;
  published: number;
  drafts: number;
  tags: number;
}

/* Dashboard counts. All seven come back from one statement so the dashboard costs a single
   round trip to the database instead of seven. */
async function getHandler(req: NextRequest) {
  try {
    const [row] = await prisma.$queryRaw<StatsRow[]>`
      SELECT
        (SELECT COUNT(*) FROM "TopCategory")::int                         AS "sections",
        (SELECT COUNT(*) FROM "TopCategory" WHERE NOT "isVisible")::int   AS "hiddenSections",
        (SELECT COUNT(*) FROM "Subsection")::int                          AS "subsections",
        (SELECT COUNT(*) FROM "Subsection" WHERE NOT "isVisible")::int    AS "hiddenSubsections",
        (SELECT COUNT(*) FROM "Post" WHERE "published")::int              AS "published",
        (SELECT COUNT(*) FROM "Post" WHERE NOT "published")::int          AS "drafts",
        (SELECT COUNT(*) FROM "Tag")::int                                 AS "tags"
    `;

    return NextResponse.json(
      { ...row, totalPosts: row.published + row.drafts },
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
