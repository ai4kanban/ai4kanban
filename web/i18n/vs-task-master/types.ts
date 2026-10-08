import type { Heading, PageMeta, VsDecision, VsTopicsHero } from "../types";

export type VsTaskMasterRowKey =
  | "startingPoint"
  | "planning"
  | "drafts"
  | "discussion"
  | "memory"
  | "followUps"
  | "interface"
  | "execution"
  | "testFirst"
  | "research"
  | "reach"
  | "license";

export type VsTaskMasterCopy = {
  meta: PageMeta;
  hero: VsTopicsHero;
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
  decision: VsDecision;
};
