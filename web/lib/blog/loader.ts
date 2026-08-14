import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import {
  isCategorySlug,
  type BlogCategorySlug,
  type BlogPost,
} from "./types";

// Reads `web/blogs/*.mdx` at build time. Server-only by construction — it
// touches the filesystem, so it can only ever be imported by a server component
// (the two blog routes) and the sitemap.
//
// A malformed post *fails the build* rather than being skipped. A post is a
// committed file that someone is about to announce, and a warning in a build
// log is not where they will find out that a typo in `date:` unpublished it.
//
// The frontmatter a post carries:
//
//   ---
//   title: "How the board plans itself"     # the on-page H1
//   title_tag: "How an AI kanban board..."  # optional SERP <title>; falls back to title
//   dek: "One sentence under the headline."
//   excerpt: "The line the index card shows, and the meta description."
//   date: 2026-08-14                        # ISO 8601, the publish date
//   updated: 2026-08-20                     # optional, ISO 8601
//   categories: ["board"]                   # slugs from BLOG_CATEGORIES
//   tags: ["kanban", "claude-code"]         # optional, free text
//   featured_image: "https://cdn.ai4kanban.dev/blog-x-v1.jpg"   # optional
//   featured_image_alt: "..."               # optional, required with the image
//   read_minutes: 6                         # optional — counted from the body
//   draft: true                             # optional — see below
//   seo:
//     description: "..."                    # optional, falls back to excerpt
//   ---
//
// A draft gets its page built but is published nowhere: it is off the index,
// out of the sitemap, and carries `noindex`, so the only way to it is the URL
// you send someone. It is still *built* — and that is not a nicety, it is what
// keeps the blog able to have no posts at all. `output: export` refuses a
// dynamic route that resolves to zero pages, so if drafts vanished at build
// time a site with nothing published yet would not compile.

const BLOGS_DIR = path.join(process.cwd(), "blogs");

// 220 words a minute, the middle of the range for adult reading on a screen,
// and never less than a minute — "0 min read" reads as a bug, not as brevity.
const WORDS_PER_MINUTE = 220;

function fail(file: string, reason: string): never {
  throw new Error(`[blog] ${file}: ${reason}`);
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== ""
    ? value.trim()
    : undefined;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is string => typeof v === "string" && v.trim() !== "")
    .map((v) => v.trim());
}

// gray-matter hands back a Date for an unquoted YAML date and a string for a
// quoted one. Both are fine to write; both come out of here as one ISO instant.
function asIsoDate(value: unknown): string | undefined {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value.toISOString();
  }
  const raw = asString(value);
  if (!raw) return undefined;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

function countReadMinutes(body: string): number {
  const words = body
    .replace(/```[\s\S]*?```/g, " ") // a code block is not read word by word
    .replace(/<[^>]+>/g, " ") // JSX/HTML tags
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

function parsePost(slug: string, file: string): BlogPost {
  const parsed = matter(fs.readFileSync(file, "utf8"));
  const data = parsed.data as Record<string, unknown>;
  const name = path.basename(file);

  const title = asString(data.title) ?? fail(name, "`title` is required");
  const dek = asString(data.dek) ?? fail(name, "`dek` is required");
  const excerpt = asString(data.excerpt) ?? fail(name, "`excerpt` is required");

  const publishedAt =
    asIsoDate(data.date) ?? fail(name, "`date` must be an ISO 8601 date");
  const updatedAt = data.updated === undefined ? undefined : asIsoDate(data.updated);
  if (data.updated !== undefined && !updatedAt) {
    fail(name, "`updated` must be an ISO 8601 date");
  }

  const categories = asStringArray(data.categories).filter(
    (c): c is BlogCategorySlug => {
      if (!isCategorySlug(c)) {
        fail(name, `"${c}" is not a category in lib/blog/types.ts`);
      }
      return true;
    },
  );
  if (categories.length === 0) {
    fail(name, "`categories` must name at least one category");
  }

  const featuredImage = asString(data.featured_image);
  const featuredImageAlt = asString(data.featured_image_alt);
  // Alt text is not optional on an image the index page renders. An empty alt
  // is right for decoration; a post's cover is not decoration.
  if (featuredImage && !featuredImageAlt) {
    fail(name, "`featured_image` needs a `featured_image_alt`");
  }

  const override = typeof data.read_minutes === "number" ? data.read_minutes : 0;
  const seo = data.seo as Record<string, unknown> | undefined;

  return {
    slug,
    draft: data.draft === true,
    title,
    titleTag: asString(data.title_tag),
    dek,
    excerpt,
    publishedAt,
    updatedAt,
    categories,
    tags: asStringArray(data.tags),
    featuredImage,
    featuredImageAlt,
    seoDescription: asString(seo?.description) ?? excerpt,
    readMinutes: override > 0 ? Math.round(override) : countReadMinutes(parsed.content),
    body: parsed.content,
  };
}

// One read per build. `next build` renders the index, every post page and the
// sitemap in the same process, and each of them asks for the whole list. In
// `next dev` the cache is skipped, so editing a post shows up on reload.
let cache: BlogPost[] | null = null;

function loadAll(): BlogPost[] {
  if (cache && process.env.NODE_ENV === "production") return cache;
  if (!fs.existsSync(BLOGS_DIR)) return (cache = []);

  const posts: BlogPost[] = [];
  for (const name of fs.readdirSync(BLOGS_DIR)) {
    if (!name.endsWith(".mdx")) continue;
    posts.push(parsePost(name.slice(0, -".mdx".length), path.join(BLOGS_DIR, name)));
  }

  // Newest first — the index is a reverse-chronological list, and the first
  // entry is what the page features.
  posts.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  return (cache = posts);
}

/** Every post with a page: the published ones and the drafts. */
export function getRoutablePosts(): BlogPost[] {
  return loadAll();
}

/** What is actually published — the index and the sitemap read this. */
export function getAllPosts(): BlogPost[] {
  return loadAll().filter((p) => !p.draft);
}

export function getPost(slug: string): BlogPost | undefined {
  return loadAll().find((p) => p.slug === slug);
}
