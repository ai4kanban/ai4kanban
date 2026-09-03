// English copy for the landing page — the source of truth the other four
// languages mirror key for key. Writing rules: `i18n/index.ts`.
import type { HomeCopy } from "./types";

const en: HomeCopy = {
  meta: {
    title: "AI project manager for coding agents | AI4Kanban",
    description:
      "Turn rough ideas into executable plans, run tasks across your coding agents, and review only the product decisions that require human judgment with AI4Kanban.",
    schema:
      "AI4Kanban is an open-source, local-first AI project manager for coding agents. It turns rough product ideas into dependency-aware tasks, coordinates background execution, preserves project decisions, and interrupts developers only when human judgment or final approval is required.",
  },

  hero: {
    eyebrow: "AI project manager for coding agents",
    title: "Turn rough ideas into shipped software—without babysitting agents.",
    lead: "AI4Kanban plans the work, runs it through your coding agents, and asks you only for product decisions and approval.",
    ctaDownload: "Download",
    ctaGithub: "View on GitHub ↗",
    flow: [
      "Your rough idea",
      "A plan, in dependency order",
      "The call only you can make",
      "Agents running in the background",
    ],
    flowAlt:
      "A rough idea becomes a dependency-ordered plan, one product decision comes back for a human answer, and the rest of the work runs across coding agents in the background.",
  },

  why: {
    title: "Coding got fast. Product decisions became the bottleneck.",
    body: "Agents build clear requirements reliably. Vague ones turn into drift, rework, and a queue of long agent conversations nobody has time to read. AI4Kanban sits above your coding agents: it settles what to build before anything runs, and brings back only what a person has to decide.",
  },

  steps: {
    title: "From a rough idea to a landed change",
    items: [
      {
        title: "Start with a rough idea",
        body: "Describe the outcome in a sentence. AI4Kanban reads your codebase, breaks the goal into bounded tasks, and orders them by dependency so independent work can run in parallel.",
      },
      {
        title: "Approve only what needs you",
        body: "Routine details are answered from the code and from project memory. Taste, business direction, risk, and cost come back as a short question with a recommended answer. Every answer becomes project memory, so the next plan asks less of you.",
      },
      {
        title: "Let the agents run",
        body: "Ready tasks run in the background, each in its own Git worktree, and conflicts get a resolution pass before anything lands. You hear about it when a delivery is waiting for approval.",
      },
    ],
  },

  trust: {
    title: "Learns your project, stays in your repository",
    lead: "Product decisions, rejected directions, and design lessons outlive the conversation that produced them, so autonomy grows and review shrinks as the project goes on.",
    items: [
      {
        title: "Apache-2.0",
        body: "Open source. Free to use, modify, and redistribute.",
      },
      {
        title: "Local-first",
        body: "The board and its memory are Markdown under `docs/kanban/`, versioned in Git.",
      },
      {
        title: "Your coding agent",
        body: "Claude Code, Codex, Cursor, OpenCode, Kimi Code, DeepSeek Harness, and ZCode.",
      },
    ],
  },

  start: {
    title: "Start with the desktop app",
    lead: "Download the app, open a project, and answer three questions. It reads the codebase, writes the project goal and module memory, and proposes the first tasks.",
    cta: "Download",
    firstOpen:
      "Builds are unsigned, so macOS blocks the first open: drag the app in from the `.dmg`, then click through the warning. The download page has the full steps for macOS, Windows, and Linux.",
    command:
      "The app includes the `akb` CLI and adds the coding-agent skills when you open a project. Neither is meant to be installed on its own.",
  },
};

export default en;
