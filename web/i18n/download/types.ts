import type { PageMeta } from "../types";

/**
 * The download page — where a person gets the board as an app.
 *
 * It is a utility page, not a pitch: one button, which file each system takes,
 * and what to do on first launch. Anything a reader can find in
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
    /** The button before the reader's system is known, and on anything we
     *  don't build for. One word — the mark beside it carries the rest. */
    cta: string;
    /** The button once it is known. `{system}` is the product's own name
     *  (macOS, Windows, Linux) and stays as it is in every language. */
    ctaFor: string;
  };
  /** The card per system. Nothing in the cards is copy — a system name, an
   *  architecture and a file type read the same in every language. */
  builds: {
    title: string;
  };
  /** macOS takes more than a click, hence steps there and a line each for the
   *  other two. */
  firstOpen: {
    title: string;
    platformLabel: string;
    mac: { steps: string[] };
    windows: { body: string };
    linux: { body: string };
  };
  /** Optional terminal setup, collapsed under the selected platform. */
  command: {
    title: string;
    mac: string;
    windows: string;
    linux: string;
  };
};
