import type {
  Heading,
  PageMeta,
  VsDecision,
  VsHero,
  VsHeroDiagrams,
} from "../types";

// Keys shared with `components/vs-github-issues/vs-content.ts`.

export type VsGithubRowKey =
  | "storage"
  | "tokenCost"
  | "concurrency"
  | "history"
  | "contributors";

export type VsGithubCopy = {
  meta: PageMeta;
  hero: VsHero & VsHeroDiagrams;
  comparison: {
    heading: Heading;
    lead: string;
    ourLabel: string;
    theirLabel: string;
    rows: Record<
      VsGithubRowKey,
      { dimension: string; kanban: string; issues: string }
    >;
  };
  decision: VsDecision;
};
