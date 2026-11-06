import './admin.css';

export default function AdminRouteLayout({ children }: { children: React.ReactNode }) {
  return <div className="admin-shell">{children}</div>;
}
