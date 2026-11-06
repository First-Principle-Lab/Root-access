import { prisma } from "@/src/lib/prisma";
import { tagsSchema } from "@/src/schema/tagSchema";
import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/src/lib/authWrapper";

async function postHandler(req: NextRequest) {
  try {
    const data = await req.json();

    if (!data || (typeof data === "object" && Object.keys(data).length === 0)) {
      return NextResponse.json(
        { message: "Required details missing" },
        { status: 400 }
      );
    }
    const parsedData = tagsSchema.safeParse(data);
    if (!parsedData.success) {
      return NextResponse.json(
        { message: "Invalid input or missing inputs" },
        { status: 400 }
      );
    }

    let { name } = parsedData.data;

    name = name.trim().toUpperCase();

    const existingTag = await prisma.tag.findUnique({
      where: { name }, 
    });

    if (existingTag) {
      return NextResponse.json(
        { message: "Tag already exists" },
        { status: 400 }
      );
    }

    const slug = name;

    const existingBySlug = await prisma.tag.findUnique({
      where: { slug },
    });
    if (existingBySlug) {
      return NextResponse.json(
        { message: "A similar tag already exists" },
        { status: 400 }
      );
    }

    const tag = await prisma.tag.create({
      data: { name, slug },
    });

    return NextResponse.json(
      { message: "Tag is created", tag },
      { status: 201 }
    );
  } catch (err) {
    console.error("Error creating tag:", err);
    return NextResponse.json(
      { message: "Something went wrong" },
      { status: 500 }
    );
  }
}

async function getHandler(req: NextRequest) {
  try {
    // The tags screen only needs how many posts carry each tag, not the posts themselves.
    const rows = await prisma.tag.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        _count: { select: { posts: true } }
      },
      orderBy: {
        createdAt: "desc"
      }
    });
    const tags = rows.map(({ _count, ...tag }) => ({ ...tag, postCount: _count.posts }));
    return NextResponse.json(
      { message: "Tags retrieved", tags: tags },
      { status: 200 }
    );
  } catch (err) {
    console.error("Error fetching tags:", err);
    return NextResponse.json(
      { message: "Something went wrong" },
      { status: 500 }
    );
  }
}

export const POST = withAuth(postHandler);
export const GET = withAuth(getHandler);