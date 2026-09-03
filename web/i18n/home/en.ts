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
    title: "Ship without babysitting coding agents.",
    lead: "AI4Kanban turns rough ideas into build-ready work, runs it through your agents, and asks only for product decisions.",
    ctaDownload: "Download",
    ctaGithub: "View on GitHub ↗",
    shots: {
      board: { label: "Board", alt: "AI4Kanban local board: Board view" },
      card: { label: "Card", alt: "AI4Kanban local board: a card and its spec" },
      frontAria: "{view} view (current)",
      flipAria: "Switch to {view} view",
    },
  },

  loop: {
    title: "Keep work moving",
    lead: "Give it a goal or a rough idea. The agent reads your code and project memory, determines what comes next, clarifies requirements, breaks the work down, orders dependencies and priorities, and moves into execution.",
    steps: [
      {
        title: "Define tasks and dependencies",
        body: "The agent breaks large goals into bounded cards, automatically deciding what can run in parallel and what must wait, so each task can be completed within its own context window.",
      },
      {
        title: "Clarify requirements",
        body: "The agent turns rough requirements into an actionable plan. It answers most questions from project memory and the codebase, leaving only taste, business direction, risk, and cost for human judgment.",
      },
      {
        title: "Execute",
        body: "Run ready tasks in parallel across multiple agents. Each delivery uses its own Git worktree to isolate changes, and conflicts trigger a dedicated resolution pass before landing.",
      },
      {
        title: "Settle key decisions before implementation",
        body: "Create your own Spec Skills or use the built-ins: a technology-selection skill compares technical options, while a UI-design skill gives you multiple working mockups to choose from.",
      },
      {
        title: "Request approval only when necessary",
        body: "AI4Kanban keeps work moving in the background and reports back only for product decisions and delivery approval. Like a project manager, it keeps demands on your attention to a minimum.",
      },
    ],
  },

  memory: {
    title: "Learns as you build",
    lead: "Conversations end. Product decisions stay. AI4Kanban saves your project goals and keeps a module-by-module record of shipped features, product decisions, reasons behind rejected ideas, and design lessons. It brings that context back when planning and clarifying new work.",
    cards: [
      {
        title: "No need to repeat yourself",
        body: "Established preferences and constraints carry straight into planning the next task.",
      },
      {
        title: "Avoid the same dead ends",
        body: "Rejected directions and known design problems are not proposed again.",
      },
      {
        title: "Pick up where you left off",
        body: "Before planning new work, it reads what has already shipped and checks the current code.",
      },
    ],
    tree: {
      goal: "Project goal",
      module: "One per module",
      readme: "Shipped features",
      decisions: "Product decisions",
      rejected: "Reasons for rejection",
      redesign: "Design lessons",
    },
  },

  iterate: {
    title: "Drive continuous product iteration",
    lead: "Turn external signals into requirements that keep the product — and each release — moving forward.",
    inputsLabel: "External inputs",
    inputs: [
      "User feedback",
      "Competitor research",
      "Industry reports",
      "Reddit discussions",
    ],
    internalLabel: "Internal inputs",
    internal: ["Product roadmap"],
    board: {
      columns: ["Ready to build", "Not ready"],
      ready: "ready",
    },
    storage: "Project data",
    outputsLabel: "Iteration outcomes",
    outputs: ["Product improvements", "Release iterations"],
  },

  start: {
    title: "Start with the desktop app",
    lead: "Download the app, open a project, and answer three questions. It reads the codebase, writes the project goal and module memory, and proposes the first tasks.",
    notes: ["Autonomous planning", "Local-first", "Agent-agnostic"],
    cta: "Download",
    firstOpen:
      "Builds are unsigned, so macOS blocks the first open: drag the app in from the `.dmg`, then click through the warning. The download page has the full steps for macOS, Windows, and Linux.",
    command:
      "The app includes the `akb` CLI and adds the coding-agent skills when you open a project. Neither is meant to be installed on its own.",
  },
};

export default en;
