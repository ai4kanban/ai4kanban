// English copy for the Hermes Agent Kanban comparison — the source of truth the other four
// languages mirror key for key. Writing rules: `i18n/index.ts`.
import type { VsHermesCopy } from "./types";

const en: VsHermesCopy = {
  meta: {
    title:
      "AI4Kanban vs. Hermes Agent Kanban — repository-native planning or an integrated agent runtime",
    socialTitle: "AI4Kanban vs. Hermes Agent Kanban",
    description:
      "Compare AI4Kanban's repository-native Markdown board with Nous Research's Hermes Agent Kanban. One keeps planning portable and reviewable; the other adds a shared SQLite queue, dispatcher, and multi-agent runtime.",
    social:
      "Two agent kanban systems, two architectural choices: a portable Markdown board that works with any coding agent, or a durable shared queue built into the Hermes runtime.",
  },
  hero: {
    badge: "Comparison",
    title: "AI4Kanban vs.\nHermes Agent Kanban",
    lead: "Both products give agents a kanban board. The architectural boundary is different: AI4Kanban keeps the board as a portable *project layer* in your repository, while Hermes Agent Kanban makes it part of the Hermes runtime.",
    ours: {
      name: "AI4Kanban",
      body: "A Markdown board that lives with your code. Choose or change the agent that works from it without changing the board itself.",
    },
    theirs: {
      name: "Hermes Agent Kanban",
      body: "A unified system in which the board, dispatcher, and named agents share one durable Hermes runtime.",
    },
    oursDiagramAlt:
      "A Markdown kanban board forms the project layer, with a replaceable agent runtime handling execution and maintenance above it.",
    theirsDiagramAlt:
      "A single Hermes runtime contains the SQLite board, dispatcher, and named agents.",
    taskLayer: "task layer · execution + maintenance",
    boardLayer: "kanban · Markdown files (git)",
  },
  summary: {
    heading: {
      eyebrow: "The short version",
      title: "The practical difference",
    },
    lead: "The two products solve much of the same problem, but at different layers. AI4Kanban is **a portable planning system for the agent environment you already use**. Hermes Kanban is **an operational queue within Hermes**, designed to coordinate multiple workers and recover interrupted work.",
    oursHeading: "AI4Kanban — planning stays with the project",
    theirsHeading: "Hermes Kanban — execution stays with the runtime",
    ours: [
      "Tasks and plans are Markdown files in your repository, so every change can be reviewed and versioned.",
      "The board has no database, gateway, or background service of its own.",
      "Claude Code, Codex, Cursor, Hermes, or another file-capable agent can execute the work.",
    ],
    theirs: [
      "A durable SQLite queue at ~/.hermes/kanban.db is shared by named agents and people.",
      "A dispatcher assigns ready tasks and recovers work after an interrupted run.",
      "The board is integrated with the Hermes / Nous stack and its kanban_* tools.",
    ],
    whenLabel: "How to choose",
    when: "Choose AI4Kanban when you want planning **versioned with the code**, prefer your current agent environment, or do not need a dedicated orchestration service. Choose Hermes Kanban when **Hermes is already your operating environment** and you want its dispatcher, named profiles, chat controls, and recovery model. The durable record is different too: AI4Kanban relies on files and git; Hermes stores queue state in SQLite.",
  },
  harness: {
    heading: {
      eyebrow: "Harness support",
      title: "Which agents can run the board?",
    },
    lead: "This is the clearest dividing line. Because AI4Kanban uses ordinary repository files, **any agent that can read and edit the project can use the board**, including Hermes. Hermes Kanban is exposed through the runtime's `kanban_*` tools and is therefore specific to Hermes.",
    oursSub: "any file-reading agent",
    theirsSub: "Hermes only",
    supported: "supported",
    notSupported: "not supported",
    note: "AI4Kanban also works with Windsurf, OpenCode, Gemini CLI, and other tools that can read project files. Hermes Kanban is available only through the Hermes runtime.",
  },
  comparison: {
    heading: {
      eyebrow: "Head to head",
      title: "AI4Kanban vs. Hermes Kanban",
    },
    lead: "A {check} marks a clear advantage; a **dash** marks a trade-off. AI4Kanban favors portability and operational simplicity. Hermes favors coordinated, recoverable execution across multiple agents.",
    ourLabel: "AI4Kanban",
    theirLabel: "Hermes Kanban",
    rows: {
      whatItIs: {
        dimension: "What it is",
        kanban:
          "A repository-native planning layer built from Markdown files.",
        hermes:
          "A durable kanban queue integrated into the Hermes agent runtime.",
      },
      infrastructure: {
        dimension: "Infrastructure",
        kanban:
          "None for the board itself; it uses files already stored in your repository.",
        hermes: "A Hermes gateway, SQLite database, and dispatcher process.",
      },
      whereBoardLives: {
        dimension: "Where the board lives",
        kanban:
          "In your repository, under the same version control as the code.",
        hermes:
          "In ~/.hermes/kanban.db, with changes recorded as events rather than repository diffs.",
      },
      setup: {
        dimension: "Setup",
        kanban: "One setup prompt installs a skill file and a small script.",
        hermes:
          "Install Hermes, configure agent profiles, and run the gateway.",
      },
      parallelRuns: {
        dimension: "Parallel & scheduled runs",
        kanban:
          "Your agent environment supplies parallelism; scheduled work is represented in the recurring/ folder.",
        hermes:
          "The dispatcher claims ready tasks automatically and starts a worker process for each one.",
      },
      crashRecovery: {
        dimension: "Crash recovery",
        kanban:
          "No runtime-level recovery queue; interrupted scheduled work is picked up on a later run.",
        hermes:
          "The queue recovers in-flight work with claim TTLs, heartbeats, stale-claim reclamation, and retries.",
      },
      decomposition: {
        dimension: "Task decomposition",
        kanban:
          "Refinement turns a card into concrete todos and explicit task relationships such as groups, blockers, and related work.",
        hermes:
          "An LLM decomposer expands a task into a child-task graph and routes each child to a specialist.",
      },
      reviewMemory: {
        dimension: "Review & memory",
        kanban:
          "Curated project memory preserves decisions and shipped work to improve future planning.",
        hermes:
          "An append-only event log and per-attempt history support audit and recovery.",
      },
      dashboard: {
        dimension: "Dashboard GUI",
        kanban:
          "A local web board where card actions hand implementation, review, and archiving to an agent.",
        hermes:
          "A live dispatcher view with drag-and-drop, run details, and controls available from chat apps.",
      },
      scale: {
        dimension: "Scale & reach",
        kanban: "Best suited to an individual or small team working in one repository.",
        hermes:
          "Designed for many agents and boards, with multi-tenant operation and control from chat, email, and SMS.",
      },
    },
  },
  memory: {
    heading: {
      eyebrow: "Memory vs. audit",
      title: "Two different kinds of history",
    },
    lead: "AI4Kanban keeps **planning context** so future proposals reflect earlier decisions. Hermes keeps an **execution record** so operators can inspect and reconstruct what happened. Each is useful, but for a different purpose.",
    ours: {
      heading: "AI4Kanban",
      verdict: "Preserves decisions, not every event.",
      body: "Four deliberately concise files capture what matters next: `archive.md` records shipped work, `rejected.md` records declined ideas and their rationale, `redesign.md` records design mistakes to avoid, and `memory.md` records useful findings from earlier scans. Agents read them before proposing or refining work; git retains the full change history.",
      q: "Why isn't idea X on the board?",
      a: "`rejected.md` records the idea and the reason it was declined, so it is not proposed again without new evidence.",
    },
    theirs: {
      heading: "Hermes Kanban",
      verdict: "Preserves the complete execution trail.",
      body: "Every state transition is written to an **append-only log**, and every attempt retains its exit code and worker output. That detail supports audit and crash recovery rather than future product planning.",
      q: "What happened to task 42 overnight?",
      a: "`claimed → crashed → reclaimed → completed`, with a separate log for each attempt.",
    },
    note: "Curated memory informs the next decision; an audit log explains the last execution. Neither replaces the other.",
  },
  autonomy: {
    heading: {
      eyebrow: "Autonomy level",
      title: "How much autonomy does the agent get?",
    },
    lead: 'Hermes Kanban is designed for **"drop a one-liner, walk away"** execution. AI4Kanban uses **reviewed autonomy**: you capture an incomplete idea, `refine` develops it into concrete requirements, and implementation waits for your approval.',
    stops: {
      traditional: {
        level: "No autonomy",
        term: "Human-driven",
        heading: "Traditional kanban",
        detail:
          "You think of every task and break it down — Trello or Jira just records it.",
      },
      kanban: {
        level: "Reviewed autonomy",
        term: "Agent proposes, human approves",
        heading: "AI4Kanban",
        detail:
          "`refine` identifies gaps, develops the requirements, and presents the result for review before implementation.",
      },
      hermes: {
        level: "Full autonomy",
        term: "Unattended execution",
        heading: "Hermes Kanban",
        detail:
          "A short request becomes a task tree that is decomposed and executed without supervision. Claude Code's `/goal` follows a similar model.",
      },
    },
    scaleLeft: "You plan everything",
    scaleMiddle: "Agent plans, you approve",
    scaleRight: "Agent plans everything",
    worstCaseLabel: "The risk at each level",
    worstCaseTheirs:
      "**Unattended execution:** an early misunderstanding can propagate through an entire task tree before anyone reviews the result.",
    worstCaseOurs:
      "**Reviewed autonomy:** a flawed Markdown plan reaches review, but implementation has not started.",
    note: "A refinement pass fills gaps, separates adjacent ideas into their own cards, recognizes work that is already complete, and turns judgment calls into questions. Once those questions are resolved, the card becomes **ready** for final review and implementation.",
  },
  gui: {
    heading: { eyebrow: "The dashboards", title: "Two boards, two roles" },
    lead: "Both provide a web interface. AI4Kanban's board is a **control surface for project work**: card actions start agent runs. Hermes's board is an **operational view of the dispatcher**: it shows the current state of the agent fleet.",
    ours: {
      heading: "AI4Kanban — local board",
      body: "A local web interface for the Markdown board. Actions such as *implement, review, and archive* hand work to an agent, stream its output, and pause when human input is required.",
      alt: "AI4Kanban's light-themed local web board with Blockers, UI, Skill, Docs, and Distribution columns and a Create task button.",
    },
    theirs: {
      heading: "Hermes Kanban — live dispatcher view",
      body: "A live view backed by the event log, with drag-and-drop columns, run history, exit-status badges, and controls available from Discord, Slack, or SMS.",
      alt: "Hermes Agent's dark-themed Kanban dashboard with Triage, Todo, Scheduled, and Ready columns and an orchestration toolbar.",
    },
  },
  wins: {
    heading: { eyebrow: "Trade-offs", title: "Where each one wins" },
    lead: "The better choice depends on the operating model. AI4Kanban minimizes infrastructure and keeps planning portable. Hermes Kanban provides a durable shared queue for coordinated, unattended execution. Both can support parallel work, orchestration, and a dashboard; the advantages below are the capabilities that genuinely distinguish them.",
    oursHeading: "AI4Kanban",
    theirsHeading: "Hermes Kanban",
    ours: {
      noInfra: {
        title: "No board service to operate",
        body: "There is no board database, gateway, or daemon. Beyond the agent you already use, AI4Kanban is a set of Markdown files that works locally and offline.",
      },
      diffable: {
        title: "Planning that travels with the code",
        body: "The board is versioned in the repository and follows the project wherever it goes. Task and plan changes use the same review workflow as code, without an external database or dependency on one agent stack.",
      },
      selfPruning: {
        title: "Memory designed for future decisions",
        body: "AI4Kanban records rejected ideas, design lessons, and shipped work so future proposals build on earlier decisions. It deliberately retains planning signal rather than a complete execution log.",
      },
      onePrompt: {
        title: "Fits the agent environment you already use",
        body: "One setup prompt installs a skill file and a small script. There are no profiles or dispatcher settings to manage, and any file-capable agent can use the result, including Hermes.",
      },
    },
    theirs: {
      manyAgents: {
        title: "A shared queue for named agents",
        body: "Multiple named agents and people can claim and hand off work on one durable board. The dispatcher monitors ready tasks and launches the assigned agent for each one.",
      },
      selfHealing: {
        title: "Automatic recovery for in-flight work",
        body: "Claim TTLs, heartbeats, stale-claim reclamation, retries, and circuit breakers let the queue recover tasks after a worker fails. AI4Kanban preserves the task, but recovery is left to the next agent or scheduled run.",
      },
      autoDecompose: {
        title: "Automatic decomposition and routing",
        body: "The dispatcher's LLM decomposer turns a rough request into a graph of child tasks and routes each one to a specialist agent. AI4Kanban develops the plan through iterative refinement and human review.",
      },
      fleetReach: {
        title: "Multi-agent operations at fleet scale",
        body: "Hermes Kanban is designed for many agents across multiple boards, supports multi-tenant operation, and can be controlled from Discord, Telegram, Slack, email, and SMS.",
      },
    },
  },
  decision: {
    heading: { eyebrow: "The call", title: "Which should you use?" },
    oursHeading: "Choose AI4Kanban when",
    theirsHeading: "Choose Hermes Kanban when",
    ours: [
      "You want tasks and plans versioned and reviewed with the code.",
      "You prefer a portable, offline-capable board with no service to operate.",
      "You want to choose your own agent environment, including Claude Code, Codex, Cursor, or Hermes.",
      "You are an individual or small team that values a focused planning layer.",
    ],
    theirs: [
      "Hermes is already your primary agent runtime, with profiles, gateway, and chat controls in place.",
      "You need one durable queue shared by multiple named agents and people.",
      "You need automatic recovery for interrupted work.",
      "You want the dispatcher to decompose tasks and route them to specialist agents.",
      "You operate many agents across multiple boards and communication channels.",
    ],
    verdict:
      "Choose AI4Kanban for a **repository-native planning layer that remains independent of the agent runtime**. Choose Hermes Agent Kanban for a **durable shared queue with integrated dispatch, recovery, and multi-agent coordination**. The right choice is not about which board has more features; it is about whether planning should belong to the project or to the runtime.",
    note: "They can also complement each other: use AI4Kanban to refine and review work in git, then use Hermes as the durable execution queue for approved, shared work.",
  },
};

export default en;
