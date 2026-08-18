// English copy for the Linear comparison — the source of truth the other four
// languages mirror key for key. Writing rules: `i18n/index.ts`.
import type { VsLinearCopy } from "./types";

const en: VsLinearCopy = {
  meta: {
    title: "AI4Kanban vs. Linear — repository planning or team coordination",
    socialTitle: "AI4Kanban vs. Linear",
    description:
      "Compare AI4Kanban and Linear: a repository-native planning system for coding agents versus a collaborative product-development platform for teams and agents.",
    social:
      "Linear coordinates work across an organization. AI4Kanban turns rough requests into build-ready plans inside the repository. See which model fits your workflow.",
  },
  hero: {
    badge: "Comparison",
    title: "AI4Kanban vs.\nLinear",
    lead: "Linear gives teams a shared system for planning and delivering product work. AI4Kanban gives a coding agent a planning system inside the repository. One coordinates an organization; the other turns rough requests into build-ready work without separating the plan from the code.",
    ours: {
      name: "AI4Kanban",
      body: "A Markdown board in the repository, built around agent-led refinement.",
    },
    theirs: {
      name: "Linear",
      body: "A hosted workspace where people and agents coordinate product work.",
    },
    oursDiagramAlt:
      "A vague note goes into AI4Kanban and comes out as a spec with its acceptance criteria written down, stored next to the code.",
    theirsDiagramAlt:
      "A team's work goes into Linear and comes out as one shared list showing who owns each item and where it stands.",
    oursDiagramTop: "a vague idea in",
    oursDiagramBottom: "a spec you can build, next to the code",
    theirsDiagramTop: "a whole team’s work in",
    theirsDiagramBottom:
      "one shared list: who has what, and where it stands",
  },
  summary: {
    heading: {
      eyebrow: "The short version",
      title: "Both support agents. They organize work at different levels.",
    },
    lead: "Linear is a comprehensive product-development platform. Its agents can use workspace context, delegated issues can be sent to coding agents, external agents can connect through MCP, and Coding Sessions can run Claude Code or Codex and return a pull request for review.",
    panel:
      "AI4Kanban serves a more focused need: **planning with a coding agent inside the repository**. It turns an incomplete request into explicit questions, decisions, dependencies, and a build-ready card. The plan and its history remain reviewable Markdown beside the code.",
  },
  comparison: {
    heading: { eyebrow: "Head to head", title: "AI4Kanban vs. Linear" },
    lead: "A {check} marks the stronger option for a particular need; a **dash** means the answer depends on your workflow. Linear is stronger for **team coordination, portfolio planning, integrations, and managed agent execution**. AI4Kanban is stronger for **repository-native refinement, portability, and planning history in git**.",
    ourLabel: "AI4Kanban",
    theirLabel: "Linear",
    rows: {
      bestFit: {
        dimension: "Best fit",
        kanban: "Solo developers and small teams that plan and deliver work through a coding agent.",
        linear: "Product and engineering organizations coordinating people, projects, and agents.",
      },
      sourceOfTruth: {
        dimension: "Where the plan lives",
        kanban: "Markdown in the project repository, versioned alongside the code.",
        linear: "A shared Linear workspace accessed through its apps, API, and MCP server.",
      },
      refinement: {
        dimension: "From rough idea to ready task",
        kanban: "A guided refinement loop investigates the request, records decisions, and stops when the card is specific enough to implement.",
        linear: "Linear Agent can draft, summarize, update, and scope issues; coding results still depend on the quality of the issue.",
      },
      agentModel: {
        dimension: "Agent model",
        kanban: "Your coding harness reads and writes the board; Claude Code, Codex, Cursor, and OpenCode are supported today.",
        linear: "Linear Agent, installable app users, delegated issues, agent guidance, and a hosted MCP server.",
      },
      execution: {
        dimension: "Coding and review",
        kanban: "Your chosen harness implements the ready card; review remains in your existing git workflow.",
        linear: "Coding Sessions run Claude Code or Codex in the cloud, open a pull request, and bring diffs and review into Linear.",
      },
      collaboration: {
        dimension: "Human collaboration",
        kanban: "Well suited to git-based collaboration in a small team; not designed for many people editing the board at once.",
        linear: "A real-time workspace with assignees, comments, private teams, guests, notifications, and permissions.",
      },
      portfolio: {
        dimension: "Planning breadth",
        kanban: "Cards, dependencies, priorities, ROI, releases, and module-level planning memory.",
        linear: "Issues, projects, cycles, initiatives, milestones, timelines, triage, insights, and customer requests.",
      },
      setup: {
        dimension: "Getting started",
        kanban: "Install it in a repository with one prompt; the board needs no account, database, or hosted service.",
        linear: "Create a workspace, invite the team, and configure integrations and agent access as needed.",
      },
      portability: {
        dimension: "Portability",
        kanban: "Clone the repository and the board, decisions, and history come with it. The planning surface also works offline.",
        linear: "Data lives in Linear; administrators can export issue data as CSV or retrieve it through the API.",
      },
      pricing: {
        dimension: "Price",
        kanban: "Open source under Apache-2.0; you pay only for the coding-agent tools you choose.",
        linear: "Free includes 250 issues and 2 teams. Basic is $10 per user per month billed annually; Business is $16. Coding Sessions consume AI credits.",
      },
    },
  },
  model: {
    heading: {
      eyebrow: "The real difference",
      title: "Repository context vs. organizational context",
    },
    lead: "The central question is not whether the product supports agents. It is **where planning context should live**: with the code in the repository, or in a shared workspace for the organization.",
    ours: {
      name: "AI4Kanban — planning stays with the code",
      is: "Before changing the plan, the agent reads the code, earlier decisions, rejected approaches, and completed work. It refines the request until open questions are resolved or clearly assigned to you.",
      isnt: "It is not an organization-wide collaboration suite. Its value is durable planning context that is committed with the code and available in every clone.",
    },
    theirs: {
      name: "Linear — one workspace for the organization",
      is: "Issues belong to teams, projects can span teams, and cycles, initiatives, timelines, documents, comments, and customer requests create shared context. Agents work within the same permissioned workspace.",
      isnt: "That breadth can be unnecessary for a solo developer whose main challenge is turning a rough request into a dependable implementation plan.",
    },
    note: "The two can coexist, but one system must remain authoritative for task status. For a solo developer, maintaining the same work in two places usually adds more process than value.",
  },
  wins: {
    heading: { eyebrow: "Trade-offs", title: "Where each one wins" },
    lead: "Linear provides breadth, coordination, and managed execution. AI4Kanban keeps agent-led planning close to the code, easy to inspect, and available across sessions.",
    oursHeading: "AI4Kanban",
    theirsHeading: "Linear",
    ours: {
      roughToReady: {
        title: "Refines rough requests into ready work",
        body: "The agent investigates, asks questions, records decisions, and splits the work before treating the card as an implementation plan.",
      },
      repoMemory: {
        title: "Keeps planning history beside the code",
        body: "Decisions, rejected approaches, dependencies, and cards are plain, diffable files that the next agent session can read.",
      },
      anyHarness: {
        title: "Works with your coding harness",
        body: "The board is not tied to a proprietary agent runtime. Claude Code, Codex, Cursor, and OpenCode are supported today, and the open file format can work with other harnesses.",
      },
      noSaas: {
        title: "Requires no project-management service",
        body: "The board itself has no workspace, seats, authentication, database, or synchronization layer to administer. It is simply part of the repository.",
      },
    },
    theirs: {
      teamSystem: {
        title: "Built for collaborative teams",
        body: "Concurrent editing, clear ownership, permissions, comments, private teams, guests, notifications, and a polished interface are all built in.",
      },
      agentPlatform: {
        title: "Provides managed agents and execution",
        body: "Linear Agent, app users, MCP, delegated issues, Coding Sessions, diffs, and pull-request review all share the same workspace context.",
      },
      planningDepth: {
        title: "Supports product planning at scale",
        body: "Projects, cycles, initiatives, milestones, timelines, triage, insights, and customer requests support planning far beyond a single repository.",
      },
      integrations: {
        title: "Connects work across the organization",
        body: "GitHub, GitLab, Slack, Teams, support tools, APIs, webhooks, and workspace search connect planning to the rest of the organization.",
      },
    },
  },
  decision: {
    heading: { eyebrow: "The decision", title: "Which one fits your workflow?" },
    oursHeading: "Choose AI4Kanban when",
    theirsHeading: "Choose Linear when",
    ours: [
      "A solo developer or small team plans and delivers work through a coding agent.",
      "Requests often begin incomplete, and turning them into reliable plans is the bottleneck.",
      "You want tasks, decisions, and planning history versioned beside the code.",
      "You want to choose your coding harness instead of adopting a project tool's runtime.",
    ],
    theirs: [
      "Many people need to create, assign, discuss, and update work concurrently.",
      "Your planning depends on cycles, initiatives, timelines, triage, customer requests, or reporting.",
      "You want managed cloud coding sessions and diff review inside the project workspace.",
      "You need organization-wide integrations, permissions, security controls, and support.",
    ],
    verdict:
      "Choose Linear when the difficult part is coordinating people, projects, and agents across an organization. Choose AI4Kanban when the difficult part is giving a coding agent enough durable context to turn an incomplete request into reliable work. The deciding factor is not the length of the feature list; it is where your planning process needs to live.",
    note: "AI4Kanban is an alternative planning model, not a feature-for-feature replacement for Linear.",
  },
};

export default en;
