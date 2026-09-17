// English copy for the landing page — the source of truth the other four
// languages mirror key for key. Writing rules: `i18n/index.ts`.
import type { HomeCopy } from "./types";

const en: HomeCopy = {
  meta: {
    title: "AI project management for agent teams | AI4Kanban",
    description:
      "Take on bigger projects with AI4Kanban. Your AI project manager assigns work to agents, tracks progress, and brings key decisions and results back to you.",
    schema:
      "AI4Kanban is an open-source, local-first AI project manager that helps solo founders, creators, and small teams tackle larger projects with an agent team. It assigns tasks, tracks progress, and reviews results in the development workflow. You set the direction, make key decisions, and give final approval. Product development and demo video workflows are built in; other work needs additional workflows and agents.",
  },

  hero: {
    title: "You set the direction. AI leads the team.",
    lead: "From product development to content marketing, your AI project manager leads your agents so you can take on bigger projects.",
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
    title: "Less managing. More shipping.",
    lead: "Hand over the planning, follow-ups, and coordination. Keep your attention on what the product should become.",
    steps: [
      {
        title: "Rough idea in. Detailed plan out.",
        body: "Describe what you want to build. AI4Kanban reads your code and project memory, fills in the requirements, and breaks the work into tasks with a clear order. You get a plan your agents can act on.",
      },
      {
        title: "Make a few choices before the build.",
        body: "The questions that need your judgment come with options and a recommendation. Choose the direction before coding starts, while changes are still cheap.",
      },
      {
        title: "Move more work forward at once.",
        body: "Independent tasks run in parallel across your agents, so one task finishing is no longer the cue to start the next. AI4Kanban handles dependencies and coordinates the work.",
      },
      {
        title: "Plan the way you think.",
        body: "Want a technical comparison or a working UI mockup before committing to a direction? Use the built-in spec agents or add your own, and let the board work through requirements using your approach.",
      },
      {
        title: "Agents handle the details. You sign off.",
        body: "Most details are settled from your code and past decisions. Work moves forward in the background, with product choices and delivery approvals brought back to you in the app or Slack.",
      },
      {
        title: "Decide what runs without you.",
        body: "Some jobs you start yourself: talk an idea through, tidy the board, correct a plan that missed. Reviewing chat memory is on from the start and runs daily. The rest wait until you switch them on — approving builds, answering open questions, suggesting what comes next. Each one takes the runtime, model, and instructions you give it.",
      },
    ],
  },

  memory: {
    title: "Understands you better as you build",
    lead: "Your preferences, decisions, and rejected ideas carry into the next plan. As project memory grows, your agents have more context to work from, and you have less to explain.",
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
      planner: "The planner's memory",
      readme: "Shipped features",
      decisions: "Product decisions",
      rejected: "Reasons for rejection",
      redesign: "Design lessons",
    },
  },

  iterate: {
    title: "Turn feedback into product improvements",
    lead: "User feedback, competitor research, and industry discussions can all inform what to build next. AI4Kanban turns those insights into tasks aligned with your product goals, ready for your agents to work on.",
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
    lead: "Download the app, open a project, and answer three questions. It reads the codebase, writes the project goal and the planner's memory, and proposes the first tasks.",
    notes: ["Autonomous planning", "Local-first", "Agent-agnostic"],
    cta: "Download",
    firstOpen:
      "Builds are unsigned, so macOS blocks the first open: drag the app in from the `.dmg`, then click through the warning. The download page has the full steps for macOS, Windows, and Linux.",
    command:
      "The app includes the `akb` CLI and adds the coding-agent skills when you open a project. Neither is meant to be installed on its own.",
  },
};

export default en;
