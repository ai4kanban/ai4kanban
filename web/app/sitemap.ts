import type { MetadataRoute } from "next";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { recipes } from "@/components/recipes/recipes-content";
import { BASE_URL } from "@/lib/site";
import { LOCALES, TRANSLATED_PATHS, localePath } from "@/lib/i18n";

// Required for `output: export` — emit sitemap.xml at build time.
export const dynamic = "force-static";

// Discover every comparison route by scanning the English route group for
// `vs-*` directories that hold a `page.tsx`. New comparison pages are picked up
// automatically at build time — e.g. `app/(en)/vs-linear/page.tsx` →
// `/vs-linear`.
function vsRoutes(): string[] {
  const appDir = path.join(process.cwd(), "app", "(en)");
  const routes: string[] = [];

  for (const entry of fs.readdirSync(appDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.startsWith("vs-")) continue;
    if (fs.existsSync(path.join(appDir, entry.name, "page.tsx"))) {
      routes.push(`/${entry.name}`);
    }
  }

  return routes;
}

// Recipe routes: the index plus one page per card in the catalog.
function recipeRoutes(): string[] {
  return ["/recipes", ...recipes.map((r) => `/recipes/${r.slug}`)];
}

// Markdown mirrors — a plain-Markdown twin of each page, served as a static
// file from `public/` (`/` → `/index.md`, `/vs-x` → `/vs-x.md`, and one card
// per recipe). Listed so AI crawlers and llms.txt consumers can discover them.
// English only, like the recipes.
function markdownMirrors(): string[] {
  return [
    "/index.md",
    ...vsRoutes().map((r) => `${r}.md`),
    ...recipes.map((r) => `/recipes/${r.slug}.md`),
  ];
}

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
// their component directory (`""` → `components/home`, `/vs-x` →
// `components/vs-x`, `/recipes` → `components/recipes`), so this is derived
// rather than a hand-kept table that drifts as pages are added.
function routeSources(route: string, locale: string): string[] {
  const slug = route === "" ? "home" : route.slice(1).split("/")[0];
  const page = route === "" ? "app/(en)/page.tsx" : `app/(en)${route}/page.tsx`;
  return [`components/${slug}`, page, `i18n/${locale}.ts`];
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

  // English-only surfaces: the recipes and the Markdown mirrors. A mirror is a
  // checked-in file, so it dates itself; a recipe page comes out of the
  // catalog and its art.
  for (const route of recipeRoutes()) {
    entries.push({
      url: `${BASE_URL}${route}`,
      lastModified: gitLastModified(...routeSources(route, "en")),
    });
  }

  for (const route of markdownMirrors()) {
    entries.push({
      url: `${BASE_URL}${route}`,
      lastModified: gitLastModified(`public${route}`),
    });
  }

  return entries;
}
