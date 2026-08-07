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
    handoffLabel: string;
    principle: string;
  };
  backlog: {
    heading: Heading;
    lead: string;
    ours: {
      label: string;
      title: string;
      body: string;
      steps: [string, string, string];
      state: string;
    };
    theirs: {
      label: string;
      title: string;
      body: string;
      steps: [string, string, string];
      state: string;
    };
    note: string;
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
    ours: {
      eyebrow: string;
      title: string;
      body: string;
      examples: [string, string, string];
      question: string;
      answer: string;
    };
    theirs: {
      eyebrow: string;
      title: string;
      body: string;
      examples: [string, string, string];
      question: string;
      answer: string;
    };
    note: string;
  };
  horizon: {
    heading: Heading;
    lead: string;
    shippedLabel: string;
    visionLabel: string;
    shippedTitle: string;
    shippedBody: string;
    visionTitle: string;
    visionBody: string;
    marker: string;
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
