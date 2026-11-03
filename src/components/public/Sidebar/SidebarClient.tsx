'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { SocialLinks } from '../SocialLinks';
import { orderSections } from '@/src/lib/siteOrder';
import { ThemeToggleButton } from '@/src/components/spaceui/theme-toggle';

interface LayoutData {
  admin: {
    name: string;
    profile: {
      xLink: string | null;
      instagramLink: string | null;
      linkedinLink: string | null;
      email: string | null;
      resumeUrl: string | null;
      profilePicture: string | null;
    } | null;
  };
  sections: Array<{
    id: string;
    name: string;
    isVisible: boolean;
    subsections: Array<{ id: string; name: string; slug: string; icon: string; postCount: number }>;
  }>;
}

export function SidebarClient({ layoutData }: { layoutData: LayoutData }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const profile = layoutData.admin.profile;
  const avatarSrc = profile?.profilePicture?.startsWith('https://res.cloudinary.com/')
    ? profile.profilePicture.replace('/image/upload/', '/image/upload/f_auto,q_auto,c_fill,w_96,h_96/')
    : profile?.profilePicture;
  const links = orderSections(layoutData.sections.flatMap((section) => section.subsections));

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link href="/" className="site-brand" aria-label={`${layoutData.admin.name}, home`}>
          {avatarSrc && <Image src={avatarSrc} alt="" width={36} height={36} unoptimized />}
          <span>{layoutData.admin.name}</span>
        </Link>

        <button className="site-menu-button" type="button" aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen} aria-controls="site-navigation" onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? 'Close' : 'Menu'}
        </button>

        <nav id="site-navigation" className={`site-navigation ${menuOpen ? 'is-open' : ''}`} aria-label="Main navigation">
          <Link href="/" onClick={() => setMenuOpen(false)} aria-current={pathname === '/' ? 'page' : undefined}>Home</Link>
          {links.map((link) => (
            <Link key={link.id} href={`/${link.slug}`} onClick={() => setMenuOpen(false)} aria-current={pathname === `/${link.slug}` || pathname.startsWith(`/${link.slug}/`) ? 'page' : undefined}>{link.name}</Link>
          ))}
          {profile?.resumeUrl && <a href={profile.resumeUrl} target="_blank" rel="noopener noreferrer">Resume <span aria-hidden="true">↗</span></a>}
          {profile && <div className="site-desktop-socials"><SocialLinks profile={profile} compact /></div>}
          <ThemeToggleButton className="site-theme-button" buttonVariant="ghost" size="md" title="Toggle color scheme" />
          <div className="site-mobile-socials">
            {profile && <SocialLinks profile={profile} />}
          </div>
        </nav>
      </div>
    </header>
  );
}
