import type { VsOrcaCopy } from "./types";

const en: VsOrcaCopy = {
  meta: {
    title: "AI4Kanban vs. Orca: review drafts, hand off the details",
    socialTitle: "AI4Kanban vs. Orca",
    description:
      "Compare AI4Kanban and Orca on session control, specialist workflows, draft review and the work needed to coordinate execution.",
    social:
      "Compare AI4Kanban and Orca on session control, specialist workflows, draft review and the work needed to coordinate execution.",
  },
  hero: {
    badge: "Comparison",
    title: "AI4Kanban vs. Orca",
    lead: "Compare AI4Kanban and Orca on session control, specialist workflows, draft review and the work needed to coordinate execution.",
  },
  both: {
    title: "What both support",
    items: [
      "Multiple coding agents",
      "Parallel sessions",
      "Isolated Git worktrees",
      "Code diff review",
    ],
  },
  orca: {
    title: "Orca: a thin layer around coding agents",
    intro:
      "Orca adds a thin layer around coding agents, bringing parallel sessions, terminals, worktrees, editing and review into one workspace while preserving the experience of using those agents.",
    introLink: "Explore Orca",
    introEnd: ".",
    body: [
      "It suits users who want to direct individual agent sessions and stay involved in execution details, from assigning tasks to reviewing and merging changes. How much autonomy each agent has is still up to you.",
      "Its CLI orchestration provides tasks, dispatch and approval gates. You or your coordinating agent write the task specifications and define the process.",
    ],
  },
  codex: {
    title: "Already in the Codex desktop app",
    lead: "Some of what Orca adds is already in coding tools such as the Codex desktop app.",
    items: [
      "Parallel sessions and worktrees",
      "Diff and PR review",
      "Browser",
      "Mobile control and SSH",
    ],
    agents:
      "Codex runs OpenAI's models; Orca runs Codex, Claude Code and other CLI coding agents.",
    sources: {
      worktrees: "Codex worktrees",
      review: "Code review",
      browser: "Browser",
      remote: "Remote connections",
      orcaFeatures: "Orca features",
    },
  },
  compare: {
    yes: "Included",
    no: "Not included",
    rows: {
      planning: "Agents plan each task with you and ask only for key decisions",
      team: "Ready-made specialist agents and workflows",
      drafts: "Draft review before execution: images, HTML/TSX, storyboards",
      memory: "Memory of your preferences, shared across agents",
      tools: "Built-in browser, SSH and mobile control",
    },
  },
  ours: {
    title: "AI4Kanban: review the drafts, hand off the details",
    lead: "Specialist agents prepare the UI, copy or script you need to review. After you approve those key parts, the workflow carries the task through. Coding, blog and video workflows are built in; independent tasks can run in parallel.",
    drafts: {
      title: "Review key drafts before execution",
      body: "Parts that need your judgment get a draft first. Review and edit it on the card; agents build from the approved version and handle the remaining details within the agreed scope. Catch changes here to reduce rework later.",
      art: ["Draft", "Approve", "Execution"],
    },
    memory: {
      title: "Carry decisions into the next task",
      body: "Each agent remembers preferences and decisions relevant to its work and can share project context with other agents. Later tasks build on what you have already agreed. After a main piece of work is complete, agents suggest follow-ups for you to accept, revise or reject.",
      art: {
        agents: ["UI designer", "Copywriter"],
        shared: "Shared · project",
      },
    },
    custom: "You can also create your own agents and workflows.",
    tipLabel: "Tip",
    tip: "The software development workflow is free. Blog, social carousel, slide deck, product video and video clone workflows require Pro.",
  },
  decision: {
    title: "Which way do you want to work?",
    ifYou: "if you want to",
    theirs: {
      name: "Choose Orca",
      points: [
        "Manage each coding-agent session yourself",
        "Stay closely involved in execution details",
      ],
      onlyLabel: "Only in Orca",
      only: [
        "Browser",
        "SSH remote work",
        "Mobile control",
        "One prompt to several agents",
      ],
      link: "See Orca's features",
    },
    ours: {
      name: "Choose AI4Kanban",
      points: [
        "Get ready-to-use specialist agents and workflows for coding, blogs and videos",
        "Change key details in a draft before agents complete the work",
        "Have agents reuse your preferences so later tasks need fewer corrections",
      ],
      goalLabel: "The goal",
      goal: "Move development and marketing forward together, with less rework",
    },
  },
  start: {
    title: "Start with AI4Kanban",
    body: "Download AI4Kanban. Plan with precision, ship at speed.",
    cta: "Download AI4Kanban",
  },
};

export default en;
