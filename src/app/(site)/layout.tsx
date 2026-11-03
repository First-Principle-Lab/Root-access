import { Suspense } from 'react';
import Link from 'next/link';
import { PublicSidebarServer } from '@/src/components/public/Sidebar/SidebarServer';

export const revalidate = 60;

export default function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="site-shell">
      <a className="site-skip-link" href="#main-content">Skip to content</a>
      <Suspense fallback={<SidebarSkeleton />}>
        <PublicSidebarServer />
      </Suspense>
      {children}
    </div>
  );
}

function SidebarSkeleton() {
  return (
    <header className="site-header"><div className="site-header-inner"><Link className="site-brand" href="/">Parth Thirwani</Link></div></header>
  );
}
