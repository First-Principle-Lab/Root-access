import { contentTypeFor } from '@/src/components/admin/contentTypes';
import { cn } from '@/src/lib/cn';

/* Content-type badge (checkpoint 4 of docs/admin-redesign-plan.md). The icon, the label and
   the one-line description now live in one table (src/components/admin/contentTypes.ts), so
   the badge a post row shows and the badge the editor header shows cannot drift apart again.
   Mirrors `.admin-type` in docs/admin-redesign/mockups/admin-mock.css:187. */
interface ContentTypeBadgeProps {
  displayStyle: string | null | undefined;
  /** Adds the "Full article with content" style sentence, for the editor header. */
  showDescription?: boolean;
  className?: string;
}

export function ContentTypeBadge({
  className,
  displayStyle,
  showDescription = false,
}: ContentTypeBadgeProps): React.ReactElement {
  const type = contentTypeFor(displayStyle);
  const TypeIcon = type.icon;

  return (
    <span
      className={cn(
        'inline-flex flex-wrap items-center gap-[5px] text-[length:var(--admin-text-micro)] text-[color:var(--admin-subtle)]',
        className,
      )}
      data-content-type={type.key}
    >
      <TypeIcon aria-hidden="true" className="size-4 shrink-0" />
      <span className="font-medium text-[color:var(--admin-muted)]">{type.label}</span>
      {showDescription && <span>· {type.description}</span>}
    </span>
  );
}
