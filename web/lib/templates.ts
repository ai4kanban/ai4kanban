// The public template catalog (#1711), read from Cloud's `/v1/catalog`
// (`cloud/src/catalog.ts`). The build reads it once for the HTML, the
// sitemap and each template's page; the browser reads it again on every visit,
// so a template published, replaced or taken down after the build shows up as
// it is now.

/** Where the catalog answers. A local run can point it elsewhere. */
export const CATALOG_API = `${process.env.NEXT_PUBLIC_CLOUD_API ?? "https://api.ai4kanban.dev"}/v1/catalog`;

export const TEMPLATES_PATH = "/templates";

/** The page a template the build never saw is drawn from: `functions/` serves
 *  it in place of any `/templates/<category>/<name>` with no page of its own. */
export const SHELL = "_";

export type Access = "free" | "pro";

export type TemplateCard = {
  name: string;
  category: string;
  title: string;
  summary: string;
  tags: string[];
  access: Access;
  cover: string | null;
  /** Seconds, for a video template. */
  duration: number | null;
};

export type Side = {
  image: string | null;
  video: string | null;
  youtube: string | null;
  keyframe: boolean;
  duration: number | null;
};

export type Template = TemplateCard & {
  description: string;
  publishedAt: string;
  source: { original: true } | { site: string; references: string[]; captured: string };
  original: Side | null;
  recreation: Side | null;
};

export type Category = { category: string; templates: TemplateCard[] };

// The categories the site names, in the order it shows them. Any other comes
// after, alphabetically, under the name it was published with.
const ORDER = ["ui", "video", "prop", "motion"];

export function ordered(categories: Category[]): Category[] {
  const rank = (c: string) => (ORDER.includes(c) ? ORDER.indexOf(c) : ORDER.length);
  return [...categories].sort((a, b) => rank(a.category) - rank(b.category) || a.category.localeCompare(b.category));
}

export const templatePath = (category: string, name: string) => `${TEMPLATES_PATH}/${category}/${name}`;

/** A read that did not answer: the page offers a retry, never an empty catalog. */
export class CatalogUnavailable extends Error {}

export async function fetchCatalog(init?: RequestInit): Promise<Category[]> {
  const res = await fetch(CATALOG_API, init).catch(() => null);
  if (!res?.ok) throw new CatalogUnavailable();
  const { categories } = (await res.json()) as { categories: Category[] };
  return ordered(categories);
}

/** A template, or null when there is none by this name — taken down, or never published. */
export async function fetchTemplate(name: string, init?: RequestInit): Promise<Template | null> {
  const res = await fetch(`${CATALOG_API}/${encodeURIComponent(name)}`, init).catch(() => null);
  if (res?.status === 404) return null;
  if (!res?.ok) throw new CatalogUnavailable();
  return ((await res.json()) as { template: Template }).template;
}

/** What the build saw, or nothing: a build that cannot reach Cloud still ships,
 *  and the browser reads the catalog itself. */
export async function buildCatalog(): Promise<Category[] | null> {
  return fetchCatalog({ cache: "force-cache" }).catch(() => null);
}

export async function buildTemplate(name: string): Promise<Template | null> {
  if (name === SHELL) return null;
  return fetchTemplate(name, { cache: "force-cache" }).catch(() => null);
}

/** `1:09`. */
export function clock(seconds: number): string {
  const s = Math.round(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** `linear.app` for `https://linear.app/`. */
export const linkLabel = (url: string) => url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
