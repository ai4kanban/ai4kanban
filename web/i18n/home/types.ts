import type { PageMeta } from "../types";

/**
 * The landing page, section by section — the same sections in every language,
 * so each locale file fills the same keys.
 *
 * Where a component pairs a line of copy with something positional (a picture),
 * the copy is a tuple rather than an array: a translation that drops or adds an
 * entry is then a build error instead of a row that renders without its picture.
 */
type Workflow = {
  label: string;
  /** What the user reviews and what agents then do, one line under the name. */
  body: string;
  /** What the preview shows, for a reader who cannot see it. */
  image: string;
};

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
  /** How it works: words beside the bridge scene. */
  handoff: {
    /** Each `\n` starts a new line. */
    title: string;
    body: string[];
    /** The scene's words; `label` reads the whole loop for a reader who cannot see it. */
    scene: {
      label: string;
      idea: string[];
      you: string;
      board: string;
      agent: string;
      review: string;
      build: string;
    };
  };
  /** The running office, under its title and one line. */
  office: {
    title: string;
    body: string;
  };
  /** One card per workflow, in `PREVIEWS` order — coding, video clone, product video, slide
   *  deck, carousel post, blog post. */
  workflows: {
    title: string;
    lead: string;
    items: [Workflow, Workflow, Workflow, Workflow, Workflow, Workflow];
    /** The links under the cards: the demo and every agent. */
    links: { demo: string; all: string };
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
  };
};
