import type { PageMeta, TitleBody } from "../types";

/**
 * The landing page, section by section — the same five sections in every
 * language, so each locale file fills the same keys.
 *
 * Where a component pairs a line of copy with something positional (an icon, a
 * step number), the copy is a tuple rather than an array: a translation that
 * drops or adds an entry is then a build error instead of a row that renders
 * without its icon.
 */
export type HomeCopy = {
  meta: PageMeta;
  hero: {
    title: string;
    lead: string;
    /** The one thing the page is for: the app. Aimed at `/download`. */
    ctaDownload: string;
    ctaGithub: string;
    shots: {
      board: { label: string; alt: string };
      card: { label: string; alt: string };
      /** `{view}` is replaced by the card's label. */
      frontAria: string;
      flipAria: string;
    };
  };
  compare: {
    title: string;
    lead: string;
    columns: { classic: string; kanban: string };
    rows: [CompareRow, CompareRow, CompareRow];
  };
  loop: {
    title: string;
    lead: string;
    steps: [TitleBody, TitleBody, TitleBody, TitleBody];
  };
  memory: {
    title: string;
    lead: string;
    cards: [TitleBody, TitleBody, TitleBody];
    /** What each memory file holds. The paths themselves stay in the component. */
    tree: {
      goal: string;
      module: string;
      readme: string;
      decisions: string;
      rejected: string;
      redesign: string;
    };
  };
  /** The architecture diagram: every entry is a node label, so all of it is nouns. */
  iterate: {
    title: string;
    lead: string;
    inputsLabel: string;
    inputs: [string, string, string, string];
    /** The second group in the same column: what the team already plans from. */
    internalLabel: string;
    internal: [string];
    /**
     * The board drawn at the centre. Only the two column headings and the pill
     * on a ready card are words — the cards themselves are drawn, not written.
     * A heading is set in a fixed-width bar and never wraps: keep it short.
     */
    board: {
      columns: [string, string];
      /** The pill a ready card wears. One word. */
      ready: string;
    };
    storage: string;
    outputsLabel: string;
    outputs: [string, string];
  };
  /**
   * Getting started: the app, and nothing beside it. One page, one thing to
   * press.
   */
  start: {
    title: string;
    lead: string;
    /** The chips beside the download button. */
    notes: string[];
    cta: string;
    /** What a Mac user has to do the first time, beside the first step. */
    firstOpen: string;
    /** How the app, bundled CLI, and automatically added skills fit together. */
    command: string;
  };
};

/** One row of the traditional-board / AI4Kanban comparison. */
export type CompareRow = {
  dimension: string;
  classic: string;
  kanban: string;
};
