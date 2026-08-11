import type { PageMeta } from "../types";

/**
 * The download page — where a person gets the board as an app.
 *
 * It is a utility page, not a pitch: one button, which file each system takes,
 * and what to click past the unsigned warning. Anything a reader can find in
 * the app itself is not on it.
 *
 * Nothing positional is copy: the file extensions and the release URL stay in
 * `components/pages/DownloadPage.tsx`. What is here is the words around them.
 */
export type DownloadCopy = {
  meta: PageMeta;
  hero: {
    title: string;
    lead: string;
    /** The one button, once the browser has said which system it is on.
     *  `{system}` is filled with a product name — macOS, Windows, Linux — so
     *  it stays a placeholder in every language. */
    cta: string;
    /** The same button before that, and on anything we don't build for. */
    ctaAny: string;
    /** Under the button: what you still need on the machine to start runs. */
    note: string;
  };
  /** The card per system. Nothing in the cards is copy — a system name, an
   *  architecture and a file type read the same in every language. */
  builds: {
    title: string;
    /** The whole caveat in one sentence: unsigned, and only one is tested. */
    note: string;
  };
  /** Every build is unsigned this release, so every system warns once. macOS is
   *  the one that takes more than a click, hence steps there and a line each
   *  for the other two. */
  firstOpen: {
    title: string;
    mac: { title: string; steps: string[] };
    windows: { title: string; body: string };
    linux: { title: string; body: string };
  };
};
