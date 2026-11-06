import { redirect } from 'next/navigation';
import { AdminLayout } from '@/src/components/admin/adminLayout';
import { getAdminSession } from '@/src/lib/session';

/* Every signed-in admin screen shares this layout, so the sidebar and top bar mount once and
   stay mounted while you move between screens. The session is checked here on the server
   (signature and expiry, no database read) instead of by a client request behind a spinner. */
export default async function AdminShellLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession();
  if (!session) {
    redirect('/admin/login');
  }

  return <AdminLayout>{children}</AdminLayout>;
}
