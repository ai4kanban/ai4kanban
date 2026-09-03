import type { PageMeta, TitleBody } from "../types";

/**
 * The landing page, section by section — the same five blocks in every
 * language, so each locale file fills the same keys.
 *
 * Where a component pairs a line of copy with something positional (a step
 * number, an icon), the copy is a tuple rather than an array: a translation
 * that drops or adds an entry is then a build error instead of a row that
 * renders without its mark.
 */
export type HomeCopy = {
  meta: PageMeta & {
    /** The WebPage node's description. Longer than the meta tag's — a search
     *  result is cut at ~160 characters and structured data is not. */
    schema: string;
  };
  hero: {
    /** The category the product is in, above the headline. */
    eyebrow: string;
    title: string;
    lead: string;
    /** The one thing the page is for: the app. Aimed at `/download`. */
    ctaDownload: string;
    ctaGithub: string;
    /** The caption on each stage of the hero sequence, in order. */
    flow: [string, string, string, string];
    /** The sequence in one sentence, for a reader who can't see it. */
    flowAlt: string;
  };
  /** Why the product exists, in one statement and one paragraph. */
  why: { title: string; body: string };
  /** The three chronological steps, in the order they happen. */
  steps: {
    title: string;
    items: [TitleBody, TitleBody, TitleBody];
  };
  /** What memory earns you, and what the board is built on. */
  trust: {
    title: string;
    lead: string;
    items: [TitleBody, TitleBody, TitleBody];
  };
  /**
   * Getting started: the app, and nothing beside it. One page, one thing to
   * press.
   */
  start: {
    title: string;
    lead: string;
    cta: string;
    /** What a Mac user has to do the first time, beside the first step. */
    firstOpen: string;
    /** How the app, bundled CLI, and automatically added skills fit together. */
    command: string;
  };
};
