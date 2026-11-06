import { prisma } from "@/src/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const [admin, sections] = await Promise.all([
      prisma.admin.findFirst({
        select: {
          name: true,
          profile: {
            select: {
              id: true,
              bio: true,
              xLink: true,
              instagramLink: true,
              linkedinLink: true,
              githubLink: true,
              email: true,
              resumeUrl: true,
              profilePicture: true, 
            },
          },
        },
      }),
      prisma.topCategory.findMany({
        where: {
          isVisible: true,
        },
        select: {
          id: true,
          name: true,
          isVisible: true,
          subsections: {
            where: {
              isVisible: true,
            },
            select: {
              id: true,
              name: true,
              slug: true,
              icon: true,
              _count: {
                select: {
                  posts: { where: { published: true } },
                },
              },
            },
            orderBy: {
              name: 'asc',
            },
          },
        },
        orderBy: {
          name: 'asc',
        },
      }),
    ]);

    if (!admin) {
      return NextResponse.json(
        { message: "Admin not found" },
        { status: 404 }
      );
    }

    const sectionsWithCounts = sections.map((section) => ({
      ...section,
      subsections: section.subsections.map((sub) => ({
        id: sub.id,
        name: sub.name,
        slug: sub.slug,
        icon: sub.icon,
        postCount: sub._count.posts,
      })),
    }));

    return NextResponse.json({
      admin: {
        name: admin.name,
        profile: admin.profile,
      },
      sections: sectionsWithCounts,
    }, { status: 200 });
  } catch (error) {
    console.error("GET layout data error:", error);
    return NextResponse.json(
      { message: "Something went wrong" },
      { status: 500 }
    );
  }
}