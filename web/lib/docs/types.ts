// What a documentation page is.
//
// One page is one `.mdx` file in `web/content/docs/`, and the filename is the slug —
// `web/content/docs/daily-loop.mdx` is `/docs/daily-loop`. `index.mdx` is the section's
// landing page and is served at `/docs` itself, never at `/docs/index`.
//
// Where a page sits in the rail — which group it is under, and in what order —
// is deliberately *not* frontmatter. It lives in one catalog, `web/content/docs/_nav.json`,
// so reordering the section is one edit to one list instead of renumbering a
// field across every file.

export type DocPage = {
  /** The filename, which is also the last segment of the URL. */
  slug: string;
  /** The on-page H1. */
  title: string;
  /** Optional SERP `<title>`, when the H1 is not what a result should read. */
  titleTag?: string;
  /** The meta description, and the blurb the index card shows. */
  description: string;
  /** The sentence under the H1. */
  lead: string;
  /** As written, e.g. "September 1, 2026" — a date a reader checks, not a sort key. */
  lastUpdated: string;
  /** The rail's link text. Defaults to the title when the file omits it. */
  navLabel: string;
  /** An icon name from `components/docs/doc-icons.ts`. */
  icon?: string;
  /** The rail heading this page sits under. Comes from `_nav.json`. */
  group: string;
  /** Flat position across the whole section, ascending. Comes from `_nav.json`. */
  order: number;
  /** The MDX body, frontmatter already stripped. */
  body: string;
};

/** A labelled block of links in the rail. */
export type DocNavGroup = {
  label: string;
  items: { label: string; href: string; icon?: string }[];
};
