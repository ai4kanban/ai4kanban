import type { Heading, PageMeta, VsDecision } from "../types";

export type VsMulticaRowKey =
  | "startingPoint"
  | "refinement"
  | "memory"
  | "backlog"
  | "license"
  | "execution"
  | "teams";

/** A capability both have: one line on how each product does it. */
export type MulticaSharedItem = {
  title: string;
  /** AI4Kanban's line, then Multica's. */
  body: [string, string];
};

/** Multica's side of a topic: a blank form, and what filling it in makes. */
export type MulticaForm = {
  title: string;
  fields: [string, string, string];
  slot: string;
};

/** One hero topic: where AI4Kanban wins, what that saves you, and what both share. */
export type MulticaTopic<Art> = {
  heading: string;
  verdict: string;
  ours: string;
  theirs: string;
  art: { ours: Art; theirs: MulticaForm };
  shared: [MulticaSharedItem, MulticaSharedItem];
};

export type VsMulticaCopy = {
  meta: PageMeta;
  hero: {
    badge: string;
    /** `\n` marks the line break in the H1. */
    title: string;
    lead: string;
    sharedLabel: string;
    /** Agent names under the three built-in specialists. */
    setup: MulticaTopic<[string, string, string]>;
    /** Draft, approve, run. */
    drafts: MulticaTopic<[string, string, string]>;
    memory: MulticaTopic<{
      agents: [string, string];
      notes: [string, string];
      shared: string;
    }>;
  };
  comparison: {
    heading: Heading;
    lead: string;
    ourLabel: string;
    theirLabel: string;
    rows: Record<
      VsMulticaRowKey,
      { dimension: string; kanban: string; multica: string; kanbanTip?: string }
    >;
  };
  decision: VsDecision;
};
