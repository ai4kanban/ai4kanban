import type {
  Heading,
  PageMeta,
  TitleBody,
  VsDecision,
  VsHero,
} from "../types";

// Keys shared with `components/vs-hermes-kanban/vs-hermes-content.ts`.

export type VsHermesRowKey =
  | "whatItIs"
  | "infrastructure"
  | "whereBoardLives"
  | "setup"
  | "parallelRuns"
  | "crashRecovery"
  | "decomposition"
  | "reviewMemory"
  | "dashboard"
  | "scale";

export type VsHermesKanbanWinKey =
  | "noInfra"
  | "diffable"
  | "selfPruning"
  | "onePrompt";

export type VsHermesWinKey =
  | "manyAgents"
  | "selfHealing"
  | "autoDecompose"
  | "fleetReach";

export type VsHermesStopKey = "traditional" | "kanban" | "hermes";

export type VsHermesCopy = {
  meta: PageMeta;
  hero: VsHero & {
    /** Alt text for the two layering diagrams. */
    oursDiagramAlt: string;
    theirsDiagramAlt: string;
    /** Labels drawn inside the diagrams. */
    taskLayer: string;
    boardLayer: string;
  };
  summary: {
    heading: Heading;
    lead: string;
    oursHeading: string;
    theirsHeading: string;
    ours: string[];
    theirs: string[];
    whenLabel: string;
    when: string;
  };
  harness: {
    heading: Heading;
    lead: string;
    oursSub: string;
    theirsSub: string;
    supported: string;
    notSupported: string;
    note: string;
  };
  comparison: {
    heading: Heading;
    lead: string;
    ourLabel: string;
    theirLabel: string;
    rows: Record<
      VsHermesRowKey,
      { dimension: string; kanban: string; hermes: string }
    >;
  };
  memory: {
    heading: Heading;
    lead: string;
    ours: { heading: string; verdict: string; body: string; q: string; a: string };
    theirs: {
      heading: string;
      verdict: string;
      body: string;
      q: string;
      a: string;
    };
    note: string;
  };
  autonomy: {
    heading: Heading;
    lead: string;
    stops: Record<
      VsHermesStopKey,
      { level: string; term: string; heading: string; detail: string }
    >;
    scaleLeft: string;
    scaleMiddle: string;
    scaleRight: string;
    worstCaseLabel: string;
    worstCaseTheirs: string;
    worstCaseOurs: string;
    note: string;
  };
  gui: {
    heading: Heading;
    lead: string;
    ours: { heading: string; body: string; alt: string };
    theirs: { heading: string; body: string; alt: string };
  };
  wins: {
    heading: Heading;
    lead: string;
    oursHeading: string;
    theirsHeading: string;
    ours: Record<VsHermesKanbanWinKey, TitleBody>;
    theirs: Record<VsHermesWinKey, TitleBody>;
  };
  decision: VsDecision;
};
