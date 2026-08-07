// English copy for the GitHub Issues comparison — the source of truth the other four
// languages mirror key for key. Writing rules: `i18n/index.ts`.
import type { VsGithubCopy } from "./types";

const en: VsGithubCopy = {
  meta: {
    title: "AI4Kanban vs. GitHub Issues: Local agent board or team tracker?",
    socialTitle: "AI4Kanban vs. GitHub Issues",
    description:
      "Compare AI4Kanban and GitHub Issues across storage, agent overhead, team coordination, history, and external participation.",
    social:
      "AI4Kanban favors direct local work with an agent. GitHub Issues favors coordination across a team or community.",
  },
  hero: {
    badge: "Comparison",
    title: "AI4Kanban vs.\nGitHub Issues",
    lead: "AI4Kanban and GitHub Issues solve different coordination problems. AI4Kanban gives a developer and an agent a board inside the repository. GitHub Issues gives a team or community a shared service for tracking and discussing work. Choose based on whether your daily work depends more on fast local execution or coordination across people.",
    ours: {
      name: "AI4Kanban",
      body: "A Markdown board stored with the code, where an agent can read and update tasks directly.",
    },
    theirs: {
      name: "GitHub Issues",
      body: "A hosted task system for sharing work, discussion, and status across a team or community.",
    },
  },
  comparison: {
    heading: {
      eyebrow: "Core comparison",
      title: "Local workspace or shared service?",
    },
    lead: "The underlying difference is where the board lives. That choice determines the cost of agent access, how concurrent work is coordinated, what history is retained, and how outsiders participate.",
    ourLabel: "AI4Kanban",
    theirLabel: "GitHub Issues",
    rows: {
      storage: {
        dimension: "Where the work lives",
        kanban:
          "The board is stored as Markdown in the repository. An agent can read and update it directly, including offline.",
        issues:
          "Tasks are hosted by GitHub. Agent access requires a network connection and the `gh` CLI or MCP.",
      },
      tokenCost: {
        dimension: "Agent overhead",
        kanban:
          "Local search can return only the relevant text, keeping context use and response time low.",
        issues:
          "Remote operations also involve tool definitions, JSON responses, and network round trips, which usually use more tokens.",
      },
      concurrency: {
        dimension: "Concurrent collaboration",
        kanban:
          "There is no coordinating server, so two people can create the same task number and produce a conflict.",
        issues:
          "The server assigns IDs and synchronizes updates, making concurrent work safe for a team.",
      },
      history: {
        dimension: "What history is kept",
        kanban:
          "It retains decisions and outcomes that affect future work, while older detail is summarized.",
        issues:
          "It preserves the full record of comments, edits, cross-references, and activity.",
      },
      contributors: {
        dimension: "External participation",
        kanban:
          "Contributors need repository access and participate by changing Markdown files.",
        issues:
          "On a public repository, anyone can open an issue, comment, or react without submitting code.",
      },
    },
  },
  decision: {
    heading: {
      eyebrow: "How to choose",
      title: "Which tool fits your workflow?",
    },
    oursHeading: "AI4Kanban is a better fit when",
    theirsHeading: "GitHub Issues is a better fit when",
    ours: [
      "You work alone or with one or two regular collaborators.",
      "You rely on an agent in the terminal to move tasks forward.",
      "You value fast execution and concise decision context over a complete activity log.",
      "You want the board to stay in Git, work offline, and move with the repository.",
    ],
    theirs: [
      "Several people need to assign and update tasks at the same time.",
      "The project is developed in public and process transparency matters.",
      "Your workflow depends on pull requests, CI, projects, milestones, or automation.",
      "You want outside contributors to file issues and join discussions.",
    ],
    verdict:
      "The tools are not direct substitutes. GitHub Issues is a **shared task system for a team or community**; AI4Kanban is a **local working board an agent can operate directly**. Choose GitHub Issues when team coordination is the bottleneck. Choose AI4Kanban when the bottleneck is how efficiently you and an agent can move work forward.",
    note: "They can also work together: use GitHub Issues for team-facing or public work, and AI4Kanban as the agent’s local workspace.",
  },
};

export default en;
