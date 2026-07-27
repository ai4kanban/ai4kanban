import type { MetadataRoute } from "next";
import fs from "node:fs";
import path from "node:path";
import { recipes } from "@/components/recipes/recipes-content";
import { BASE_URL } from "@/lib/site";
import {
  LOCALES,
  LOCALE_TAGS,
  TRANSLATED_PATHS,
  localePath,
} from "@/lib/i18n";

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

// Markdown mirrors of the landing routes — a plain-Markdown twin of each page,
// served as a static file from `public/` (`/` → `/index.md`, `/vs-x` →
// `/vs-x.md`). Listed so AI crawlers and llms.txt consumers can discover them.
// English only, like the recipes.
function markdownMirrors(): string[] {
  return ["/index.md", ...vsRoutes().map((r) => `${r}.md`)];
}

export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [];

  // The four translated routes: one entry per language, each declaring the
  // whole set as its `alternates` so a crawler finds every language from any
  // one URL.
  const alternates = (route: string) =>
    Object.fromEntries(
      LOCALES.map((l) => [
        LOCALE_TAGS[l],
        `${BASE_URL}${localePath(l, route)}`,
      ]),
    );

  for (const route of TRANSLATED_PATHS) {
    for (const locale of LOCALES) {
      entries.push({
        url: `${BASE_URL}${localePath(locale, route)}`,
        changeFrequency: "monthly",
        priority: route === "" ? 1 : 0.8,
        alternates: { languages: alternates(route) },
      });
    }
  }

  // English-only surfaces: the recipes and the Markdown mirrors.
  for (const route of [...recipeRoutes(), ...markdownMirrors()]) {
    entries.push({
      url: `${BASE_URL}${route}`,
      changeFrequency: "monthly",
      priority: 0.8,
    });
  }

  return entries;
}
