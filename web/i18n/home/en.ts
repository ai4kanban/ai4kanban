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
    ctaDownload: "Download the board app",
    ctaGithub: "View on GitHub ↗",
    shots: {
      board: { label: "Board", alt: "AI4Kanban local board: Board view" },
      card: { label: "Card", alt: "AI4Kanban local board: a card and its spec" },
      frontAria: "{view} view (current)",
      flipAria: "Switch to {view} view",
    },
  },

  compare: {
    title: "From task tracking to autonomous planning",
    lead: "Traditional boards only record and track tasks, and every input has to be written by hand. AI4Kanban uses your long-term goals and the decisions already in project memory to plan work and move it forward autonomously.",
    columns: { classic: "Traditional board", kanban: "AI4Kanban" },
    rows: [
      {
        dimension: "Input",
        classic: "Detailed tasks written by hand",
        kanban: "Long-term goals and rough ideas",
      },
      {
        dimension: "Primary role",
        classic: "Record and track tasks",
        kanban: "Plan and drive work autonomously",
      },
      {
        dimension: "Your role",
        classic: "Maintain the board by hand",
        kanban: "Make decisions and approve the result",
      },
    ],
  },

  loop: {
    title: "Keep work moving",
    lead: "Give it a goal or a rough idea. The agent reads your code and project memory, determines what comes next, clarifies requirements, breaks the work down, orders dependencies and priorities, and moves into execution.",
    steps: [
      {
        title: "Define the next task",
        body: "Use the goal, code, and module memory to determine what should happen next.",
      },
      {
        title: "Clarify requirements",
        body: "The agent resolves anything it can from the code and project memory, bringing you only the product tradeoffs that require your judgment.",
      },
      {
        title: "Execute",
        body: "Once the requirements are clear enough to begin, the agent follows the scope and steps defined in the task.",
      },
      {
        title: "Record decisions",
        body: "Write product decisions back to project memory so the next planning and development cycle can build on them.",
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
    context: [
      "Decision history",
      "Requirements and tasks",
      "Project modules",
      "Run history",
    ],
    otherAgents: "Other agents",
    storage: "Project data",
    outputsLabel: "Iteration outcomes",
    outputs: ["Product improvements", "Release iterations"],
  },

  start: {
    title: "Start with the board app",
    lead: "Download it, open it, point it at a project. Nothing to install first — no Node, no npx, no terminal. It asks the three things only you can answer, one to a screen, then reads your codebase, establishes the project goal and module memory, and creates the first set of tasks.",
    notes: ["Autonomous planning", "Local-first", "Agent-agnostic"],
    cta: "Download the app",
    firstOpen:
      "No build is signed yet, so macOS blocks the first open: drag the app in from the `.dmg`, then click through the warning that it cannot be checked. The download page has every step, and Windows and Linux.",
    terminal: {
      title: "Or set it up from a terminal",
      body: "One command, from your project root. It creates the board under `docs/kanban/` and writes nothing else.",
      promptNote:
        "Rather your coding agent did the whole thing? Give it the setup prompt: it reads the repo, picks the tracks, runs that command, and works down the rest of setup.",
      promptLink: "Read the setup prompt",
    },
  },
};

export default en;
