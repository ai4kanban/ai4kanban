// English copy for the Hermes Agent Kanban comparison — the source of truth the other four
// languages mirror key for key. Writing rules: `i18n/index.ts`.
import type { VsHermesCopy } from "./types";

const en: VsHermesCopy = {
  meta: {
    title:
      "AI4Kanban vs. Hermes Agent Kanban — a lean file-based board vs. a durable runtime",
    socialTitle: "AI4Kanban vs. Hermes Agent Kanban",
    description:
      "How ai4kanban's file-based board compares to Nous Research's Hermes Agent Kanban: two overlapping agent kanban boards — plain diffable files that run on any agent (even Hermes) vs. a durable, shared SQLite queue many named agents claim tasks from.",
    social:
      "Two overlapping agent kanban boards. ai4kanban is a lean, file-based board that runs on any agent (even Hermes); Hermes bundles the same board with a durable, shared queue many named agents work.",
  },
  hero: {
    badge: "Comparison",
    title: "AI4Kanban vs.\nHermes Agent Kanban",
    lead: "Two agent-facing kanban boards with a lot of overlap. The difference is where the board sits in the stack: ai4kanban is a lean *board layer* you run any agent on top of; Hermes Agent Kanban fuses that board into its own runtime.",
    ours: {
      name: "AI4Kanban",
      body: "A plain-Markdown board in your repo. The runtime, execution, and even maintenance layer on top — swap the agent, keep the board.",
    },
    theirs: {
      name: "Hermes Agent Kanban",
      body: "The board, dispatcher, and named agents are one integrated runtime — durable and bundled, but the board doesn't detach from Hermes.",
    },
    oursDiagramAlt:
      "The kanban is a Markdown board at the bottom; the agent runtime, execution and maintenance are a swappable layer stacked on top.",
    theirsDiagramAlt:
      "One integrated Hermes runtime with the SQLite board, dispatcher and named agents fused inside it.",
    taskLayer: "task layer · execution + maintenance",
    boardLayer: "kanban · Markdown files (git)",
    runtimeLabel: "Hermes runtime",
  },
  summary: {
    heading: {
      eyebrow: "The short version",
      title: "So why not just use Hermes Kanban?",
    },
    lead: "Fair question — the two overlap a lot. Both are kanban boards agents plan and work from, so think of ai4kanban as **a lightweight alternative to Hermes Kanban**: the same board idea, minus the bundled runtime. The difference is what's underneath.",
    oursHeading: "AI4Kanban — a board made of files",
    theirsHeading: "Hermes Kanban — a board inside a runtime",
    ours: [
      "Plain Markdown in your repo — every task and plan change is a reviewable diff.",
      "No infrastructure: nothing to install, nothing to keep running.",
      "Execution comes from whatever harness you already use — Claude Code, Codex, Cursor, even Hermes.",
    ],
    theirs: [
      "A durable SQLite queue at ~/.hermes/kanban.db, shared by many named agents and humans.",
      "A dispatcher hands ready tasks to agents and recovers crashed runs.",
      "Tied to the Hermes / Nous stack and its kanban_* tools.",
    ],
    whenLabel: "When to use ai4kanban",
    when: "Pick ai4kanban when you want the board **versioned with your code**, when you're staying in a harness you already run, or when you don't want to operate a runtime just to get a task board. Reach for Hermes Kanban when **you already work deeply with Hermes** — its board plugs straight into the dispatcher, named profiles, and chat control you've set up. Both are durable queues in the end; ai4kanban's is files in git, Hermes's is rows in SQLite.",
  },
  harness: {
    heading: {
      eyebrow: "Harness support",
      title: "Which agents can run the board?",
    },
    lead: "The clearest single difference. ai4kanban's board is plain files, so **any agent that can read a repo can run it** — including Hermes itself. Hermes Kanban's board sits behind the runtime's `kanban_*` tools, so only Hermes can.",
    oursSub: "any file-reading agent",
    theirsSub: "Hermes only",
    supported: "supported",
    notSupported: "not supported",
    note: "…and ai4kanban's row keeps going — Windsurf, OpenCode, Gemini CLI, anything that reads files. Hermes Kanban has no way in for other agents.",
  },
  comparison: {
    heading: {
      eyebrow: "Head to head",
      title: "AI4Kanban vs. Hermes Kanban",
    },
    lead: "A {check} is a clear win; a **dash** is a trade-off. ai4kanban wins on simplicity and portability, Hermes on the durable shared queue and scale — the rest is a draw.",
    ourLabel: "AI4Kanban",
    theirLabel: "Hermes Kanban",
    rows: {
      whatItIs: {
        dimension: "What it is",
        kanban:
          "A file-based kanban layer — the board is plain Markdown in your repo.",
        hermes:
          "A kanban feature of the Hermes agent runtime — a durable SQLite board.",
      },
      infrastructure: {
        dimension: "Infrastructure",
        kanban:
          "None of its own — the board is just plain Markdown files in your repo.",
        hermes: "A running gateway, a SQLite database, and a dispatcher loop.",
      },
      whereBoardLives: {
        dimension: "Where the board lives",
        kanban:
          "In your repo, under version control — every task and plan change is a reviewable diff.",
        hermes:
          "In a SQLite DB at ~/.hermes/kanban.db; changes go to an event log, not diffs.",
      },
      setup: {
        dimension: "Setup",
        kanban: "One prompt: a skill file and a small script.",
        hermes:
          "Install the Hermes runtime, configure profiles, run the gateway.",
      },
      parallelRuns: {
        dimension: "Parallel & scheduled runs",
        kanban:
          "Your harness drives it — Claude Code spawns parallel subagents when you kick things off; scheduled jobs live in a recurring/ folder.",
        hermes:
          "The runtime drives it — the dispatcher picks up ready tasks on its own and spawns a worker process per task.",
      },
      crashRecovery: {
        dimension: "Crash recovery",
        kanban:
          "No per-task queue — a run that dies mid-task just reruns on the next scheduled tick.",
        hermes:
          "A durable queue auto-recovers in-flight work — claim TTLs, heartbeats, stale-claim reclaim, retries.",
      },
      decomposition: {
        dimension: "Task decomposition",
        kanban:
          "A card breaks into todos and a task graph — group, blocked-by, related — with deps worked out as it's written.",
        hermes:
          "The dispatcher auto-runs an LLM decomposer, fanning a task into a child-task graph routed to specialists.",
      },
      reviewMemory: {
        dimension: "Review & memory",
        kanban:
          "Memory is pruned to why-rejected and what-shipped so the agent proposes forward — curated, not a full log.",
        hermes:
          "Keeps a full append-only event log and per-attempt run history for audit.",
      },
      dashboard: {
        dimension: "Dashboard GUI",
        kanban:
          "A local web board where card actions — implement, review, archive — hand the work to an agent.",
        hermes:
          "A live web board with drag-drop and a side drawer, plus control from chat apps.",
      },
      scale: {
        dimension: "Scale & reach",
        kanban: "A solo board; grep gets unwieldy as it grows.",
        hermes:
          "Scales to many agents across many boards — multi-tenant, with control from Discord / Slack / email / SMS.",
      },
    },
  },
  memory: {
    heading: {
      eyebrow: "Memory vs. audit",
      title: "What each board remembers",
    },
    lead: "The essential difference: ai4kanban's memory is an **input to planning** — it exists so the next proposal is smarter. Hermes's log is an **output of execution** — it exists so the past can be replayed.",
    ours: {
      heading: "AI4Kanban",
      verdict: "Remembers conclusions, forgets the rest.",
      body: "Four small files, **pruned on purpose**: `archive.md` (what shipped), `rejected.md` (what we turned down, and why), `redesign.md` (design mistakes not to repeat), `memory.md` (what past scans learned). The agent reads them all before proposing or writing a card; the full history is git's job.",
      q: "Why isn't idea X on the board?",
      a: "One line in `rejected.md` — the idea and why it was turned down. Dead ideas stay dead.",
    },
    theirs: {
      heading: "Hermes Kanban",
      verdict: "Remembers every event, summarizes nothing.",
      body: "Every state transition lands in an **append-only log**; every attempt keeps its exit code and full worker output. Built for audit and crash recovery, not for steering the next idea.",
      q: "What happened to task 42 overnight?",
      a: "`claimed → crashed → reclaimed → completed`, with per-attempt logs to read.",
    },
    note: "Curated memory makes the agent smarter next time; the audit log makes the past reconstructable. Neither substitutes for the other.",
  },
  autonomy: {
    heading: {
      eyebrow: "Autonomy level",
      title: "How much autonomy does the agent get?",
    },
    lead: 'Hermes Kanban promises **"drop a one-liner, walk away"** — full autonomy. ai4kanban is **agent-assisted**, and it starts earlier than plan mode: you save a half-formed idea to the board, `refine` turns it into concrete requirements, and you approve before any code is written.',
    stops: {
      traditional: {
        level: "No autonomy",
        term: "Human-driven",
        heading: "Traditional kanban",
        detail:
          "You think of every task and break it down — Trello or Jira just records it.",
      },
      kanban: {
        level: "Semi autonomy",
        term: "Agent-assisted",
        heading: "AI4Kanban",
        detail:
          "Each `refine` digs into the missing pieces and fills in requirements. You review before anything is built.",
      },
      hermes: {
        level: "Full autonomy",
        term: "Fire-and-forget",
        heading: "Hermes Kanban",
        detail:
          "One line in, a task tree out — decomposed and worked unattended until done. Claude Code's `/goal` makes the same bet.",
      },
    },
    scaleLeft: "You plan everything",
    scaleMiddle: "Agent plans, you approve",
    scaleRight: "Agent plans everything",
    worstCaseLabel: "Worst case, per level",
    worstCaseTheirs:
      "**Fire-and-forget:** a small early misunderstanding grows into a whole tree of wrong tasks — built, tokens spent.",
    worstCaseOurs:
      "**Agent-assisted:** a wrong Markdown card — caught when you review it, before anything is built.",
    note: "One refine fills in missing steps, splits side ideas into their own cards, ticks off todos that already landed, and leaves the taste calls to you as questions. When none are left, the card flips to **ready** — read it, then build it.",
  },
  gui: {
    heading: { eyebrow: "The dashboards", title: "Kanban Board GUI" },
    lead: "Both ship a web board, but they play different roles. ai4kanban's board is a **control surface for your agent** — card actions kick off runs. Hermes's board is a **live window onto the dispatcher** — it shows what the fleet is doing right now.",
    ours: {
      heading: "AI4Kanban — local board",
      body: "A local web board over the Markdown files. Card actions — *implement, review, archive* — hand the work to an agent, and you watch its log stream back with human-in-the-loop prompts.",
      alt: "ai4kanban's local web board — a light board with Blockers, UI, Skill, Docs, and Distribution columns and a Create task button.",
    },
    theirs: {
      heading: "Hermes Kanban — live dispatcher view",
      body: "A live board that tails the event log — drag-drop between columns, a side drawer with run history and exit-status badges, and the same board steerable from Discord, Slack, or SMS.",
      alt: "Hermes Agent's Kanban dashboard — a dark board with Triage, Todo, Scheduled, and Ready columns and an orchestration toolbar.",
    },
  },
  wins: {
    heading: { eyebrow: "Trade-offs", title: "Where each one wins" },
    lead: "Neither is strictly better. ai4kanban optimizes for a lean, file-based board with no infra of its own; Hermes Kanban optimizes for a durable, shared work queue that many agents run against, unattended. Harness features — parallel runs, orchestration, a dashboard — are on both sides, so they aren't listed here.",
    oursHeading: "AI4Kanban",
    theirsHeading: "Hermes Kanban",
    ours: {
      noInfra: {
        title: "No infrastructure of its own",
        body: "No database, no gateway, no daemon. Beyond the agent you already run, the board is plain Markdown files — nothing extra to install or keep alive, works on a plane.",
      },
      diffable: {
        title: "Files you can diff and version",
        body: "The board lives in the repo and travels with it, under whatever version control you use. Every task and plan change is a reviewable diff — no SQLite outside your project, no event log to query, no lock-in to one agent stack.",
      },
      selfPruning: {
        title: "Memory that self-prunes",
        body: "It records why an idea was rejected and what got shipped, so the agent proposes forward instead of re-floating dead work. It keeps only what steers the next task, not a full audit log.",
      },
      onePrompt: {
        title: "Installs in one prompt",
        body: "A skill file and a small script — no profiles to configure, no dispatcher to tune. It meets any file-reading agent where it already is, Hermes included.",
      },
    },
    theirs: {
      manyAgents: {
        title: "One board, many named agents",
        body: "A single durable board that multiple named agents — and humans — claim tasks and hand off work on. The dispatcher polls ready tasks and spawns the assigned agent for each. ai4kanban's board is driven by whatever single harness you're in.",
      },
      selfHealing: {
        title: "Self-healing task queue",
        body: "The queue tracks each task through crashes: claim TTLs, heartbeats, stale-claim reclaim, retries, and circuit breakers. A worker can die mid-task and the board reclaims and retries it — ai4kanban's files are durable, but a dead run just waits for the next scheduled tick.",
      },
      autoDecompose: {
        title: "Auto-decomposes tasks",
        body: "Drop in a rough task and the dispatcher's LLM decomposer fans it into a child-task graph, each child routed to a specialist agent — no manual breakdown. ai4kanban splits a card into todos and a hand-tended task graph.",
      },
      fleetReach: {
        title: "Fleet reach and scale",
        body: "Built for many agents across many boards, multi-tenant, with control from Discord, Telegram, Slack, email, and SMS. ai4kanban is a lean solo board that stays in your repo and terminal.",
      },
    },
  },
  decision: {
    heading: { eyebrow: "The call", title: "Which should you use?" },
    oursHeading: "Reach for ai4kanban when",
    theirsHeading: "Reach for Hermes Kanban when",
    ours: [
      "You want a file-based board — every task and plan change is a reviewable diff.",
      "You want no infra of its own: plain files, offline, portable, no lock-in.",
      "You want it agent-agnostic — Claude Code, Cursor, even Hermes itself.",
      "You're solo and value a lean board over a bundled engine.",
    ],
    theirs: [
      "You already work deeply with Hermes — profiles, gateway, and chat control are set up.",
      "You want one durable board that many named agents — and people — share.",
      "You want a queue that auto-recovers in-flight tasks across crashes.",
      "You want the dispatcher to auto-decompose tasks and route them to specialists.",
      "You run fleet workloads across many boards and chat platforms.",
    ],
    verdict:
      "They overlap more than the names suggest — both are agent kanban boards. The split is what's bundled: ai4kanban is a **file-based board with automation left to your harness**; Hermes Agent Kanban is that board **wrapped in a durable, shared work queue**. If you want one board many agents share, surviving crashes, use Hermes. If you want a lean board in your repo you extend only when you need to, use ai4kanban.",
    note: "They can even sit side by side — ai4kanban as the lightweight place you plan and prune in git, Hermes as the durable queue that runs the heavy, shared work once you've decided what it is.",
  },
};

export default en;
