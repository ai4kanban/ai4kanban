// Page metadata, written once per page.
//
// Every page used to repeat its title and description up to five times — the
// `<title>`, the meta description, the OpenGraph pair, the Twitter pair, and
// again in the page's JSON-LD. `pageMetadata` builds the tag side from one set
// of strings; the page hands those same strings to `lib/schema.ts` so the
// structured data can't drift from what the tags say.
import type { Metadata } from "next";
import { OG_IMAGE } from "./site";

// The home page splits its metadata (app/layout.tsx) from its JSON-LD
// (app/page.tsx), so its copy lives here where both can reach it.
export const HOME_TITLE = "AI4Kanban — AI project management that grows with you";
export const HOME_DESCRIPTION =
  "AI project management for Claude Code. Give it a vague idea — the agent breaks it down and clarifies it in a loop until it's clear enough to build. Plain Markdown, in git.";
export const HOME_SOCIAL =
  "Give it a vague idea. The agent breaks it down, answers what it can on its own, asks you the rest — and keeps at it in the background until every detail is clear enough to build.";

type PageMetadata = {
  /** Route path, e.g. "/recipes". Empty string for the home page. */
  path: string;
  title: string;
  description: string;
  /** Share-card title, when the full one is too long. Defaults to `title`. */
  socialTitle?: string;
  /** Share-card description. Defaults to `description`. */
  social?: string;
  type?: "website" | "article";
};

export function pageMetadata({
  path,
  title,
  description,
  socialTitle,
  social,
  type = "website",
}: PageMetadata): Metadata {
  const url = path || "/";
  const ogTitle = socialTitle ?? title;
  const ogDescription = social ?? description;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type,
      url,
      siteName: "AI4Kanban",
      title: ogTitle,
      description: ogDescription,
      images: [OG_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description: ogDescription,
      images: [OG_IMAGE.url],
    },
  };
}
