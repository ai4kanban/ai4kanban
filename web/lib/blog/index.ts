// The blog's public API. The routes import from here, never from the files
// beside it, so the inside can be rearranged without rewiring a page.

export {
  AUTHOR,
  BLOG_CATEGORIES,
  getCategory,
  isCategorySlug,
  type BlogCategory,
  type BlogCategorySlug,
  type BlogPost,
} from "./types";

export { getAllPosts, getPost, getRoutablePosts } from "./loader";
export { extractToc, type TocItem } from "./toc";

import { getCategory, type BlogPost } from "./types";

/** The route a post is published at. */
export function postPath(post: BlogPost): string {
  return `/blog/${post.slug}`;
}

/** The category a post is filed under first — the one the card shows. */
export function primaryCategory(post: BlogPost) {
  return getCategory(post.categories[0]);
}

// UTC, so the date a post shows is the date its frontmatter names — a build on
// a machine an hour west of the author must not publish it a day early.
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}
