import { AuthProvider } from '@/src/contexts/authContext';
import './admin.css';

export default function AdminRouteLayout({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
