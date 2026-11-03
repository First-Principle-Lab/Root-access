import Link from 'next/link';
import Image from 'next/image';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { GenerativeBackground } from './GenerativeBackground';
import { SocialLinks } from './SocialLinks';
import { ProjectLogo } from './ProjectLogo';
import { orderCategories, orderSections } from '@/src/lib/siteOrder';

interface Profile {
  id: string;
  bio: string | null;
  xLink: string | null;
  instagramLink: string | null;
  linkedinLink: string | null;
  email: string | null;
  resumeUrl: string | null;
  profilePicture: string | null;
}

interface Subsection {
  id: string;
  name: string;
  slug: string;
  icon: string;
  postCount: number;
  topCategory: { name: string };
}

interface ProjectLink {
  title: string;
  slug: string;
  projectLink: string | null;
  coverImage: string | null;
}

export function HomeContent({ profile, subsections, name, projects }: { profile: Profile | null; subsections: Subsection[]; name: string; projects: ProjectLink[] }) {
  const [intro, ...body] = (profile?.bio || '').split(/\n\s*\n/);
  const groups = subsections.reduce((acc, subsection) => {
    (acc[subsection.topCategory.name] ??= []).push(subsection);
    return acc;
  }, {} as Record<string, Subsection[]>);
  const orderedGroups = orderCategories(Object.keys(groups).map((name) => ({ name })))
    .map(({ name }) => [name, orderSections(groups[name])] as const);

  return (
    <div className="site-container home-page">
      <GenerativeBackground />
      <h1 className="site-title">{name}</h1>
      {profile && <div className="home-affiliation">
        <span>Founding engineer at</span>
        <a href="https://codemate.ai/" target="_blank" rel="noopener noreferrer"><Image src="/brands/codemate.ico" width={17} height={17} alt="" unoptimized /> CodeMate AI</a>
      </div>}
      <div className="site-prose home-bio">
        {profile?.bio ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{intro}</ReactMarkdown> : <p>Welcome! Configure your profile in the admin panel.</p>}
      </div>
      {body.length > 0 && <div className="site-prose home-bio-rest"><ReactMarkdown remarkPlugins={[remarkGfm]}>{body.join('\n\n')}</ReactMarkdown></div>}

      {projects.length > 0 && <div className="home-projects" aria-label="Projects">
        <span className="home-projects-label">Created</span>
        <div className="home-project-links">{projects.map((project) => {
          return project.projectLink
            ? <a key={project.slug} href={project.projectLink} target="_blank" rel="noopener noreferrer"><ProjectLogo image={project.coverImage} compact />{project.title}</a>
            : <span key={project.slug}><ProjectLogo image={project.coverImage} compact />{project.title}</span>;
        })}</div>
      </div>}

      {subsections.length > 0 && (
        <section className="home-index" aria-labelledby="explore-heading">
          <h2 id="explore-heading" className="site-section-heading">Explore</h2>
          {orderedGroups.map(([category, items]) => (
            <div className="home-index-group" key={category}>
              <h3>{category}</h3>
              <ul>
                {items.map((item) => (
                  <li key={item.id}>
                    <Link href={`/${item.slug}`}>
                      <span>{item.name}</span>
                      <span className="home-index-count">{item.postCount} {item.postCount === 1 ? 'entry' : 'entries'}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}

      {profile && (
        <section className="home-contact" aria-labelledby="contact-heading">
          <h2 id="contact-heading" className="site-section-heading">Find me on</h2>
          <SocialLinks profile={profile} />
        </section>
      )}
    </div>
  );
}
