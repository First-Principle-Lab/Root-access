import { EnvelopeSimpleIcon, InstagramLogoIcon, LinkedinLogoIcon, XLogoIcon } from '@phosphor-icons/react/ssr';
import { GitHubMarkIcon } from './GitHubMarkIcon';
import { resolveGithubUrl } from '@/src/lib/githubLink';

export interface SocialProfile {
  email?: string | null;
  xLink?: string | null;
  linkedinLink?: string | null;
  instagramLink?: string | null;
  githubLink?: string | null;
}

export function SocialLinks({ profile, compact = false }: { profile: SocialProfile; compact?: boolean }) {
  const links = [
    profile.email && { label: 'Email', href: `mailto:${profile.email}`, icon: EnvelopeSimpleIcon, external: false },
    profile.xLink && { label: 'X', href: profile.xLink, icon: XLogoIcon, external: true },
    profile.linkedinLink && { label: 'LinkedIn', href: profile.linkedinLink, icon: LinkedinLogoIcon, external: true },
    { label: 'GitHub', href: resolveGithubUrl(profile), icon: GitHubMarkIcon, external: true },
    profile.instagramLink && { label: 'Instagram', href: profile.instagramLink, icon: InstagramLogoIcon, external: true },
  ].filter((link): link is Exclude<typeof link, null | undefined | ''> => Boolean(link));

  return <div className={`site-social-links${compact ? ' is-compact' : ''}`}>
    {links.map(({ label, href, icon: Icon, external }) =>
      <a key={label} href={href} aria-label={compact ? label : undefined} title={compact ? label : undefined} target={external ? '_blank' : undefined} rel={external ? 'noopener noreferrer' : undefined}>
        <Icon size={18} aria-hidden="true" />
        <span>{label}</span>
      </a>
    )}
  </div>;
}
