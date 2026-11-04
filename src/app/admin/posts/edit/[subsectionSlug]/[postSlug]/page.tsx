import { AdminLayout } from "@/src/components/admin/adminLayout";
import { PostEditor } from "@/src/components/admin/post/PostEditor";

interface PageProps {
  params: Promise<{ subsectionSlug: string; postSlug: string }>;
}

export default async function Page({ params }: PageProps) {
  const { subsectionSlug, postSlug } = await params;
  return (
    <AdminLayout>
      <PostEditor mode="edit" postSlug={postSlug} subsectionSlug={subsectionSlug} />
    </AdminLayout>
  );
}
