import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import type { Locale } from "./i18n";

// The workflow pages: `web/content/workflows/<slug>/<locale>.mdx`, one file per language.
// Server-only — it reads the filesystem at build time. A missing field fails the build.
//
//   ---
//   title: "AI4Kanban for coding"            # the H1
//   title_tag: "AI Coding Workflow - ..."    # the SERP <title>
//   description: "..."                       # meta description
//   lead: "..."                              # the line under the H1
//   hero_alt: "..."                          # what a screen reader hears for the hero art
//   toc: "On this page"
//   ---

export type WorkflowPage = {
  title: string;
  titleTag: string;
  description: string;
  lead: string;
  heroAlt: string;
  toc: string;
  body: string;
};

export function workflowPath(slug: string): string {
  return `/workflows/${slug}`;
}

export function getWorkflowPage(slug: string, locale: Locale): WorkflowPage {
  const file = path.join(process.cwd(), "content", "workflows", slug, `${locale}.mdx`);
  const { data, content } = matter(fs.readFileSync(file, "utf8"));
  const field = (key: string): string => {
    const value = data[key];
    if (typeof value !== "string" || !value.trim()) {
      throw new Error(`[workflows] ${slug}/${locale}.mdx: \`${key}\` is required`);
    }
    return value.trim();
  };
  return {
    title: field("title"),
    titleTag: field("title_tag"),
    description: field("description"),
    lead: field("lead"),
    heroAlt: field("hero_alt"),
    toc: field("toc"),
    body: content,
  };
}
