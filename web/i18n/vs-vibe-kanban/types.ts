import type {
  Heading,
  PageMeta,
  TitleBody,
  VsDecision,
  VsHero,
} from "../types";

// Keys shared with `components/vs-vibe-kanban/vs-vibe-content.ts`.

export type VsVibeRowKey =
  | "whatFor"
  | "orchestration"
  | "review"
  | "planning"
  | "onDisk"
  | "runsAs"
  | "setup"
  | "whichAgents"
  | "lockIn"
  | "maintenance";

export type VsVibeKanbanWinKey =
  | "nothingRunning"
  | "planning"
  | "outlives"
  | "anyAgent";

export type VsVibeWinKey = "parallel" | "reviewInPlace" | "boardUi" | "support";

export type VsVibeCopy = {
  meta: PageMeta;
  hero: VsHero;
  summary: { heading: Heading; lead: string; panel: string };
  comparison: {
    heading: Heading;
    lead: string;
    ourLabel: string;
    theirLabel: string;
    rows: Record<
      VsVibeRowKey,
      { dimension: string; kanban: string; vibe: string }
    >;
  };
  purpose: {
    heading: Heading;
    lead: string;
    ours: { name: string; is: string; isnt: string };
    theirs: { name: string; is: string; isnt: string };
    note: string;
  };
  wins: {
    heading: Heading;
    lead: string;
    oursHeading: string;
    theirsHeading: string;
    ours: Record<VsVibeKanbanWinKey, TitleBody>;
    theirs: Record<VsVibeWinKey, TitleBody>;
  };
  decision: VsDecision;
};
