import { prisma } from "@/src/lib/prisma";
import { updateProfileSchema } from "@/src/schema/profileSchema";
import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/src/lib/authWrapper";

async function getHandler(req: NextRequest) {
  try {
    const session = (req as any).session; 

    const profile = await prisma.profile.findUnique({
      where: { adminId: session.userId },
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
        admin: { select: { name: true } },
      },
    });

    if (!profile) {
      return NextResponse.json(
        { message: "Profile not found" },
        { status: 404 }
      );
    }

    const { admin, ...rest } = profile;
    return NextResponse.json({ profile: { ...rest, name: admin.name } }, { status: 200 });
  } catch (error) {
    console.error("GET profile error:", error);
    return NextResponse.json(
      { message: "Something went wrong" },
      { status: 500 }
    );
  }
}

async function patchHandler(req: NextRequest) {
  try {
    const session = (req as any).session;

    const body = await req.json();
    const parsed = updateProfileSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { message: "Invalid data", errors: parsed.error.format() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    const profile = await prisma.profile.upsert({
      where: { adminId: session.userId },
      /* `?? undefined` here used to swallow an explicit null, so clearing a field (deleting the
      bio, removing the picture) reported success and changed nothing. A field that is absent from
      the payload stays untouched; a field that arrives as null is cleared. */
      update: {
        bio: data.bio === undefined ? undefined : data.bio,
        xLink: data.xLink === undefined ? undefined : data.xLink,
        instagramLink: data.instagramLink === undefined ? undefined : data.instagramLink,
        linkedinLink: data.linkedinLink === undefined ? undefined : data.linkedinLink,
        githubLink: data.githubLink === undefined ? undefined : data.githubLink,
        email: data.email === undefined ? undefined : data.email,
        resumeUrl: data.resumeUrl === undefined ? undefined : data.resumeUrl,
        profilePicture: data.profilePicture === undefined ? undefined : data.profilePicture,
      },
      create: {
        adminId: session.userId,
        bio: data.bio ?? null,
        xLink: data.xLink ?? null,
        instagramLink: data.instagramLink ?? null,
        linkedinLink: data.linkedinLink ?? null,
        githubLink: data.githubLink ?? null,
        email: data.email ?? null,
        resumeUrl: data.resumeUrl ?? null,
        profilePicture: data.profilePicture ?? null, 
      },
    });

    return NextResponse.json(
      { message: "Profile updated successfully", profile },
      { status: 200 }
    );
  } catch (error) {
    console.error("PATCH profile error:", error);
    return NextResponse.json(
      { message: "Something went wrong" },
      { status: 500 }
    );
  }
}

export const GET = withAuth(getHandler);
export const PATCH = withAuth(patchHandler);