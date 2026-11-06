import { redirect } from "next/navigation";
import { AdminLoginPage } from "@/src/components/admin/auth/LoginPage";
import { getAdminSession } from "@/src/lib/session";

export default async function Page() {
  if (await getAdminSession()) {
    redirect("/admin");
  }
  return <AdminLoginPage />;
}
