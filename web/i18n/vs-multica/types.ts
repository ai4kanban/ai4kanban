import type {
  Heading,
  PageMeta,
  TitleBody,
  VsDecision,
  VsHero,
} from "../types";

export type VsMulticaRowKey =
  | "startingPoint"
  | "backlog"
  | "refinement"
  | "memory"
  | "execution"
  | "teams"
  | "storage"
  | "license";

export type VsMulticaKanbanWinKey =
  | "upstream"
  | "rejectionMemory"
  | "repoNative";

export type VsMulticaWinKey = "operations" | "teams" | "runtimeReach";

export type VsMulticaStageKey =
  | "discover"
  | "refine"
  | "prioritize"
  | "assign"
  | "run"
  | "review";

export type VsMulticaCopy = {
  meta: PageMeta;
  hero: VsHero & {
    oursDiagramAlt: string;
    theirsDiagramAlt: string;
    oursDiagramTop: string;
    oursDiagramBottom: string;
    theirsDiagramTop: string;
    theirsDiagramBottom: string;
  };
  boundary: {
    heading: Heading;
    lead: string;
    stages: Record<VsMulticaStageKey, string>;
    oursLabel: string;
    theirsLabel: string;
    // The one line each product's three stages add up to. It is the only thing
    // in the diagram set large, because it is the only thing a reader who
    // glances at this section needs to leave with.
    oursJob: string;
    theirsJob: string;
  };
  backlog: {
    heading: Heading;
    lead: string;
    // What is in each box on day one. Not the steps — those are the section
    // above, and listing them twice is what made this one read as filler.
    ours: { label: string; title: string; items: [string, string, string] };
    theirs: { label: string; title: string; items: [string, string, string] };
  };
  comparison: {
    heading: Heading;
    lead: string;
    ourLabel: string;
    theirLabel: string;
    rows: Record<
      VsMulticaRowKey,
      { dimension: string; kanban: string; multica: string }
    >;
  };
  memory: {
    heading: Heading;
    lead: string;
    // `title` is the whole point of the card — one side keeps the why, the
    // other the how — so it is short enough to set large and read at a glance.
    ours: {
      eyebrow: string;
      title: string;
      examples: [string, string, string];
      question: string;
      answer: string;
    };
    theirs: {
      eyebrow: string;
      title: string;
      examples: [string, string, string];
      question: string;
      answer: string;
    };
    note: string;
  };
  // Only the gap. What Multica already provides is the section above; this one
  // would repeat it if it named it again.
  horizon: {
    heading: Heading;
    lead: string;
    visionLabel: string;
    visionTitle: string;
    items: [string, string, string, string];
    note: string;
  };
  wins: {
    heading: Heading;
    lead: string;
    oursHeading: string;
    theirsHeading: string;
    ours: Record<VsMulticaKanbanWinKey, TitleBody>;
    theirs: Record<VsMulticaWinKey, TitleBody>;
  };
  decision: VsDecision;
};
