import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

// The site's two legal pages: one MDX file each in `web/legal/`, read at build
// time and rendered through the blog's MDX components and prose stylesheet.
// They are not posts — no author line, no `Article` markup — so they live
// here rather than in `web/content/blogs/`.
//
// The set is closed. A legal page is a route someone links to from a contract
// or an app, so it is added deliberately, not by dropping a file in a folder.
//
// The frontmatter a page carries:
//
//   ---
//   title: "Privacy Policy"
//   lead: "One sentence under the headline."
//   description: "The meta description."
//   effective: 2026-08-26      # ISO 8601, the date it takes effect
//   ---

export const LEGAL_SLUGS = ["privacy", "terms"] as const;
export type LegalSlug = (typeof LEGAL_SLUGS)[number];

export type LegalDoc = {
  slug: LegalSlug;
  /** The route the page is published at. */
  path: string;
  title: string;
  lead: string;
  description: string;
  /** ISO instant — the date the page takes effect, shown on it. */
  effective: string;
  /** The MDX body, frontmatter already stripped. */
  body: string;
};

const LEGAL_DIR = path.join(process.cwd(), "legal");

function fail(slug: string, reason: string): never {
  throw new Error(`[legal] ${slug}.mdx: ${reason}`);
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
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

// A malformed page fails the build. Publishing a legal page with no effective
// date is worse than not deploying.
function parseDoc(slug: LegalSlug): LegalDoc {
  const parsed = matter(fs.readFileSync(path.join(LEGAL_DIR, `${slug}.mdx`), "utf8"));
  const data = parsed.data as Record<string, unknown>;

  return {
    slug,
    path: `/${slug}`,
    title: asString(data.title) ?? fail(slug, "`title` is required"),
    lead: asString(data.lead) ?? fail(slug, "`lead` is required"),
    description: asString(data.description) ?? fail(slug, "`description` is required"),
    effective: asIsoDate(data.effective) ?? fail(slug, "`effective` must be an ISO 8601 date"),
    body: parsed.content,
  };
}

const cache = new Map<LegalSlug, LegalDoc>();

export function getLegalDoc(slug: LegalSlug): LegalDoc {
  if (process.env.NODE_ENV !== "production") return parseDoc(slug);
  let doc = cache.get(slug);
  if (!doc) cache.set(slug, (doc = parseDoc(slug)));
  return doc;
}

/** Both pages — the sitemap reads this. */
export function getLegalDocs(): LegalDoc[] {
  return LEGAL_SLUGS.map(getLegalDoc);
}
