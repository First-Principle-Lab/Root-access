/**
 * Generate a URL-friendly slug from a string
 * @param text - The text to convert to a slug
 * @returns URL-friendly slug
 */
export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-')      // Replace spaces with hyphens
    .replace(/--+/g, '-')      // Replace multiple hyphens with single
    .trim();
}

/**
 * Calculate estimated reading time based on word count
 * @param content - The content to analyze
 * @param wordsPerMinute - Average reading speed (default: 200)
 * @returns Estimated reading time in minutes
 */
export function calculateReadTime(content: string, wordsPerMinute: number = 200): number {
  const wordCount = content.split(/\s+/).filter(word => word.length > 0).length;
  return Math.ceil(wordCount / wordsPerMinute);
}

/**
 * Handle tag creation/retrieval for posts
 * Always stores tags in UPPERCASE for consistency
 * @param tags - Array of tag names (case-insensitive input)
 * @param prisma - Prisma client instance
 * @returns Array of tag connection objects
 */
export async function handleTags(tags: string[], prisma: any): Promise<{ id: string }[]> {
  if (!tags || tags.length === 0) {
    return [];
  }

  // Uppercase, trimmed and de-duplicated, so "rust, Rust" is one tag.
  const wanted = new Map<string, string>();
  for (const tagName of tags) {
    const upperTagName = tagName.trim().toUpperCase();
    if (upperTagName) wanted.set(generateSlug(upperTagName), upperTagName);
  }
  if (wanted.size === 0) {
    return [];
  }

  // Two round trips however many tags there are: create the missing ones, then read them all
  // back. A tag that already exists under the same name keeps its row.
  await prisma.tag.createMany({
    data: [...wanted].map(([slug, name]) => ({ name, slug })),
    skipDuplicates: true,
  });

  const rows: { id: string }[] = await prisma.tag.findMany({
    where: {
      OR: [{ slug: { in: [...wanted.keys()] } }, { name: { in: [...wanted.values()] } }],
    },
    select: { id: true },
  });

  return rows.map(({ id }) => ({ id }));
}
/**
 * Generate excerpt from content if not provided
 * @param content - The full content
 * @param excerpt - Optional existing excerpt
 * @param maxLength - Maximum excerpt length (default: 150)
 * @returns Excerpt string
 */
export function generateExcerpt(content: string, excerpt?: string, maxLength: number = 150): string {
  if (excerpt) {
    return excerpt;
  }
  
  // Remove markdown formatting for cleaner excerpt
  const plainText = content
    .replace(/#{1,6}\s/g, '') // Remove headers
    .replace(/\*\*|__/g, '')  // Remove bold
    .replace(/\*|_/g, '')     // Remove italic
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1') // Remove links, keep text
    .trim();
  
  if (plainText.length <= maxLength) {
    return plainText;
  }
  
  return plainText.substring(0, maxLength).trim() + "...";
}