import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { countReadMinutes } from "@/lib/read-minutes";
import type { AgentPage } from "./types";

// Reads `web/content/agents/*.mdx` at build time. Server-only by construction —
// it touches the filesystem, so only a server component (the agent route) and
// the sitemap can ever import it.
//
// A malformed page *fails the build*, the same discipline the blog and the
// documentation keep: this is a landing page someone is about to link to, and a
// build log is not where they find out a typo dropped its meta description.
//
// The frontmatter is documented in `types.ts`.

const AGENTS_DIR = path.join(process.cwd(), "content", "agents");

function fail(file: string, reason: string): never {
  throw new Error(`[agents] ${file}: ${reason}`);
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== ""
    ? value.trim()
    : undefined;
}

function parsePage(slug: string, file: string): AgentPage {
  const name = path.basename(file);
  const parsed = matter(fs.readFileSync(file, "utf8"));
  const data = parsed.data as Record<string, unknown>;

  const title = asString(data.title) ?? fail(name, "`title` is required");
  const description =
    asString(data.description) ?? fail(name, "`description` is required");
  const lead = asString(data.lead) ?? fail(name, "`lead` is required");
  const schema = data.schema as Record<string, unknown> | undefined;

  return {
    slug,
    title,
    titleTag: asString(data.title_tag),
    navLabel: asString(data.nav) ?? fail(name, "`nav` is required"),
    description,
    lead,
    eyebrow: asString(data.eyebrow),
    socialImageAlt: asString(data.social_image_alt),
    schemaDescription: asString(schema?.description) ?? description,
    readMinutes: countReadMinutes(parsed.content),
    body: parsed.content,
  };
}

// One read per build, skipped in `next dev` so an edit shows up on reload.
let cache: AgentPage[] | null = null;

function loadAll(): AgentPage[] {
  if (cache && process.env.NODE_ENV === "production") return cache;
  if (!fs.existsSync(AGENTS_DIR)) return (cache = []);

  const pages: AgentPage[] = [];
  for (const name of fs.readdirSync(AGENTS_DIR)) {
    if (!name.endsWith(".mdx")) continue;
    const slug = name.slice(0, -".mdx".length);
    pages.push(parsePage(slug, path.join(AGENTS_DIR, name)));
  }

  pages.sort((a, b) => a.slug.localeCompare(b.slug));
  return (cache = pages);
}

export function getAgentPages(): AgentPage[] {
  return loadAll();
}

export function getAgentPage(slug: string): AgentPage | undefined {
  return loadAll().find((p) => p.slug === slug);
}
