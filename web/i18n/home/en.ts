// English copy for the landing page — the source of truth the other four
// languages mirror key for key. Writing rules: `i18n/index.ts`.
import type { HomeCopy } from "./types";

const en: HomeCopy = {
  meta: {
    title:
      "AI4Kanban — The project board that plans autonomously and learns from every decision",
    description:
      "An agent-led project board that turns project goals into continuous execution — defining tasks, clarifying requirements, setting priorities, and preserving every product decision in project memory.",
  },

  hero: {
    title: "A project board that plans itself.",
    lead: "It brings your goals, code, and project memory together to manage work from planning through completion. You make the product calls and give final approval.",
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
        body: "Use the goal, code, and module memory to determine what comes next, then split large goals into bounded cards whose explicit dependencies decide what runs in parallel and what waits.",
      },
      {
        title: "Clarify requirements",
        body: "The agent resolves anything it can from the code and project memory, bringing you only the product tradeoffs that require your judgment.",
      },
      {
        title: "Execute",
        body: "Once the requirements are clear enough to begin, the agent follows the scope and steps defined in the task. Ten or more development tasks can share one board; each delivery uses its own Git worktree, and conflicts trigger a dedicated resolution pass before landing.",
      },
      {
        title: "Settle key decisions before implementation",
        body: "Spec Agents inspect the code and research external dependencies before implementation. For UI changes, they can place several working mockups on the card so you choose the direction before code is written.",
      },
      {
        title: "Request approval only when necessary",
        body: "Agents continue clarifying requirements and implementing work in the background. AI4Kanban sends a card notification only when a product decision or acceptance review requires confirmation; once confirmed, the task resumes on its project machine and proceeds through delivery.",
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
    lead: "Download the app, open it, and select a project. It asks three questions, one per screen, then reads the codebase, establishes the project goal and module memory, and creates the first tasks.",
    notes: ["Autonomous planning", "Local-first", "Agent-agnostic"],
    cta: "Download",
    firstOpen:
      "Builds are unsigned, so macOS blocks the first open: drag the app in from the `.dmg`, then click through the warning. The download page has the full steps for macOS, Windows, and Linux.",
    command:
      "The app includes the `akb` CLI and adds the coding-agent skills when you open a project. Neither is meant to be installed on its own.",
  },
};

export default en;
