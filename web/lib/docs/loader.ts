import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import type { DocNavGroup, DocPage } from "./types";

// Reads `web/content/docs/*.mdx` and its `_nav.json` at build time. Server-only
// by construction — it touches the filesystem, so only a server component (the
// two docs routes) and the sitemap can ever import it.
//
// A malformed page *fails the build*, the same discipline `lib/blog/loader.ts`
// keeps and for the same reason: a doc is a committed file someone is about to
// link to, and a warning in a build log is not where they find out that a typo
// in `title:` dropped the page.
//
// The frontmatter a page carries:
//
//   ---
//   title: "The daily loop"                 # the on-page H1
//   title_tag: "The AI4Kanban daily loop"   # optional SERP <title>
//   description: "..."                      # meta description + index blurb
//   lead: "One sentence under the headline."
//   last_updated: "September 1, 2026"
//   nav_label: "Daily loop"                 # optional; defaults to the title
//   icon: "repeat"                          # optional; components/docs/doc-icons.ts
//   ---
//
// Group and order are not here — they are in `_nav.json`. See `types.ts`.

const DOCS_DIR = path.join(process.cwd(), "content", "docs");
const NAV_FILE = path.join(DOCS_DIR, "_nav.json");

/** The landing page, served at `/docs` rather than `/docs/index`. */
export const INDEX_SLUG = "index";

function fail(where: string, reason: string): never {
  throw new Error(`[docs] ${where}: ${reason}`);
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== ""
    ? value.trim()
    : undefined;
}

// `_nav.json` is an ordered list of groups, each an ordered list of slugs. A
// page's sort position is its flat index across every group, so the groups stay
// contiguous and render in the order they are listed.
type Catalog = {
  labels: string[];
  groupOf: Map<string, string>;
  orderOf: Map<string, number>;
};

function loadCatalog(): Catalog {
  let parsed: { groups?: { label?: unknown; items?: unknown }[] };
  try {
    parsed = JSON.parse(fs.readFileSync(NAV_FILE, "utf8"));
  } catch (error) {
    fail("_nav.json", (error as Error).message);
  }

  const labels: string[] = [];
  const groupOf = new Map<string, string>();
  const orderOf = new Map<string, number>();
  let position = 0;

  for (const group of parsed.groups ?? []) {
    const label = asString(group.label);
    if (!label) fail("_nav.json", "every group needs a non-empty `label`");
    labels.push(label);
    for (const slug of Array.isArray(group.items) ? group.items : []) {
      if (typeof slug !== "string") {
        fail("_nav.json", `group "${label}" lists a non-string item`);
      }
      if (orderOf.has(slug)) fail("_nav.json", `"${slug}" is listed twice`);
      groupOf.set(slug, label);
      orderOf.set(slug, position++);
    }
  }

  if (!orderOf.has(INDEX_SLUG)) {
    fail("_nav.json", `"${INDEX_SLUG}" must be listed — it is the /docs page`);
  }
  return { labels, groupOf, orderOf };
}

function parseDoc(slug: string, file: string, catalog: Catalog): DocPage {
  const name = path.basename(file);
  const parsed = matter(fs.readFileSync(file, "utf8"));
  const data = parsed.data as Record<string, unknown>;

  const title = asString(data.title) ?? fail(name, "`title` is required");
  const description =
    asString(data.description) ?? fail(name, "`description` is required");
  const lead = asString(data.lead) ?? fail(name, "`lead` is required");
  const lastUpdated =
    asString(data.last_updated) ?? fail(name, "`last_updated` is required");

  // A page missing from the catalog would resolve by URL but appear in no rail,
  // which is a page nobody can find. That is a build error, not a warning.
  const order = catalog.orderOf.get(slug);
  if (order === undefined) fail(name, "not listed in _nav.json");

  return {
    slug,
    title,
    titleTag: asString(data.title_tag),
    description,
    lead,
    lastUpdated,
    navLabel: asString(data.nav_label) ?? title,
    icon: asString(data.icon),
    group: catalog.groupOf.get(slug) as string,
    order,
    body: parsed.content,
  };
}

// One read per build. `next build` renders the index, every doc page and the
// sitemap in the same process, and each of them asks for the whole list. In
// `next dev` the cache is skipped, so editing a page shows up on reload.
let cache: DocPage[] | null = null;

function loadAll(): DocPage[] {
  if (cache && process.env.NODE_ENV === "production") return cache;

  const catalog = loadCatalog();
  const docs: DocPage[] = [];
  for (const name of fs.readdirSync(DOCS_DIR)) {
    if (!name.endsWith(".mdx")) continue;
    const slug = name.slice(0, -".mdx".length);
    docs.push(parseDoc(slug, path.join(DOCS_DIR, name), catalog));
  }

  // A slug in the catalog with no file behind it is a dead link in the rail.
  const written = new Set(docs.map((d) => d.slug));
  for (const slug of catalog.orderOf.keys()) {
    if (!written.has(slug)) fail("_nav.json", `"${slug}" has no ${slug}.mdx`);
  }

  docs.sort((a, b) => a.order - b.order);
  return (cache = docs);
}

/** Every page except the landing one, in rail order. */
export function getAllDocs(): DocPage[] {
  return loadAll().filter((d) => d.slug !== INDEX_SLUG);
}

/** The landing page, rendered at `/docs`. */
export function getDocsIndex(): DocPage {
  const index = loadAll().find((d) => d.slug === INDEX_SLUG);
  return index ?? fail("index.mdx", "missing — it is the /docs page");
}

export function getDoc(slug: string): DocPage | undefined {
  if (slug === INDEX_SLUG) return undefined; // `/docs/index` is not a route
  return loadAll().find((d) => d.slug === slug);
}

/** The rail: the catalog's groups, in the catalog's order, with their pages. */
export function getDocsNav(basePath: string): DocNavGroup[] {
  const catalog = loadCatalog();
  const byGroup = new Map<string, DocNavGroup["items"]>(
    catalog.labels.map((label) => [label, []]),
  );

  for (const doc of loadAll()) {
    byGroup.get(doc.group)?.push({
      label: doc.navLabel,
      href: doc.slug === INDEX_SLUG ? basePath : `${basePath}/${doc.slug}`,
      icon: doc.icon,
    });
  }

  return [...byGroup]
    .filter(([, items]) => items.length > 0)
    .map(([label, items]) => ({ label, items }));
}
