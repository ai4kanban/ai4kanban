import type {
  Heading,
  PageMeta,
  TitleBody,
  VsDecision,
  VsHero,
} from "../types";

// Keys shared with `components/vs-github-issues/vs-content.ts`.

export type VsGithubRowKey =
  | "storage"
  | "offline"
  | "agentReads"
  | "tokenCost"
  | "latency"
  | "setup"
  | "lockIn"
  | "metadata"
  | "concurrency"
  | "history"
  | "closing"
  | "search"
  | "contributors"
  | "transparency";

export type VsGithubKanbanWinKey =
  | "tokenLight"
  | "agentsUseIt"
  | "offline"
  | "memory";

export type VsGithubIssuesWinKey =
  | "teams"
  | "transparency"
  | "fullContext"
  | "integration";

export type VsGithubCopy = {
  meta: PageMeta;
  hero: VsHero;
  summary: { heading: Heading; lead: string; panel: string };
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
  wins: {
    heading: Heading;
    lead: string;
    oursHeading: string;
    theirsHeading: string;
    ours: Record<VsGithubKanbanWinKey, TitleBody>;
    theirs: Record<VsGithubIssuesWinKey, TitleBody>;
  };
  ergonomics: {
    heading: Heading;
    lead: string;
    issues: {
      title: string;
      chip: string;
      lines: string[];
      footer: string;
    };
    kanban: { title: string; chip: string; lines: string[]; footer: string };
    note: string;
  };
  decision: VsDecision;
};
