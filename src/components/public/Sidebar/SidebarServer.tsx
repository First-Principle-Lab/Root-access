import { prisma } from '@/src/lib/prisma';
import { SidebarClient } from './SidebarClient';
import { unstable_cache } from 'next/cache';

const getSidebarData = unstable_cache(
  async () => {
    const [layoutData, sections] = await Promise.all([
      prisma.admin.findFirst({
        select: {
          name: true,
          profile: {
            select: {
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
        where: { isVisible: true },
        select: {
          id: true,
          name: true,
          isVisible: true,
          subsections: {
            where: { isVisible: true },
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
            orderBy: { name: 'asc' },
          },
        },
        orderBy: { name: 'asc' },
      }),
    ]);

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

    return {
      admin: {
        name: layoutData?.name || 'Parth Thirwani',
        profile: layoutData?.profile || null,
      },
      sections: sectionsWithCounts,
    };
  },
  ['sidebar-data'],
  { revalidate: 60 }
);

export async function PublicSidebarServer() {
  try {
    const data = await getSidebarData();
    return <SidebarClient layoutData={data} />;
  } catch (error) {
    console.error('[Sidebar] Failed to fetch sidebar data:', error);
    return (
      <SidebarClient
        layoutData={{ admin: { name: 'Parth Thirwani', profile: null }, sections: [] }}
      />
    );
  }
}
