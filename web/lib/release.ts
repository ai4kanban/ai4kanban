import { readFileSync } from "node:fs";
import { join } from "node:path";
import { GITHUB_URL } from "@/components/content";

// The desktop release the download page hands out. Server-only: it reads a file
// off disk, so import it from a page, never from a `"use client"` component —
// pass what the browser needs down as props.
//
// Every asset on a GitHub release carries the version in its name, so a direct
// per-file link can't be written without knowing the number. It is read from the
// repo's canonical `VERSION` at build time rather than typed here, because a
// constant here would be one more place `scripts/sync-version.mjs` has to stamp
// and one more place to forget. It is read rather than fetched from the GitHub
// API in the browser because the site is a static export: making the page's one
// button depend on a network call trades a stale link for a missing button.
//
// The cost of reading it is that the site must be deployed *after* the release
// for that tag exists, or the links 404 — the release checklist in PUBLISHING.md
// says so, and puts the deploy last.

/** The version the page links to, e.g. `0.5.1`. No leading `v`. */
export const VERSION = readVersion();

function readVersion(): string {
  // `next build` and `next dev` both run with the cwd at `web/`, so the repo
  // root is one up. A wrong number here is silently broken links, so this
  // throws rather than falling back to anything.
  const path = join(process.cwd(), "..", "VERSION");
  const raw = readFileSync(path, "utf8").trim();
  if (!/^\d+\.\d+\.\d+/.test(raw)) {
    throw new Error(`release: ${path} is not a version: "${raw}"`);
  }
  return raw;
}

/** The release page itself — every file, plus the notes. */
export const RELEASES_URL = `${GITHUB_URL}/releases/latest`;

/** A file on the release for `VERSION`. GitHub serves these as attachments, so
 *  the link downloads rather than navigating. */
export function assetUrl(name: string): string {
  return `${GITHUB_URL}/releases/download/v${VERSION}/${name}`;
}
