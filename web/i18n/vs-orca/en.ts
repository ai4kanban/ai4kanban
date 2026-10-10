import type { VsOrcaCopy } from "./types";

const en: VsOrcaCopy = {
  meta: {
    title: "AI4Kanban vs. Orca: delegate the details, keep control",
    socialTitle: "AI4Kanban vs. Orca",
    description:
      "Already running coding agents in parallel? Compare Orca with AI4Kanban: keep control of execution details, or let agents lead them while you set the direction.",
    social:
      "Orca adds a thin layer around coding agents. AI4Kanban gives you a ready-made team to lead execution details while you keep control of direction and key decisions.",
  },
  hero: {
    badge: "Comparison",
    title: "AI4Kanban vs. Orca",
    lead: "Already running several coding agents in parallel? Orca brings those sessions into one workspace. AI4Kanban goes further: agents lead the execution details while you set the direction and make the key decisions.",
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
    title: "AI4Kanban: you set the direction, agents handle the details",
    lead: "AI4Kanban is for people who are comfortable letting agents lead execution details while retaining control of direction and key decisions. Specialist agents, workflows and memory are ready to use, so you don't have to design agent roles or tune their prompts yourself. You discuss the plan and review key drafts; agents work out the details and carry the work through.",
    drafts: {
      title: "Review key drafts before execution",
      body: "Worried about AI taking too many liberties with a UI, prompt or piece of copy? Review a draft before approving execution. Drafts can be images, diagrams, HTML/TSX, diffs or storyboards. Draft review comes before implementation to confirm the direction; reviewing the delivered code still happens as usual.",
      art: ["Draft", "Approve", "Execution"],
    },
    memory: {
      title: "Carry decisions into the next task",
      body: "Each agent has a memory recipe for its own job, learning your preferences and decisions for that kind of task. Agents can share memory. After a main piece of work is finished, they suggest follow-ups to help fill gaps and catch omissions.",
      art: {
        agents: ["UI designer", "Copywriter"],
        shared: "Shared · project",
      },
    },
    custom: "You can also create your own agents and workflows.",
    tipLabel: "Tip",
    tip: "The software development workflow is free. Blog, social carousel, slide deck and product video workflows require Pro.",
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
        "Set the direction and make key decisions",
        "Review important drafts",
        "Let agents lead the execution details",
      ],
      goalLabel: "The goal",
      goal: "Another 10× gain in efficiency beyond parallel coding",
    },
  },
  start: {
    title: "Start with AI4Kanban",
    body: "Download AI4Kanban. Plan with precision, ship at speed.",
    cta: "Download AI4Kanban",
  },
};

export default en;
