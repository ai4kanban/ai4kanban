// Types for ./yaml.mjs, which is copied from skill/lib/ and carries none of its
// own (see scripts/sync-format.mjs). Hand-written and NOT overwritten by the
// sync — a new export there needs a new line here before the UI can see it.

/** One value as the frontmatter writes it — quoted only when leaving it plain
 *  could confuse a YAML reader. */
export declare function yamlScalar(input: unknown): string;

/** One value as the frontmatter reads it: the quotes taken back off, or the text
 *  as-is when it carries none. */
export declare function unquote(v: string): string;
