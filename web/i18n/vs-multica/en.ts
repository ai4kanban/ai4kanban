import type { VsMulticaCopy } from "./types";

const en: VsMulticaCopy = {
  meta: {
    title:
      "AI4Kanban vs. Multica: AI project management or a multi-agent platform",
    socialTitle: "AI4Kanban vs. Multica",
    description:
      "AI4Kanban is a ready-to-use AI project-management system. Multica is a general platform for building and operating teams of agents.",
    social:
      "Both use agents to execute tasks, but they serve different needs: one manages projects; the other provides the platform for an agent team.",
  },
  hero: {
    badge: "Comparison",
    title: "AI4Kanban vs.\nMultica",
    lead: "Both products let agents execute tasks. **AI4Kanban is a ready-to-use AI project-management system; Multica is a general-purpose multi-agent platform.**",
    ours: {
      name: "AI4Kanban",
      body: "People set direction, bring ideas, and make the key calls. Agents discover work, clarify requirements, set priorities, execute tasks, and feed what they learn back into project memory.",
    },
    theirs: {
      name: "Multica",
      body: "You create multiple agents, give each one responsibilities, Skills, and a runtime, then manage assignments, execution, retries, reviews, and team collaboration in one place.",
    },
    oursDiagramAlt:
      "You say what you want and the board plans and runs the work itself; there is no agent to create, name or dispatch.",
    theirsDiagramAlt:
      "Multica ships the platform but not the team: you create each agent yourself, and every run comes back to you to assign, watch and retry.",
    oursDiagramTop: "you say what you want built",
    oursDiagramBottom:
      "the board plans and runs it — no agents to set up",
    theirsDiagramTop: "you create every agent yourself",
    theirsDiagramBottom: "then you assign, watch and retry each run",
  },
  boundary: {
    heading: {
      eyebrow: "Positioning",
      title: "Two products for two different needs",
    },
    lead: "AI4Kanban helps people and AI manage a project together. Multica helps teams create, organize, and run multiple agents.",
    stages: {
      discover: "Set direction",
      refine: "Clarify with AI",
      prioritize: "Drive progress",
      assign: "Create agents",
      run: "Configure teams",
      review: "Operate work",
    },
    oursLabel: "AI4Kanban",
    theirsLabel: "Multica",
    oursJob: "Manages the project",
    theirsJob: "Runs the agents",
  },
  backlog: {
    heading: {
      eyebrow: "Out of the box",
      title: "What is in each box?",
    },
    lead: "Both are complete on day one, but they are complete at different things. AI4Kanban ships the project management; Multica ships the machinery to run agents.",
    ours: {
      label: "AI4Kanban",
      title: "Project management, ready to run",
      items: [
        "A working method for people and AI",
        "A board with the full card lifecycle",
        "Project memory kept in the repository",
      ],
    },
    theirs: {
      label: "Multica",
      title: "Agent infrastructure, ready to run",
      items: [
        "Agent identities, Instructions, and Skills",
        "Squads, chat, and task queues",
        "Automation, retries, and run history",
      ],
    },
  },
  comparison: {
    heading: {
      eyebrow: "Key differences",
      title: "What matters most",
    },
    lead: "A {check} marks the stronger fit for that need; a **dash** marks a trade-off.",
    ourLabel: "AI4Kanban",
    theirLabel: "Multica",
    rows: {
      startingPoint: {
        dimension: "Product focus",
        kanban:
          "A complete project-management workflow for people and AI, ready to use.",
        multica:
          "A general workspace for multi-agent teams; users define the roles and workflows.",
      },
      backlog: {
        dimension: "Proactive project management",
        kanban:
          "Agents read the project and its memory, then propose, refine, and prioritize work.",
        multica:
          "Possible with Agents, Skills, and Autopilots, but you configure the behavior yourself.",
      },
      refinement: {
        dimension: "Requirement clarification",
        kanban:
          "Uses the code and project record to fill in context, leaving only product trade-offs for people.",
        multica:
          "No ready-made project-clarification workflow; you add one through Agent Instructions or a Skill.",
      },
      memory: {
        dimension: "Long-term memory",
        kanban:
          "Project decisions, rejection reasons, and redesign lessons feed directly into future planning.",
        multica:
          "Skills preserve working methods; comments and run history preserve the execution record.",
      },
      execution: {
        dimension: "Execution management",
        kanban:
          "Can launch Claude Code or Codex on a card and track the full lifecycle from proposal to archive.",
        multica:
          "Runs multiple agents in parallel, with queues, retries, replay, cost tracking, review gates, and PR and CI links.",
      },
      teams: {
        dimension: "Team collaboration",
        kanban:
          "Local-first, for individual developers and small teams collaborating through git.",
        multica:
          "Multi-user workspaces, roles, Squads, comments, permissions, and notifications.",
      },
      storage: {
        dimension: "Deployment and storage",
        kanban:
          "Cards and memory live in the repository; no database, account, or board server.",
        multica:
          "Uses PostgreSQL, a server, and a local daemon; available hosted or self-hosted.",
      },
      license: {
        dimension: "License",
        kanban:
          "Apache-2.0, including commercial use, hosting, and embedding.",
        multica:
          "Source-available; hosted services and commercial embedding are restricted by the Multica License.",
      },
    },
  },
  memory: {
    heading: {
      eyebrow: "Long-term memory",
      title: "They remember different things",
    },
    lead: "Both keep notes between runs. They keep different notes.",
    ours: {
      eyebrow: "Project judgment",
      title: "Why a decision was made",
      examples: ["decisions.md", "rejected.md", "redesign.md"],
      question: "Why did the board stop proposing idea X?",
      answer:
        "`rejected.md` records why it was rejected. Without new evidence, the idea stays out.",
    },
    theirs: {
      eyebrow: "Working method",
      title: "How an agent should work",
      examples: ["Instructions", "SKILL.md", "run history"],
      question: "How should this agent run a security review?",
      answer:
        "Attach a Skill with the steps, files, and requirements for the review.",
    },
    note: "",
  },
  horizon: {
    heading: {
      eyebrow: "Build it yourself",
      title: "What would you need to add in Multica?",
    },
    lead: "You can build a project-manager agent on Multica. Creating the agent is the quick part; four questions are then yours to answer, and to keep answering as the project changes.",
    visionLabel: "You still build",
    visionTitle: "The project-management behavior",
    items: [
      "How it understands the project goal",
      "How it finds work worth doing",
      "How it clarifies a vague requirement",
      "What it remembers between runs",
    ],
    note: "",
  },
  wins: {
    heading: {
      eyebrow: "Strengths",
      title: "Choose for the problem you have",
    },
    lead: "AI4Kanban is focused, complete, and ready to use. Multica is broad and flexible, built to operate multiple agents.",
    oursHeading: "AI4Kanban",
    theirsHeading: "Multica",
    ours: {
      upstream: {
        title: "Project management out of the box",
        body: "No need to design a project-manager Agent first. Once installed, people and agents can plan, clarify, and execute through one shared workflow.",
      },
      rejectionMemory: {
        title: "Rejected ideas stay rejected",
        body: "Past decisions shape the next planning cycle and reduce repeated discussion.",
      },
      repoNative: {
        title: "Everything lives in git",
        body: "Cards and memory are readable and diffable, with no separate board service to run.",
      },
    },
    theirs: {
      operations: {
        title: "Full execution control",
        body: "Queues, retries, replay, reviews, cost tracking, and PR and CI links are all built in.",
      },
      teams: {
        title: "Built for people and multiple agents",
        body: "Workspaces, roles, Squads, comments, permissions, and notifications live in one platform.",
      },
      runtimeReach: {
        title: "Broader runtime support",
        body: "A local daemon connects many agent CLIs. AI4Kanban currently supports Claude Code and Codex.",
      },
    },
  },
  decision: {
    heading: { eyebrow: "Recommendation", title: "Which should you choose?" },
    oursHeading: "Choose AI4Kanban if you",
    theirsHeading: "Choose Multica if you",
    ours: [
      "Want a ready-made way for people and AI to manage a project together.",
      "Need agents across planning, clarification, and execution.",
      "Want project decisions and rejection reasons to shape future planning.",
      "Prefer a lightweight, repository-native system with no extra service.",
    ],
    theirs: [
      "Need to create and operate several agents with different roles.",
      "Need a shared workspace, issues, and run history for people and agents.",
      "Need retries, replay, cost tracking, or PR and CI integrations.",
      "Are prepared to define your own project-management Agent, Skills, and workflows.",
    ],
    verdict:
      "Choose AI4Kanban for a **ready-to-use AI project-management system**. Choose Multica for a **general platform to build and operate a multi-agent team**. Both use agents to execute tasks; one is for project management, the other for multi-agent operations.",
    note: "",
  },
};

export default en;
