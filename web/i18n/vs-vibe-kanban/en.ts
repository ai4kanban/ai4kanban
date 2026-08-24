// English copy for the Vibe Kanban comparison — the source of truth the other four
// languages mirror key for key. Writing rules: `i18n/index.ts`.
import type { VsVibeCopy } from "./types";

const en: VsVibeCopy = {
  meta: {
    title: "AI4Kanban vs. Vibe Kanban — planning workflow or multi-agent workspace?",
    socialTitle: "AI4Kanban vs. Vibe Kanban",
    description:
      "Bloop closed in April 2026, but Vibe Kanban continues as a community-maintained open-source project. Compare its multi-agent workspace with AI4Kanban's file-based planning workflow.",
    social:
      "AI4Kanban and Vibe Kanban solve different problems: planning work in your repository versus running and reviewing multiple coding agents.",
  },
  hero: {
    badge: "Comparison",
    title: "AI4Kanban vs.\nVibe Kanban",
    lead: "Vibe Kanban runs and reviews multiple coding agents in parallel. AI4Kanban helps one agent turn ideas into well-defined work, using plain Markdown in your repository. The products overlap at the board, but they are designed for different stages of the development process.",
    ours: {
      name: "AI4Kanban",
      body: "A file-based workflow for planning and refining work with an agent.",
    },
    theirs: {
      name: "Vibe Kanban",
      body: "A local application for running and reviewing multiple agents.",
    },
    oursDiagramAlt:
      "One card crosses three columns getting more definite each time, until it says what done means and is ready for any coding agent.",
    theirsDiagramAlt:
      "One already-defined task is given to several agents at the same time, and several versions of the same work come back to be compared.",
    oursDiagramTop: "make the work definite before it runs",
    oursDiagramBottom: "then any coding agent can pick it up",
    theirsDiagramTop: "run one task with several agents at once",
    theirsDiagramBottom: "compare the results and keep the best one",
  },
  summary: {
    heading: {
      eyebrow: "The short version",
      title: "Bloop closed. Vibe Kanban continues.",
    },
    lead: "Bloop, the company behind Vibe Kanban, closed in April 2026. Paid subscriptions ended, remote services were retired, and the product moved to a fully local model. Vibe Kanban remains available under the Apache-2.0 license and is now maintained by its community.",
    panel:
      "Choose AI4Kanban if you want the **planning board** without a database or long-running application. Choose Vibe Kanban if you need to **run several agents in parallel** and review their output in one interface. AI4Kanban is not a replacement for Vibe Kanban's orchestration features.",
  },
  comparison: {
    heading: { eyebrow: "Head to head", title: "AI4Kanban vs. Vibe Kanban" },
    lead: "A {check} marks the stronger option for a specific requirement. A **dash** indicates a design choice rather than a clear advantage. AI4Kanban favors **planning and portability**; Vibe Kanban favors **parallel execution and integrated review**.",
    ourLabel: "AI4Kanban",
    theirLabel: "Vibe Kanban",
    rows: {
      whatFor: {
        dimension: "Primary purpose",
        kanban:
          "Define, refine, and organize work with an agent inside the repository.",
        vibe: "Run multiple coding agents in parallel and review their output.",
      },
      orchestration: {
        dimension: "Multi-agent orchestration",
        kanban: "Each delivery builds on a branch in a git worktree of its own, so several run side by side without touching your working copy.",
        vibe: "A core capability, with each agent isolated in its own git worktree.",
      },
      review: {
        dimension: "Review of agent output",
        kanban: "Handled by your agent, development environment, or code-review tools.",
        vibe: "Built in, with inline diffs, live previews, and pull-request workflows.",
      },
      planning: {
        dimension: "Planning and refinement",
        kanban: "A guided refinement loop turns an initial idea into an actionable task.",
        vibe: "Focused on queuing and tracking execution rather than refining requirements.",
      },
      onDisk: {
        dimension: "Data storage",
        kanban: "Plain Markdown stored and versioned with your repository.",
        vibe: "A local SQLite database in a config directory.",
      },
      runsAs: {
        dimension: "Runtime",
        kanban: "No service or application. The board consists of files.",
        vibe: "A local web application with a Rust backend and web interface.",
      },
      setup: {
        dimension: "Setup",
        kanban: "Install a skill file and a small helper script with one prompt.",
        vibe: "Run `npx vibe-kanban`, then install and authenticate each agent CLI.",
      },
      whichAgents: {
        dimension: "Agent compatibility",
        kanban:
          "Works with any agent that can read and write files in the repository.",
        vibe: "Supports integrated CLIs such as Claude Code, Codex, Gemini, and others.",
      },
      lockIn: {
        dimension: "Portability",
        kanban: "The Markdown board travels with the repository and needs no export.",
        vibe: "Self-hosted under Apache-2.0, with data export available.",
      },
      maintenance: {
        dimension: "Maintenance",
        kanban: "Actively maintained.",
        vibe: "Community-maintained since Bloop closed in April 2026.",
      },
    },
  },
  purpose: {
    heading: {
      eyebrow: "The real difference",
      title: "Plan the work or run the agents",
    },
    lead: "The products support different stages of the workflow. AI4Kanban helps you decide **what to build** and prepare the task. Vibe Kanban helps you **execute that work across multiple agents** and review the results.",
    ours: {
      name: "AI4Kanban — plan and refine",
      is: "Your agent reads and updates a Markdown board in the repository. A refinement loop develops an initial idea into a specific, reviewable task that you approve before implementation begins.",
      isnt: "It does not provide a diff viewer or pull-request workflow. Those responsibilities remain with your agent or development environment.",
    },
    theirs: {
      name: "Vibe Kanban — execute and review",
      is: "A local application that runs several coding agents concurrently in separate git worktrees. Its interface brings task execution, diff review, and live preview into one workspace.",
      isnt: "It is designed to manage agent runs, not to develop an incomplete idea into a detailed implementation plan.",
    },
    note: "If you primarily used Vibe Kanban to organize tasks, AI4Kanban offers a simpler, repository-native alternative. If parallel execution and integrated review matter most, Vibe Kanban remains the closer fit.",
  },
  wins: {
    heading: { eyebrow: "Trade-offs", title: "Where each one wins" },
    lead: "Neither product is universally better. AI4Kanban prioritizes a lightweight, portable planning workflow. Vibe Kanban prioritizes coordinated execution and review across multiple agents.",
    oursHeading: "AI4Kanban",
    theirsHeading: "Vibe Kanban",
    ours: {
      nothingRunning: {
        title: "No service to maintain",
        body: "The board is plain Markdown in your repository. There is no web application, database, or background service to operate.",
      },
      planning: {
        title: "Structured task refinement",
        body: "The refinement loop identifies missing details and turns a rough idea into a concrete task for approval before implementation begins.",
      },
      outlives: {
        title: "Portable by design",
        body: "Plans are stored in git alongside the code they describe. Clone the repository and the board comes with it, without a migration or export step.",
      },
      anyAgent: {
        title: "Works with any file-capable agent",
        body: "Any agent that can work with repository files can use the board, including Claude Code, Codex, Cursor, and future tools.",
      },
    },
    theirs: {
      parallel: {
        title: "Runs many agents at once",
        body: "Vibe Kanban distributes tasks across several coding agents, isolating each run in its own git branch and worktree.",
      },
      reviewInPlace: {
        title: "Execution and review in one place",
        body: "Inline diff review, live application previews, and pull-request workflows let you inspect agent output without leaving the workspace.",
      },
      boardUi: {
        title: "Purpose-built visual interface",
        body: "The web interface is designed for starting tasks, monitoring progress, and moving between workspaces while agents are running.",
      },
      support: {
        title: "Broad agent integrations",
        body: "Multiple agent CLIs are supported out of the box, including Claude Code, Codex, Gemini, and others.",
      },
    },
  },
  decision: {
    heading: { eyebrow: "The call", title: "Which should you use?" },
    oursHeading: "Choose AI4Kanban when",
    theirsHeading: "Choose Vibe Kanban when",
    ours: [
      "You want an agent to plan and refine work directly in the repository.",
      "You prefer Markdown in git to a separate application and database.",
      "You want the board to work with any file-capable coding agent.",
      "Clear requirements matter more to you than parallel execution.",
    ],
    theirs: [
      "You want to run several coding agents concurrently in isolated worktrees.",
      "You need inline diff review and live preview in one interface.",
      "Coordinating and reviewing agent runs is your primary bottleneck.",
      "You are comfortable using a community-maintained open-source project.",
    ],
    verdict:
      "Choose AI4Kanban for a **repository-native planning workflow** with no separate runtime. Choose Vibe Kanban for **multi-agent execution and integrated review**. The right choice depends on whether planning the work or coordinating its execution is the larger constraint.",
    note: "Bloop's closure changed how Vibe Kanban is maintained, but not the fundamental distinction between the two products.",
  },
};

export default en;
