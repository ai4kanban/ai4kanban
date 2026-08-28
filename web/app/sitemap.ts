import type { MetadataRoute } from "next";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { recipes } from "@/components/recipes/recipes-content";
import { getAllPosts, postPath } from "@/lib/blog";
import { getLegalDocs } from "@/lib/legal";
import { BASE_URL } from "@/lib/site";
import { LOCALES, TRANSLATED_PATHS, localePath } from "@/lib/i18n";

// Required for `output: export` — emit sitemap.xml at build time.
export const dynamic = "force-static";

// Recipe routes: the index plus one page per card in the catalog.
function recipeRoutes(): string[] {
  return ["/recipes", ...recipes.map((r) => `/recipes/${r.slug}`)];
}

// The Markdown mirrors (`/index.md`, `/vs-x.md`, one card per recipe) are not
// listed. A sitemap is for indexable pages, and each mirror is a duplicate of a
// page already here; `llms.txt` is where crawlers find them.

// `<lastmod>` is the only one of the three optional sitemap hints Google still
// reads — it ignores `<changefreq>` and `<priority>`. A static export has no
// useful file mtime (a fresh clone stamps every file with the checkout time),
// so the honest source is git: the newest commit that touched any file owning
// the route's content.
const lastModCache = new Map<string, string | undefined>();

function gitLastModified(...paths: string[]): Date | undefined {
  const existing = paths.filter((p) => fs.existsSync(path.join(process.cwd(), p)));
  if (existing.length === 0) return undefined;

  const key = existing.join("\0");
  if (!lastModCache.has(key)) {
    let iso: string | undefined;
    try {
      iso =
        execFileSync("git", ["log", "-1", "--format=%cI", "--", ...existing], {
          cwd: process.cwd(),
          encoding: "utf8",
          stdio: ["ignore", "pipe", "ignore"],
        }).trim() || undefined;
    } catch {
      // No git history available (shallow clone, tarball build) — omit the hint
      // rather than inventing a date.
      iso = undefined;
    }
    lastModCache.set(key, iso);
  }

  const iso = lastModCache.get(key);
  return iso ? new Date(iso) : undefined;
}

// The files that own a route's rendered content. Route slugs already match
// their component and copy directories (`""` → `components/home` and
// `i18n/home`, `/vs-x` → `components/vs-x` and `i18n/vs-x`), so this is derived
// rather than a hand-kept table that drifts as pages are added. Recipes have no
// copy folder — a path git doesn't know just drops out of the log.
function routeSources(route: string, locale: string): string[] {
  const slug = route === "" ? "home" : route.slice(1).split("/")[0];
  const page = route === "" ? "app/(en)/page.tsx" : `app/(en)${route}/page.tsx`;
  return [`components/${slug}`, page, `i18n/${slug}/${locale}.ts`];
}

export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [];

  // Every translated route: one entry per language. The hreflang set is not
  // repeated here — each page's `<head>` already carries it (`lib/metadata.ts`),
  // which is the signal Google reads either way. Declaring it in both places
  // would cost validity: the sitemaps.org schema orders `<url>` as
  // `loc, lastmod, changefreq, priority` and only then the extension wildcard,
  // but Next's serializer emits `alternates` as `<xhtml:link>` directly after
  // `<loc>` — ahead of `<lastmod>` — and the element order is not ours to set.
  for (const route of TRANSLATED_PATHS) {
    for (const locale of LOCALES) {
      entries.push({
        url: `${BASE_URL}${localePath(locale, route)}`,
        lastModified: gitLastModified(...routeSources(route, locale)),
      });
    }
  }

  // The Cloud page, English-only and a route of its own — one page, so it is
  // pushed here by hand rather than derived from a list.
  entries.push({
    url: `${BASE_URL}/cloud`,
    lastModified: gitLastModified(...routeSources("/cloud", "en")),
  });

  // The recipes, which are English-only. A recipe page comes out of the catalog
  // and its art.
  for (const route of recipeRoutes()) {
    entries.push({
      url: `${BASE_URL}${route}`,
      lastModified: gitLastModified(...routeSources(route, "en")),
    });
  }

  // The blog, English-only too. These are the one set of routes whose `lastmod`
  // doesn't come from git: a post carries the date it was published and the
  // date it was edited in its own frontmatter, and that is the author saying
  // the text changed — where a commit may only have moved the file. The index
  // is as new as the newest post on it.
  const posts = getAllPosts();
  const postDate = (p: (typeof posts)[number]) =>
    new Date(p.updatedAt ?? p.publishedAt);

  entries.push({
    url: `${BASE_URL}/blog`,
    lastModified: posts.length
      ? new Date(Math.max(...posts.map((p) => postDate(p).getTime())))
      : undefined,
  });
  for (const post of posts) {
    entries.push({
      url: `${BASE_URL}${postPath(post)}`,
      lastModified: postDate(post),
    });
  }

  // The privacy and terms pages, English-only like the blog. Their `lastmod` is
  // the effective date on the page: on a legal page that date *is* the claim
  // that the text changed, and it is the one a reader is told to check.
  for (const doc of getLegalDocs()) {
    entries.push({
      url: `${BASE_URL}${doc.path}`,
      lastModified: new Date(doc.effective),
    });
  }

  return entries;
}
