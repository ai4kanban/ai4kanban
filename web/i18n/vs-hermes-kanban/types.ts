import type { Heading, PageMeta, VsDecision, VsQuestionsHero } from "../types";

export type VsHermesRowKey =
  | "startingPoint"
  | "planning"
  | "drafts"
  | "questions"
  | "memory"
  | "followUps"
  | "landing"
  | "recurring"
  | "harness"
  | "interface"
  | "review"
  | "chat"
  | "recovery"
  | "api";

export type VsHermesCopy = {
  meta: PageMeta;
  hero: VsQuestionsHero;
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
  decision: VsDecision;
};
