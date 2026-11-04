import { AuthProvider } from '@/src/contexts/authContext';

export default function AdminRouteLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <div className="admin-shell">{children}</div>
    </AuthProvider>
  );
}
