// The reader, as a hosted page can know them: which language to draw in, and where to send
// them back to after a sign-in.

import { DEFAULT_LANGUAGE, languageForTag, type Language } from "@/lib/format/machine/types";

/**
 * The language to draw in, off the browser's preferred languages.
 *
 * A hosted page has no machine setting to read — that one is a fact about a machine the app
 * is installed on, and there is no app here. So the reader's own list is what decides, taken
 * in the order they wrote it and stopping at the first language this build has. A list with
 * none of ours in it reads as English.
 *
 * The board's own words are not translated by any of this: a card travels in whatever
 * language it was written in.
 */
export function languageFor(acceptLanguage: string | null): Language {
  for (const part of (acceptLanguage ?? "").split(",")) {
    const tag = part.split(";")[0]?.trim();
    if (!tag || tag === "*") continue;
    const language = languageForTag(tag);
    if (language) return language;
  }
  return DEFAULT_LANGUAGE;
}

/** Somewhere no request ever goes, so a `next` that resolves off it is one that names
 *  another site. */
const NOWHERE = "https://next.invalid";

/**
 * Where a finished sign-in comes back to, taken as a path on this site and nothing else.
 *
 * Resolved rather than pattern-matched: `//host`, `/\host` and `/<tab>/host` all parse as
 * another site's URL, and `/..//host` becomes one after the path is normalised. What comes
 * back is the path a browser would have asked for, or `/` — a reader who asked for a board
 * is owed that board rather than somebody else's page.
 */
export function safeNext(raw: string | null | undefined): string {
  const held = (raw ?? "").trim();
  if (!held.startsWith("/")) return "/";
  let asked: URL;
  try {
    asked = new URL(held, NOWHERE);
  } catch {
    return "/";
  }
  if (asked.origin !== NOWHERE) return "/";
  const path = `${asked.pathname}${asked.search}`;
  if (path.startsWith("//")) return "/";
  // Never back into the sign-in itself: a finished sign-in that lands on `/signin` starts
  // another one, and that is a loop rather than a page.
  return /^\/sign(in|out)\b/.test(asked.pathname) ? "/" : path;
}
