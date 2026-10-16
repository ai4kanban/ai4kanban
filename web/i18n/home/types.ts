import type { PageMeta } from "../types";

/**
 * The landing page, section by section — the same sections in every language,
 * so each locale file fills the same keys.
 *
 * Where a component pairs a line of copy with something positional (a picture),
 * the copy is a tuple rather than an array: a translation that drops or adds an
 * entry is then a build error instead of a row that renders without its picture.
 */
type Kind = { label: string; body: string };

export type HomeCopy = {
  meta: PageMeta & {
    /** The WebPage description can be longer than the search-result meta tag. */
    schema: string;
  };
  hero: {
    /** Who the product is for, set small above the title. */
    eyebrow: string;
    /** Each `\n` starts a new line. */
    title: string;
    lead: string;
    /** The one thing the page is for: the app. Aimed at `/download`. */
    ctaDownload: string;
    ctaGithub: string;
    /** The /demo recording's label. */
    image: string;
  };
  /** 01: one picture per kind, in `DRAFTS` order — UI, copy, storyboard, figures. */
  drafts: {
    title: string;
    lead: string;
    kinds: [Kind, Kind, Kind, Kind];
    closing: string;
  };
  agents: {
    title: string;
    body: string[];
    /** The Pro note under the section. */
    pro: string;
    image: string;
  };
  followUps: {
    title: string;
    body: string[];
    image: string;
  };
  parallel: {
    title: string;
    body: string[];
    shots: {
      board: { label: string; alt: string };
      card: { label: string; alt: string };
      /** `{view}` is replaced by the card's label. */
      frontAria: string;
      flipAria: string;
    };
  };
  tools: {
    title: string;
    body: string;
  };
  start: {
    title: string;
    lead: string;
    cta: string;
    /** What a Mac user has to do the first time, beside the button. */
    firstOpen: string;
    command: string;
  };
};
