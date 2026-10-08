import type { Heading, PageMeta, VsDecision, VsTopicsHero } from "../types";

export type VsMulticaRowKey =
  | "startingPoint"
  | "refinement"
  | "memory"
  | "backlog"
  | "license"
  | "execution"
  | "teams";

export type VsMulticaCopy = {
  meta: PageMeta;
  hero: VsTopicsHero;
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
