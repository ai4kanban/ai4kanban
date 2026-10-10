import type { PageMeta } from "../types";

/** The comparison table's rows; which side has each is set in the page. */
export type VsOrcaRowKey = "planning" | "team" | "drafts" | "memory" | "tools";

/** The sources under the Codex note, in the order they are listed. */
export type VsOrcaSourceKey =
  | "worktrees"
  | "review"
  | "browser"
  | "remote"
  | "orcaFeatures";

export type VsOrcaCopy = {
  meta: PageMeta;
  hero: { badge: string; title: string; lead: string };
  both: { title: string; items: string[] };
  orca: {
    title: string;
    /** `intro`, then the `introLink` link, then `introEnd`. */
    intro: string;
    introLink: string;
    introEnd: string;
    body: string[];
  };
  codex: {
    title: string;
    lead: string;
    items: string[];
    agents: string;
    sources: Record<VsOrcaSourceKey, string>;
  };
  compare: {
    yes: string;
    no: string;
    rows: Record<VsOrcaRowKey, string>;
  };
  ours: {
    title: string;
    lead: string;
    drafts: { title: string; body: string; art: [string, string, string] };
    memory: {
      title: string;
      body: string;
      art: { agents: string[]; shared: string };
    };
    custom: string;
    tipLabel: string;
    tip: string;
  };
  decision: {
    title: string;
    ifYou: string;
    theirs: {
      name: string;
      points: string[];
      onlyLabel: string;
      only: string[];
      link: string;
    };
    ours: {
      name: string;
      points: string[];
      goalLabel: string;
      goal: string;
    };
  };
  start: { title: string; body: string; cta: string };
};
