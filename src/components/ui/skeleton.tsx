import { cn } from '@/src/lib/cn';

/* Placeholder in the shape of the content that is coming, so nothing jumps when it arrives. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn('admin-skeleton block rounded-[4px] bg-[color:var(--admin-surface-2)]', className)}
    />
  );
}
