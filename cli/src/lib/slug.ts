/** A card's filename slug: ASCII words of `s`, or `task` when it has none. */
export function slugify(s: unknown): string {
  const out = String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '')
  return out || 'task'
}
