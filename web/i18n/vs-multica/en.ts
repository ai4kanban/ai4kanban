import type { VsMulticaCopy } from "./types";

const en: VsMulticaCopy = {
  meta: {
    title:
      "AI4Kanban vs. Multica — deciding the work or operating the agent fleet",
    socialTitle: "AI4Kanban vs. Multica",
    description:
      "Compare AI4Kanban and Multica across task discovery, refinement, decision memory, agent execution, teams, infrastructure, and licensing.",
    social:
      "Both put coding agents on a kanban board. AI4Kanban decides which work should exist; Multica decides which agent runs the work.",
  },
  hero: {
    badge: "Comparison",
    title: "AI4Kanban vs.\nMultica",
    lead: "Both products put coding agents on a kanban board. The real boundary is **when the agent enters the story**: AI4Kanban works upstream to decide and refine the task; Multica takes an issue that already exists and operates the run.",
    ours: {
      name: "AI4Kanban",
      body: "A planning loop in your repository. The agent proposes work, develops vague ideas, orders the board, and remembers earlier decisions.",
    },
    theirs: {
      name: "Multica",
      body: "A project-operations system for human and agent teams. Assign an issue, then queue, dispatch, observe, retry, and review the run.",
    },
    oursDiagramAlt:
      "AI4Kanban reads the project and turns an emerging idea into a ready card.",
    theirsDiagramAlt:
      "Multica takes a ready issue and dispatches it to an agent runtime.",
    oursDiagramTop: "read project · find work",
    oursDiagramBottom: "vague idea → ready card",
    theirsDiagramTop: "ready issue + assignee",
    theirsDiagramBottom: "dispatch · run · review",
  },
  boundary: {
    heading: {
      eyebrow: "The dividing line",
      title: "Same board. Opposite sides of ready.",
    },
    lead: "A kanban board is only the surface. AI4Kanban concentrates on the decisions **before a task is ready**. Multica concentrates on the machinery **after a task is ready**. The products can meet at the handoff without being the same system.",
    stages: {
      discover: "Discover",
      refine: "Refine",
      prioritize: "Prioritize",
      assign: "Assign",
      run: "Run",
      review: "Review",
    },
    oursLabel: "AI4Kanban · decide the work",
    theirsLabel: "Multica · operate the work",
    handoffLabel: "ready",
    principle:
      "**Multica decides which agent runs a task. AI4Kanban decides which tasks should exist.** That is the shortest useful answer to “aren't these the same idea?”",
  },
  backlog: {
    heading: {
      eyebrow: "The backlog test",
      title: "What happens before Todo?",
    },
    lead: "Multica's own task model makes the boundary concrete: an issue in **Backlog does not trigger an agent**. It is a parking lot until a person decides the work is real and moves it forward. In AI4Kanban, the unready board is where the agent does its planning work.",
    ours: {
      label: "Backlog is active",
      title: "The agent develops the card",
      body: "The agent reads the code and module memory before it treats the request as work.",
      steps: [
        "Propose or capture an incomplete idea",
        "Resolve context and expose real decisions",
        "Order a build-ready card by value and dependency",
      ],
      state: "agent awake",
    },
    theirs: {
      label: "Backlog is parked",
      title: "The agent waits for Todo",
      body: "The human supplies the issue description and acceptance criteria; assignment starts execution only after the work is admitted.",
      steps: [
        "Human writes or accepts the issue",
        "Human moves Backlog → Todo",
        "Daemon queues and dispatches the assignee",
      ],
      state: "agent asleep",
    },
    note: "Multica does include quick-create, but it is a one-shot transcriber: it formats free text into an issue and exits. It does not inspect the codebase, ask a question, or record an assumption.",
  },
  comparison: {
    heading: {
      eyebrow: "Head to head",
      title: "The shipped products, not the headlines",
    },
    lead: "A {check} marks the clearer fit for that dimension; a **dash** marks an architectural trade-off. This comparison credits Multica for the operational platform it has actually shipped and separates that from its future vision.",
    ourLabel: "AI4Kanban",
    theirLabel: "Multica",
    rows: {
      startingPoint: {
        dimension: "Where the product starts",
        kanban:
          "Before the task: inspect the project, propose work, and decide what belongs on the board.",
        multica:
          "After the task exists: accept an issue, assignee, priority, and execution instructions.",
      },
      backlog: {
        dimension: "Backlog behavior",
        kanban:
          "The agent actively develops unready cards and can propose work nobody requested.",
        multica:
          "A parking lot. An issue in Backlog does not wake an assigned agent.",
      },
      refinement: {
        dimension: "From vague idea to spec",
        kanban:
          "A repeated refine loop reads code and memory, makes assumptions explicit, and asks only unresolved product questions.",
        multica:
          "Descriptions are free text; the human is told to provide files, constraints, outcomes, and acceptance criteria.",
      },
      memory: {
        dimension: "What compounds",
        kanban:
          "Project decisions, redesign lessons, shipped work, and rejection reasons shape the next proposal.",
        multica:
          "Reusable Skills preserve working methods; issue activity and run history preserve execution provenance.",
      },
      execution: {
        dimension: "Run operations",
        kanban:
          "Hands implementation to the chosen coding harness; no native retry, replay, token-cost, or fleet layer.",
        multica:
          "Queues, dispatches, streams, meters, retries, replays, gates review, and links pull requests and CI.",
      },
      teams: {
        dimension: "People and agent teams",
        kanban:
          "Local-first and best for one developer or a small team collaborating through git.",
        multica:
          "Multiplayer workspaces, roles, squads, inboxes, comments, permissions, and notifications.",
      },
      storage: {
        dimension: "Storage and infrastructure",
        kanban:
          "Markdown in the repository; no database, account, board server, or MCP dependency.",
        multica:
          "PostgreSQL + pgvector, a Go server, local daemon, OAuth, and hosted or self-hosted deployment.",
      },
      license: {
        dimension: "License",
        kanban:
          "Apache License 2.0, including commercial use, hosting, and embedding.",
        multica:
          "A source-available Multica License with restrictions on hosted services and commercial embedding.",
      },
    },
  },
  memory: {
    heading: {
      eyebrow: "Two kinds of memory",
      title: "How to do it vs. why we decided it",
    },
    lead: "Both systems accumulate knowledge, but on different axes. Multica Skills teach agents **how to perform a kind of work**. AI4Kanban's module memory records **what this project has decided and ruled out**.",
    ours: {
      eyebrow: "Project judgment",
      title: "AI4Kanban remembers the veto",
      body: "Compact repository files are read before the agent proposes or refines work. The point is not a complete transcript; it is to keep the next planning decision from repeating an old mistake.",
      examples: ["rejected.md", "redesign.md", "memory.md"],
      question: "Why did the board stop proposing idea X?",
      answer:
        "`rejected.md` records the idea and its rationale, so it stays out unless new evidence changes the decision.",
    },
    theirs: {
      eyebrow: "Working method",
      title: "Multica remembers the playbook",
      body: "Skills are hand-authored or imported `SKILL.md` bundles shared across agents. Issue comments and execution history show what happened to a run, but completed work does not automatically become decision memory.",
      examples: ["SKILL.md", "comments", "run history"],
      question: "How should this agent perform a security review?",
      answer:
        "Attach a reusable Skill that contains the procedure, files, and instructions for that kind of work.",
    },
    note: "The distinction is procedure vs. judgment. A playbook can improve execution; a rejection record can stop the wrong work from being proposed again.",
  },
  horizon: {
    heading: {
      eyebrow: "Vision vs. shipped",
      title: "The overlap is coming closer",
    },
    lead: "Multica's `VISION.md` reaches upstream. It describes agents that structure intent, gather context, make uncertainty explicit, and keep decisions connected to outcomes. That is much closer to AI4Kanban's current thesis than Multica's current product is.",
    shippedLabel: "Shipped today",
    visionLabel: "Declared direction",
    shippedTitle: "Execute an issue",
    shippedBody:
      "Backlog waits. The daemon tells the assignee to read the issue and complete it. Refinement happens after code exists, through review and revision.",
    visionTitle: "Develop the intent",
    visionBody:
      "Future agents are meant to turn intent into structured work and separate known facts from decisions still needed.",
    marker: "watch this gap",
    note: "This is a real competitive threat, not a reason to credit unshipped features. The honest comparison is shipped vs. shipped, with the declared direction named plainly.",
  },
  wins: {
    heading: {
      eyebrow: "Trade-offs",
      title: "Where each one is plainly ahead",
    },
    lead: "This is not a feature-count contest. AI4Kanban is intentionally smaller and earlier in the lifecycle. Multica is substantially broader once work enters execution.",
    oursHeading: "AI4Kanban",
    theirsHeading: "Multica",
    ours: {
      upstream: {
        title: "The agent helps decide the work",
        body: "It proposes from project context, turns rough asks into buildable cards, and orders them by value and dependency before execution begins.",
      },
      rejectionMemory: {
        title: "Rejected ideas stay rejected",
        body: "Decision and redesign memory shape later planning, so the agent does not keep pitching a direction the project already ruled out.",
      },
      repoNative: {
        title: "The whole planning layer fits in git",
        body: "Cards and memory are readable, diffable files beside the code, with no board service to operate and plain Apache-2.0 terms.",
      },
    },
    theirs: {
      operations: {
        title: "A serious execution control plane",
        body: "Run replay, retries, review gates, PR and CI linkage, token metering, webhooks, attachments, and multiple operational views are already shipped.",
      },
      teams: {
        title: "Built for multiplayer work",
        body: "Workspaces, roles, squads, threaded discussion, notifications, permissions, and persistent agent identities support a real human-and-agent organization.",
      },
      runtimeReach: {
        title: "Far broader runtime support",
        body: "Multica supports roughly twenty agent CLIs and connects them through local daemons and cloud runtimes. AI4Kanban wires up Claude Code and Codex today.",
      },
    },
  },
  decision: {
    heading: {
      eyebrow: "The call",
      title: "Which should you use?",
    },
    oursHeading: "Choose AI4Kanban when",
    theirsHeading: "Choose Multica when",
    ours: [
      "Your bottleneck is deciding and refining the right work, not dispatching it.",
      "You want an agent to propose tasks from code and project memory.",
      "You want rejection reasons and design decisions to shape future planning.",
      "You prefer a small, repository-native system with no board infrastructure.",
      "Plain Apache-2.0 terms matter for what you are building.",
    ],
    theirs: [
      "The tasks already exist and your bottleneck is running them reliably.",
      "Multiple people and named agents need one shared operational workspace.",
      "You need retries, replay, cost metering, PR and CI linkage, or review gates.",
      "You want broad agent-runtime support, squads, chat, webhooks, and mobile access.",
      "You are comfortable operating or buying a server-backed platform.",
    ],
    verdict:
      "Choose AI4Kanban to **decide and develop the work before it is ready**. Choose Multica to **assign and operate the work after it is ready**. If you need both, the clean seam is simple: let AI4Kanban produce the approved card, then create the Multica issue for execution.",
    note: "The two can complement each other, but do not keep two live sources of truth for the same task state. Pick a clear handoff point.",
  },
};

export default en;
