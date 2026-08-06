import type {
  Heading,
  PageMeta,
  TitleBody,
  VsDecision,
  VsHero,
} from "../types";

// Keys shared with `components/vs-linear/vs-linear-content.ts`.

export type VsLinearRowKey =
  | "bestFit"
  | "sourceOfTruth"
  | "refinement"
  | "agentModel"
  | "execution"
  | "collaboration"
  | "portfolio"
  | "setup"
  | "portability"
  | "pricing";

export type VsLinearKanbanWinKey =
  | "roughToReady"
  | "repoMemory"
  | "anyHarness"
  | "noSaas";

export type VsLinearWinKey =
  | "teamSystem"
  | "agentPlatform"
  | "planningDepth"
  | "integrations";

export type VsLinearCopy = {
  meta: PageMeta;
  hero: VsHero;
  summary: { heading: Heading; lead: string; panel: string };
  comparison: {
    heading: Heading;
    lead: string;
    ourLabel: string;
    theirLabel: string;
    rows: Record<
      VsLinearRowKey,
      { dimension: string; kanban: string; linear: string }
    >;
  };
  model: {
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
    ours: Record<VsLinearKanbanWinKey, TitleBody>;
    theirs: Record<VsLinearWinKey, TitleBody>;
  };
  decision: VsDecision;
};
