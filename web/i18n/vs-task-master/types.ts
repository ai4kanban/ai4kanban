import type {
  Heading,
  PageMeta,
  TitleBody,
  VsDecision,
  VsHero,
  VsHeroDiagrams,
} from "../types";

export type VsTaskMasterRowKey =
  | "startingPoint"
  | "vagueRequest"
  | "board"
  | "setup"
  | "execution"
  | "memory"
  | "reach"
  | "teams"
  | "license";

export type VsTaskMasterKanbanWinKey =
  | "asksFirst"
  | "diffablePlan"
  | "moduleMemory"
  | "nothingToWire";

export type VsTaskMasterWinKey =
  | "everywhere"
  | "research"
  | "batchRuns"
  | "proven";

export type VsTaskMasterCopy = {
  meta: PageMeta;
  hero: VsHero & VsHeroDiagrams;
  summary: {
    heading: Heading;
    lead: string;
    panel: string;
    // Facts with a date on them: how a reader tells a live project from a
    // parked one without taking our word for it.
    note: string;
  };
  start: {
    heading: Heading;
    lead: string;
    // Three steps a side, in the order the work happens. The titles carry the
    // argument, so they stay short enough to read at a glance.
    ours: { label: string; title: string; steps: [string, string, string] };
    theirs: { label: string; title: string; steps: [string, string, string] };
    note: string;
  };
  comparison: {
    heading: Heading;
    lead: string;
    ourLabel: string;
    theirLabel: string;
    rows: Record<
      VsTaskMasterRowKey,
      { dimension: string; kanban: string; taskMaster: string }
    >;
  };
  // The file trees themselves are file names, not words — they stay with the
  // component. Only what the reader is meant to take from them is copy.
  boardShape: {
    heading: Heading;
    lead: string;
    oursLabel: string;
    theirsLabel: string;
    oursCaption: string;
    theirsCaption: string;
    note: string;
  };
  wins: {
    heading: Heading;
    lead: string;
    oursHeading: string;
    theirsHeading: string;
    ours: Record<VsTaskMasterKanbanWinKey, TitleBody>;
    theirs: Record<VsTaskMasterWinKey, TitleBody>;
  };
  decision: VsDecision;
};
