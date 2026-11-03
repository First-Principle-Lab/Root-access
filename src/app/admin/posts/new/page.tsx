import { AdminLayout } from "@/src/components/admin/adminLayout";
import { PostEditor } from "@/src/components/admin/post/PostEditor";

export default function Page() {
  return (
    <AdminLayout>
      <PostEditor mode="create" />
    </AdminLayout>
  );
}
