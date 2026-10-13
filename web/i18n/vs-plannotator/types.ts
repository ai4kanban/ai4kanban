import type { PageMeta } from "../types";

/** The comparison table's rows; which side has each is set in the page. */
export type VsPlannotatorRowKey =
  | "plans"
  | "html"
  | "images"
  | "planDiff"
  | "askAi"
  | "codeDiff"
  | "aiReview"
  | "prs"
  | "share"
  | "board"
  | "agents"
  | "memory"
  | "followUps";

/** A row's label, plus the note beside a side's check where it has one. */
export type VsPlannotatorRow = { label: string; theirs?: string; ours?: string };

export type VsPlannotatorCopy = {
  meta: PageMeta;
  hero: { badge: string; title: string; lead: string };
  both: { title: string; items: string[] };
  theirs: {
    title: string;
    intro: string;
    more: { title: string; body: string }[];
    /** The Plannotator site, then its README. */
    links: [string, string];
  };
  ours: {
    title: string;
    lead: string;
    drafts: { title: string; body: string; art: [string, string, string] };
    parallel: { title: string; body: string; art: [string, string, string] };
    memory: {
      title: string;
      body: string;
      art: { agents: string[]; shared: string };
    };
    custom: string;
    tipLabel: string;
    tip: string;
  };
  compare: {
    title: string;
    head: string;
    yes: string;
    no: string;
    /** The first row: plain text on both sides. */
    how: { label: string; theirs: string; ours: string };
    rows: Record<VsPlannotatorRowKey, VsPlannotatorRow>;
    note: string;
  };
  decision: {
    title: string;
    theirs: { name: string; body: string };
    ours: { name: string; body: string };
  };
  start: { title: string; body: string; cta: string };
};
