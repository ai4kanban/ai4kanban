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
    ctaInstall: string;
    ctaGithub: string;
    shots: {
      board: { label: string; alt: string };
      queue: { label: string; alt: string };
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
    context: [string, string, string, string];
    skill: string;
    /** Names the "…" tile that stands for agents beyond Claude Code and Codex. */
    otherAgents: string;
    storage: string;
    outputsLabel: string;
    outputs: [string, string];
  };
  start: {
    title: string;
    lead: string;
    /** The chips beside the copy button. */
    notes: string[];
    cta: string;
    copied: string;
    /** The other way in: the board as an app, beside the setup prompt. */
    app: { title: string; body: string; cta: string };
  };
};

/** One row of the traditional-board / AI4Kanban comparison. */
export type CompareRow = {
  dimension: string;
  classic: string;
  kanban: string;
};
