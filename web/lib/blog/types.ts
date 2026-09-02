// What a post is.
//
// One post is one `.mdx` file in `web/content/blogs/`, and the filename is the
// slug — `web/content/blogs/how-the-board-plans.mdx` is
// `/blog/how-the-board-plans`. There is no database and no CMS: the post is a
// file in the repo, so it reviews like code and ships with the deploy that
// built it.
//
// The frontmatter is the WordPress-export shape (title, excerpt, date,
// categories, tags, featured_image, seo.description), which is what the sibling
// site at dist0.com writes too — so a post can move between the two, or be
// pushed to a CMS later, without being reshaped. The file is snake_case and
// this side is camelCase; `loader.ts` is the only place that maps between them.

/** The one author. A post never names one — every post here is written by us. */
export const AUTHOR = {
  name: "Tao Wu",
  role: "Builder of AI4Kanban",
} as const;

// The topics a post can be filed under. A category is a *label* on the card and
// on the post — there is no per-category page and no filter, because a static
// export has no query string to filter on and four half-empty index pages are
// worse than none. Add a slug here before a post can use it; the loader rejects
// anything else rather than inventing a topic silently.
export const BLOG_CATEGORIES = [
  { slug: "board", label: "The board" },
  { slug: "agents", label: "Coding agents" },
  { slug: "workflow", label: "Workflow" },
  { slug: "releases", label: "Releases" },
] as const;

export type BlogCategory = (typeof BLOG_CATEGORIES)[number];
export type BlogCategorySlug = BlogCategory["slug"];

const CATEGORY_INDEX = new Map<string, BlogCategory>(
  BLOG_CATEGORIES.map((c) => [c.slug, c]),
);

export function isCategorySlug(value: unknown): value is BlogCategorySlug {
  return typeof value === "string" && CATEGORY_INDEX.has(value);
}

export function getCategory(slug: string): BlogCategory | undefined {
  return CATEGORY_INDEX.get(slug);
}

export type BlogPost = {
  /** The filename, which is also the last segment of the URL. */
  slug: string;
  /**
   * Written but not announced. The page is built — see `loader.ts` for why it
   * has to be — but it is off the index, out of the sitemap, and `noindex`.
   */
  draft: boolean;
  /** The on-page H1. */
  title: string;
  /** Optional SERP `<title>`, when the H1 is not what a result should read. */
  titleTag?: string;
  /** The subhead under the H1 — one sentence, on the page. */
  dek: string;
  /** The line the index card shows. Also the fallback meta description. */
  excerpt: string;
  publishedAt: string;
  updatedAt?: string;
  categories: BlogCategorySlug[];
  tags: string[];
  /** An absolute CDN URL — the site keeps its large images off `public/`. */
  featuredImage?: string;
  featuredImageAlt?: string;
  seoDescription: string;
  /** Counted from the body, unless the file overrides it. */
  readMinutes: number;
  /** The MDX body, frontmatter already stripped. */
  body: string;
};
