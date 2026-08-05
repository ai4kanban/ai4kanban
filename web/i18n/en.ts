// English copy — the source of truth for the whole site.
//
// The other four languages mirror this file key for key. When you change a
// sentence here, the translations don't break the build (they're still valid
// strings), so commit the change and run `/translate-sync` — it diffs this file
// from the commit in `synced-commit.txt` and re-expresses whatever moved.
// Adding or removing a key *does* break the build in every language, which is
// the point.
//
// Inline markup follows `components/Rich.tsx`: `code`, **bold**, *italic*, \n.
import type { SiteCopy } from "./types";

const en: SiteCopy = {
  shared: {
    nav: {
      install: "Install",
      usage: "Using it",
      boardUi: "Board UI",
      features: "Features",
      recipes: "Recipes",
      compare: "Compare",
      compareMore: "More comparisons soon…",
      github: "GitHub ↗",
    },
    footer: {
      license: "Apache License 2.0",
      origin: "Generalized from a skill built for",
    },
    code: {
      copy: "Copy",
      copied: "Copied",
      copyAria: "Copy to clipboard",
      copiedAria: "Copied",
    },
    language: { label: "Language" },
    vs: "vs",
    bottomLine: "Bottom line",
    cta: { install: "Install ai4kanban", github: "View on GitHub ↗" },
  },

  home: {
    meta: {
      title:
        "AI4Kanban — The project board that plans autonomously and learns from every decision",
      description:
        "An agent-led project board that turns project goals into continuous execution — defining tasks, clarifying requirements, setting priorities, and preserving every product decision in project memory.",
    },

    header: {
      brand: "🗂️ AI4Kanban",
      nav: {
        install: "Install",
      },
      github: "GitHub ↗",
    },

    hero: {
      title: "A project board that plans itself.",
      lead: "It brings your goals, code, and project memory together to manage work from planning through completion. You make the product calls and give final approval.",
      ctaInstall: "Start with one prompt",
      ctaGithub: "View on GitHub ↗",
      shots: {
        board: { label: "Board", alt: "AI4Kanban local board: Board view" },
        queue: { label: "Queue", alt: "AI4Kanban local board: Queue view" },
        frontAria: "{view} view (current)",
        flipAria: "Switch to {view} view",
      },
    },

    compare: {
      title: "From task tracking to autonomous planning",
      lead: "Traditional boards only record and track tasks, and every input has to be written by hand. AI4Kanban uses your long-term goals and the decisions already in project memory to plan work and move it forward autonomously.",
      columns: { classic: "Traditional board", kanban: "AI4Kanban" },
      rows: [
        {
          dimension: "Input",
          classic: "Detailed tasks written by hand",
          kanban: "Long-term goals and rough ideas",
        },
        {
          dimension: "Primary role",
          classic: "Record and track tasks",
          kanban: "Plan and drive work autonomously",
        },
        {
          dimension: "Your role",
          classic: "Maintain the board by hand",
          kanban: "Make decisions and approve the result",
        },
      ],
    },

    loop: {
      title: "Keep work moving",
      lead: "Give it a goal or a rough idea. The agent reads your code and project memory, determines what comes next, clarifies requirements, breaks the work down, orders dependencies and priorities, and moves into execution.",
      steps: [
        {
          title: "Define the next task",
          body: "Use the goal, code, and module memory to determine what should happen next.",
        },
        {
          title: "Clarify requirements",
          body: "The agent resolves anything it can from the code and project memory, bringing you only the product tradeoffs that require your judgment.",
        },
        {
          title: "Execute",
          body: "Once the requirements are clear enough to begin, the agent follows the scope and steps defined in the task.",
        },
        {
          title: "Record decisions",
          body: "Write product decisions back to project memory so the next planning and development cycle can build on them.",
        },
      ],
      split: {
        agentLabel: "Agent",
        agentBody: "Plan work · Drive execution · Record decisions",
        youLabel: "You",
        youBody: "Set the goal · Make tradeoffs · Give final approval",
      },
    },

    memory: {
      title: "Learns as you build",
      lead: "Conversations end. Product decisions stay. AI4Kanban saves your project goals and keeps a module-by-module record of shipped features, product decisions, reasons behind rejected ideas, and design lessons. It brings that context back when planning and clarifying new work.",
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
        module: "One per module",
        readme: "Shipped features",
        decisions: "Product decisions",
        rejected: "Reasons for rejection",
        redesign: "Design lessons",
      },
    },

    iterate: {
      title: "Drive continuous product iteration",
      lead: "Turn external signals into requirements that keep the product — and each release — moving forward.",
      inputsLabel: "External inputs",
      inputs: [
        "User feedback",
        "Competitor research",
        "Industry reports",
        "Reddit discussions",
      ],
      context: [
        "Decision history",
        "Requirements and tasks",
        "Project modules",
        "Run history",
      ],
      skill: "AI4Kanban Skill",
      otherAgents: "Other agents",
      storage: "Project data",
      outputsLabel: "Iteration outcomes",
      outputs: ["Product improvements", "Release iterations"],
    },

    start: {
      title: "Start with one prompt",
      lead: "It reads your codebase, establishes the project goal and module memory, and creates the first set of tasks.",
      notes: [
        "Just provide the project goal",
        "Node.js 18+",
        "Local UI optional",
      ],
      cta: "Copy setup prompt",
      copied: "Copied",
    },

    footer: {
      github: "GitHub",
      docs: "Documentation",
      recipes: "Recipes",
      comparisons: "Comparisons",
      license: "Apache License 2.0",
      language: "Language",
      credit: "created by Tao Wu",
      x: "Tao Wu on X",
    },
  },

  vsGithub: {
    meta: {
      title:
        "AI4Kanban vs. GitHub Issues — a different tool for a different job",
      socialTitle: "AI4Kanban vs. GitHub Issues",
      description:
        "How ai4kanban's file-based board compares to GitHub Issues: local Markdown vs. a remote API, token cost, agent ergonomics, teams, and when to use each.",
      social:
        "Not a replacement — a different tool for a different bottleneck. A head-to-head on speed, tokens, agents, and teams.",
    },
    hero: {
      badge: "Comparison",
      title: "AI4Kanban vs.\nGitHub Issues",
      lead: "Not a replacement — a different tool for a different bottleneck. GitHub Issues is a shared, durable, public system of record. ai4kanban is a private, local, agent-native working surface. Pick by what's actually slowing you down.",
      ours: {
        name: "AI4Kanban",
        body: "Plain Markdown in your repo. The agent's fast local scratch-board.",
      },
      theirs: {
        name: "GitHub Issues",
        body: "A database behind an API. The shared, public system of record.",
      },
    },
    summary: {
      heading: {
        eyebrow: "The short version",
        title: "So why not just use GitHub Issues?",
      },
      lead: "You can. Almost everything ai4kanban does, you could do with GitHub Issues plus the `gh` CLI or a GitHub MCP server. The difference is what it costs to get there.",
      panel:
        "The same task on GitHub Issues means **more noise**, **more turns**, **more tokens**, **higher latency**, and **heavier prompting** to get the agent to reach for it at all. ai4kanban trades GitHub's reach for local speed — and for a solo builder driving an agent, speed is usually the thing in short supply.",
    },
    comparison: {
      heading: {
        eyebrow: "Head to head",
        title: "AI4Kanban vs. GitHub Issues",
      },
      lead: "Fourteen dimensions. A {check} is a clear win; a **dash** is a deliberate trade-off that just comes down to what you need. ai4kanban takes the **speed and locality** rows; GitHub Issues takes the **scale and collaboration** ones.",
      ourLabel: "AI4Kanban",
      theirLabel: "GitHub Issues",
      rows: {
        storage: {
          dimension: "Storage",
          kanban: "Plain Markdown in your repo, in git.",
          issues: "GitHub's database, behind an API.",
        },
        offline: {
          dimension: "Works offline",
          kanban: "Yes — it's just files on disk.",
          issues: "No — needs network and auth.",
        },
        agentReads: {
          dimension: "How an agent reads it",
          kanban: "Native fs tools: Read, Grep, Glob.",
          issues: "gh CLI or MCP round-trips.",
        },
        tokenCost: {
          dimension: "Token cost per lookup",
          kanban: "Low — grep returns only the matching lines.",
          issues: "High — JSON payloads and tool schemas.",
        },
        latency: {
          dimension: "Latency",
          kanban: "Local disk, effectively instant.",
          issues: "A network round-trip per call.",
        },
        setup: {
          dimension: "Setup",
          kanban: "One prompt: a skill file and a small script.",
          issues: "Account, auth token, MCP config.",
        },
        lockIn: {
          dimension: "Vendor lock-in",
          kanban: "None — the board travels with the repo.",
          issues: "Lives on GitHub.",
        },
        metadata: {
          dimension: "Metadata",
          kanban:
            "Minimal by design: priority + effort — all a solo builder needs.",
          issues:
            "Labels, milestones, assignees, projects — for coordinating a team.",
        },
        concurrency: {
          dimension: "Concurrency",
          kanban: "None — id clashes if two people add #1894.",
          issues: "Server-assigned ids, safe for teams.",
        },
        history: {
          dimension: "Decision history",
          kanban:
            "Pruned to the decisions that steer the next task — why an idea was rejected, what shipped — so the agent proposes forward, never re-doing done or dead work.",
          issues: "Full comment history and edits kept, nothing dropped.",
        },
        closing: {
          dimension: "Closing out work",
          kanban: "Archive the task once its items are checked off.",
          issues: "Auto-closes issues from linked PRs and CI.",
        },
        search: {
          dimension: "Search at scale",
          kanban: "grep — quick on a small board, unwieldy as it grows.",
          issues: "Indexed full-text search and saved filters.",
        },
        contributors: {
          dimension: "External contributors",
          kanban:
            "Possible, but only by committing to the Markdown — no lightweight filing.",
          issues: "Anyone can file, comment, and react without a commit.",
        },
        transparency: {
          dimension: "Transparency",
          kanban:
            "Every card stays visible in the repo — only the memory hub is pruned to essentials.",
          issues: "Public and linkable — the open-source default.",
        },
      },
    },
    wins: {
      heading: { eyebrow: "Trade-offs", title: "Where each one wins" },
      lead: "Neither is strictly better. ai4kanban optimizes for one agent moving fast; GitHub Issues optimizes for many people staying in sync.",
      oursHeading: "AI4Kanban",
      theirsHeading: "GitHub Issues",
      ours: {
        tokenLight: {
          title: "Token-light and instant",
          body: "No MCP, no network. The agent greps local Markdown instead of paging a remote API — fewer tokens, lower latency, no auth to refresh mid-task.",
        },
        agentsUseIt: {
          title: "Agents actually use it",
          body: "Agents are reluctant to search GitHub Issues; they reach for filesystem tools by default. A Markdown board meets them where they already are — less prompting, fewer hallucinated task states.",
        },
        offline: {
          title: "Offline and yours",
          body: "Plain files in git. Works on a plane, works when GitHub is down. No SaaS dependency, no vendor lock-in — clone the repo and the whole board comes with you.",
        },
        memory: {
          title: "Memory tuned for proposing",
          body: "It records the decisions that steer the next task: why an idea was rejected, what got shipped, the gap to the goal. So the agent proposes forward — not re-doing done work or re-floating what you killed.",
        },
      },
      theirs: {
        teams: {
          title: "Built for teams",
          body: "Server-assigned ids, safe concurrent edits, assignees. ai4kanban has no database — two people can both mint #1894 and conflict.",
        },
        transparency: {
          title: "Transparency and reach",
          body: "Public and linkable, with external contributors filing, commenting, and reacting. The right home when openness matters more than raw speed.",
        },
        fullContext: {
          title: "Full context, forever",
          body: "ai4kanban deliberately compresses — an archived card shrinks to a line. On GitHub every comment, edit, and cross-link stays intact.",
        },
        integration: {
          title: "Deep integration",
          body: "Auto-closing from PRs, commit links, project boards, labels, milestones, and a whole ecosystem of third-party tools and indexed search at scale.",
        },
      },
    },
    ergonomics: {
      heading: { eyebrow: "The crux", title: "Why agents prefer files" },
      lead: 'The real difference shows up when an agent does the work. Ask the same thing — **"find my high-priority open tasks"** — and the two paths barely rhyme.',
      issues: {
        title: "you › agent + GitHub MCP",
        chip: "many turns",
        lines: [
          "find my high-priority open issues",
          "list_issues(state:open, labels:high)",
          "4.2 KB JSON — 18 issues, every field",
          "paginate, filter, summarize…",
          "auth refresh · rate-limit headers · retries",
        ],
        footer: "several tool calls · KBs of JSON · network each time",
      },
      kanban: {
        title: "you › agent + ai4kanban",
        chip: "one turn",
        lines: [
          "find my high-priority open tasks",
          'grep -rl "Priority: high" docs/kanban/todo',
          "three file paths",
          "done — one call, no network",
        ],
        footer: "one tool call · a few paths · all local",
      },
      note: 'It compounds. Every "what\'s next?", every archive, every board review pays the round-trip tax on GitHub Issues — and models, left to choose, quietly avoid the remote tool and reach for the files instead.',
    },
    decision: {
      heading: { eyebrow: "The call", title: "Which should you use?" },
      oursHeading: "Reach for ai4kanban when",
      theirsHeading: "Reach for GitHub Issues when",
      ours: [
        "You work solo, or with a tight, trusted pair.",
        "You drive the work through an agent in the terminal.",
        "You care about moving forward more than a paper trail.",
        "You want the board in git — offline and portable.",
      ],
      theirs: [
        "You're building in the open and transparency matters.",
        "Multiple people manipulate the backlog at once.",
        "You lean on PR/CI links, project boards, and milestones.",
        "You need outside contributors to file and discuss.",
      ],
      verdict:
        "They aren't really competitors. GitHub Issues is the **shared system of record**; ai4kanban is the **agent's fast local scratch-board**. If your bottleneck is coordination across people, use GitHub Issues. If it's throughput with an agent, use ai4kanban.",
      note: "Plenty of solo builders run both — GitHub Issues as the public tracker, ai4kanban as the private surface their agent drives every day.",
    },
  },

  vsHermes: {
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
  },

  vsVibe: {
    meta: {
      title: "AI4Kanban vs. Vibe Kanban — a planning board vs. an agent cockpit",
      socialTitle: "AI4Kanban vs. Vibe Kanban",
      description:
        "Vibe Kanban shut down when Bloop wound down in April 2026. How ai4kanban's file-based board compares: a lightweight planning board in your repo vs. a cockpit that runs many coding agents in parallel — and what carries over.",
      social:
        "Vibe Kanban's company shut down. A planning board in your repo vs. an agent-orchestration cockpit — the honest difference, and what carries over.",
    },
    hero: {
      badge: "Comparison",
      title: "AI4Kanban vs.\nVibe Kanban",
      lead: "Vibe Kanban is a cockpit for running many coding agents in parallel — and the company behind it, Bloop, shut down in April 2026. ai4kanban is a planning board your agent edits as plain files in your repo. They fix different bottlenecks. Here's the honest difference, and what actually carries over.",
      ours: {
        name: "AI4Kanban",
        body: "Plain Markdown in your repo. A planning board your agent edits.",
      },
      theirs: {
        name: "Vibe Kanban",
        body: "A local web app. A cockpit that runs many agents in parallel.",
      },
    },
    summary: {
      heading: {
        eyebrow: "The short version",
        title: "Vibe Kanban shut down — where to now?",
      },
      lead: "Bloop, the company behind Vibe Kanban, wound down in April 2026. Paid plans were cancelled and refunded, the cloud features were retired, and the project went fully local. It was left open source under Apache-2.0 — but the original repo has had no new commits since late April 2026, so its future now rides on community forks rather than the team that built it.",
      panel:
        "If what you valued in Vibe Kanban was the **board** — a calm place to line up and sharpen work for your coding agent — ai4kanban gives you that as plain files in git, with no company that can shut down and no server to keep alive. If what you valued was the **engine that runs many agents in parallel**, be warned: ai4kanban is not that, and we'd rather tell you now than lose you three sections in.",
    },
    comparison: {
      heading: { eyebrow: "Head to head", title: "AI4Kanban vs. Vibe Kanban" },
      lead: "Ten dimensions. A {check} is a clear win; a **dash** is a deliberate trade-off that comes down to what you need. ai4kanban takes the **lightness and planning** rows; Vibe Kanban takes the **parallel-agent and review** ones — its real strengths, stated plainly.",
      ourLabel: "AI4Kanban",
      theirLabel: "Vibe Kanban",
      rows: {
        whatFor: {
          dimension: "What it's for",
          kanban:
            "A planning board your agent edits in the repo — line up and sharpen the work.",
          vibe: "A cockpit to run many coding agents in parallel and review what they produce.",
        },
        orchestration: {
          dimension: "Parallel-agent orchestration",
          kanban: "None — you drive one agent; the board doesn't run agents.",
          vibe: "Its core strength — many agents at once, each in an isolated git worktree.",
        },
        review: {
          dimension: "Review of agent output",
          kanban: "Not its job — your harness shows the diffs.",
          vibe: "Built in — inline diff review, live preview, and pull-request handling.",
        },
        planning: {
          dimension: "Planning & refinement",
          kanban: "A refine loop turns a rough idea into a ready, concrete task.",
          vibe: "Minimal — the board mostly queues and tracks agent runs.",
        },
        onDisk: {
          dimension: "What it is on disk",
          kanban: "Plain Markdown in your repo, in git.",
          vibe: "A local SQLite database in a config directory.",
        },
        runsAs: {
          dimension: "Runs as",
          kanban: "Just files — no server, nothing to keep alive.",
          vibe: "A local web app (Rust backend + web UI) you start and keep running.",
        },
        setup: {
          dimension: "Setup",
          kanban: "One prompt: a skill file and a small script.",
          vibe: "npx vibe-kanban, plus each agent CLI installed and signed in.",
        },
        whichAgents: {
          dimension: "Which agents run it",
          kanban:
            "Any agent that can read files — Claude Code, Codex, Cursor, more.",
          vibe: "The agent CLIs it wires up — Claude Code, Codex, Gemini, and others.",
        },
        lockIn: {
          dimension: "Vendor lock-in",
          kanban: "None — the board is files that travel with the repo.",
          vibe: "Apache-2.0 and self-hosted, and a data export shipped before shutdown.",
        },
        maintenance: {
          dimension: "Who maintains it",
          kanban: "Actively maintained.",
          vibe: "Bloop shut down in April 2026; the original repo has since stalled.",
        },
      },
    },
    purpose: {
      heading: {
        eyebrow: "The real difference",
        title: "Planning board vs. orchestration cockpit",
      },
      lead: "The two tools sit at different points in the loop. One is where you decide **what to build**; the other is where you **run the agents that build it**. Mistaking one for the other is how you end up disappointed — so here it is straight.",
      ours: {
        name: "AI4Kanban — the plan",
        is: "A board your agent reads and edits as plain Markdown in your repo. You save a rough idea, a refine loop sharpens it into a ready task, and you approve before code is written. The work lives in git, next to the code it changes.",
        isnt: "It does not run agents, spin up worktrees, or diff their output — your harness does that. It's the map, not the engine.",
      },
      theirs: {
        name: "Vibe Kanban — the engine",
        is: "A local web app that runs many coding agents at once, each isolated in its own git worktree, then lets you review their diffs and preview the app in one place. Its value is throughput across parallel agent runs.",
        isnt: "It isn't built to sharpen a half-formed idea into a plan — the board mostly queues and tracks runs. Refinement is minimal.",
      },
      note: "Plenty of people ran Vibe Kanban for its board alone. If that was you, ai4kanban is a lighter home for it — files in git, nothing to keep running. If you ran it to drive agents in parallel, keep an eye on the community forks; ai4kanban won't replace that engine.",
    },
    wins: {
      heading: { eyebrow: "Trade-offs", title: "Where each one wins" },
      lead: "Neither is strictly better. ai4kanban optimizes for a lean, file-based board that outlives any tool; Vibe Kanban optimizes for running and reviewing many agents at once.",
      oursHeading: "AI4Kanban",
      theirsHeading: "Vibe Kanban",
      ours: {
        nothingRunning: {
          title: "Nothing to keep running",
          body: "The board is plain Markdown in your repo — no web app, no database, no server. Nothing to install past the agent you already run, and nothing that can go offline.",
        },
        planning: {
          title: "Planning, not just queuing",
          body: "A refine loop digs into the missing pieces and turns a rough idea into a ready, concrete card you approve before any code is written. Vibe Kanban's board mostly queues agent runs.",
        },
        outlives: {
          title: "Outlives any company",
          body: "No SaaS, no bundled runtime, no repo that can stall. The board is files in git — clone the repo and it comes with you. Bloop shutting down is exactly the risk this avoids.",
        },
        anyAgent: {
          title: "Any agent, any time",
          body: "It's just files, so any file-reading agent can drive it — Claude Code, Codex, Cursor, whatever you switch to next. You're not tied to one tool's list of supported CLIs.",
        },
      },
      theirs: {
        parallel: {
          title: "Runs many agents at once",
          body: "Its whole reason to exist: fan work out to several coding agents in parallel, each isolated in its own git branch and worktree so they never collide. ai4kanban doesn't run agents at all.",
        },
        reviewInPlace: {
          title: "Execute-and-review in one place",
          body: "Inline diff review, a built-in browser to preview the app, and pull-request handling — all in the cockpit. You watch and steer agent output without leaving the board.",
        },
        boardUi: {
          title: "A real board UI",
          body: "A web board built to drive agent runs — spin up a task, watch it work, switch between workspaces. Purpose-built for orchestration, not a plain file you grep.",
        },
        support: {
          title: "Broad agent support",
          body: "First to market on multi-agent orchestration, with many agent CLIs wired up out of the box — Claude Code, Codex, Gemini, and more.",
        },
      },
    },
    decision: {
      heading: { eyebrow: "The call", title: "Which should you use?" },
      oursHeading: "Reach for ai4kanban when",
      theirsHeading: "Reach for Vibe Kanban when",
      ours: [
        "You want a planning board your agent edits right in the repo.",
        "You want zero infrastructure — files in git, nothing to run or keep alive.",
        "You'd rather not tie your board to a product that can shut down.",
        "You drive one agent at a time and value a clear plan over parallelism.",
      ],
      theirs: [
        "You want to run many coding agents in parallel, each isolated.",
        "You want inline diff review and live preview in one cockpit.",
        "Orchestrating and reviewing agent runs is your real bottleneck.",
        "You're fine depending on a community fork now that Bloop has shut down.",
      ],
      verdict:
        "They fix different bottlenecks. Vibe Kanban is an **orchestration cockpit** for running many agents; ai4kanban is a **planning board** one agent edits in your repo. If you loved Vibe Kanban's board for lining up work, ai4kanban gives you that as plain files that outlast any company. If you loved its parallel-agent engine, ai4kanban isn't that — and we'd rather say so.",
      note: "Since Bloop shut down, the board is the part worth carrying forward with no company attached — and that's exactly what ai4kanban is.",
    },
  },

  vsLinear: {
    meta: {
      title: "AI4Kanban vs. Linear — repo-local AI project management",
      socialTitle: "AI4Kanban vs. Linear",
      description:
        "Compare ai4kanban with the Linear app: a repo-local planning loop for coding agents versus Linear's team workspace, agent platform, projects, and issue tracking.",
      social:
        "Linear is the stronger team system. ai4kanban is the sharper repo-local planning loop. See where each fits, including agents, pricing, and workflow.",
    },
    hero: {
      badge: "Comparison",
      title: "AI4Kanban vs.\nLinear",
      lead: "Linear is a polished project-management workspace where people and agents coordinate. ai4kanban is a repo-local planning board that an agent refines from rough idea to build-ready task. This is not a cheaper Linear clone; it is a different planning model.",
      ours: {
        name: "AI4Kanban",
        body: "Plain Markdown in your repo. The agent owns the planning loop.",
      },
      theirs: {
        name: "Linear",
        body: "A hosted team workspace. People and agents plan, build, and review together.",
      },
    },
    summary: {
      heading: {
        eyebrow: "The short version",
        title: "Linear has agents. The difference is where planning lives.",
      },
      lead: "Linear is not just an issue tracker with an AI add-on. Linear Agent works across workspace context, its agent platform delegates issues to coding agents, its MCP server connects external agents, and Coding Sessions can run Claude Code or Codex and return a pull request for review.",
      panel:
        "Choose ai4kanban for a narrower reason: you want the **agent to own the planning loop inside the repo**. A rough request becomes questions, decisions, dependencies, and a build-ready card. The board and its memory stay as reviewable Markdown beside the code.",
    },
    comparison: {
      heading: { eyebrow: "Head to head", title: "AI4Kanban vs. Linear" },
      lead: "A {check} marks the clearer fit for that row; a **dash** means the choice depends on how you work. Linear wins at **team coordination, portfolio planning, integrations, and built-in agent execution**. ai4kanban wins at **repo-local refinement, portability, and planning memory in git**.",
      ourLabel: "AI4Kanban",
      theirLabel: "Linear",
      rows: {
        bestFit: {
          dimension: "Best fit",
          kanban: "Solo developers and small teams whose coding agent drives the work.",
          linear: "Product and engineering teams coordinating people, projects, and agents.",
        },
        sourceOfTruth: {
          dimension: "Source of truth",
          kanban: "Markdown in the project repo, versioned with the code.",
          linear: "A shared Linear workspace reached through its apps, API, or MCP.",
        },
        refinement: {
          dimension: "From rough idea to ready task",
          kanban: "A refine-and-resolve loop answers what it can, records the rest, and stops when the card is concrete.",
          linear: "Linear Agent drafts, summarizes, updates, and helps scope work; issue quality still drives coding-session results.",
        },
        agentModel: {
          dimension: "Agent model",
          kanban: "Your existing harness reads and writes the board; Claude Code and Codex are wired up today.",
          linear: "Linear Agent plus installable app users, delegated issues, agent guidance, and a hosted MCP server.",
        },
        execution: {
          dimension: "Coding and review",
          kanban: "Your chosen harness implements the ready card; review stays in that harness and git workflow.",
          linear: "Coding Sessions run Claude Code or Codex in the cloud, open a PR, and put diffs and review in Linear.",
        },
        collaboration: {
          dimension: "Human collaboration",
          kanban: "Small-team git collaboration; concurrent board editing is not its strength.",
          linear: "A real-time workspace with members, assignees, comments, private teams, guests, and permissions.",
        },
        portfolio: {
          dimension: "Planning breadth",
          kanban: "Cards, dependencies, priority, ROI, releases, and module memory.",
          linear: "Issues, projects, cycles, initiatives, milestones, timelines, triage, insights, and customer requests.",
        },
        setup: {
          dimension: "Setup",
          kanban: "Install into a repo with one prompt; the board needs no account, database, or remote service.",
          linear: "Create a workspace; connect integrations and agent access as the team needs them.",
        },
        portability: {
          dimension: "Portability",
          kanban: "Clone the repo and the board, decisions, and history come with it; it works offline.",
          linear: "Data lives in Linear; admins can export workspace issue data as CSV and use the API.",
        },
        pricing: {
          dimension: "Price",
          kanban: "Apache-2.0 and free; you pay only for the coding-agent tools you choose.",
          linear: "Free: 250 issues and 2 teams. Basic: $10/user/month yearly. Business: $16/user/month yearly. Coding Sessions use AI credits.",
        },
      },
    },
    model: {
      heading: {
        eyebrow: "The real difference",
        title: "Repo memory vs. team workspace",
      },
      lead: "Both products now support agents. The important question is **which context owns the plan**: the project repo, or a shared company workspace.",
      ours: {
        name: "AI4Kanban — the repo plans with you",
        is: "The agent reads the code, past decisions, rejected ideas, and shipped work before it changes the plan. It keeps refining until open questions are answered or clearly handed to you.",
        isnt: "It is not a broad collaboration suite. The useful planning memory is committed with the code and follows every clone.",
      },
      theirs: {
        name: "Linear — the workspace coordinates everyone",
        is: "Issues belong to teams; projects can span teams; cycles, initiatives, timelines, documents, comments, and customer requests create shared context. Agents work inside the same permissioned workspace.",
        isnt: "It is substantially more system than a solo developer needs when the real problem is turning one rough request into a reliable spec.",
      },
      note: "They can coexist, but then you must decide which one owns task state. For a solo developer, two sources of truth are usually more process than value.",
    },
    wins: {
      heading: { eyebrow: "Trade-offs", title: "Where each one wins" },
      lead: "Linear wins breadth, coordination, and integrated execution. ai4kanban wins by making agent-led planning local, inspectable, and hard to lose between runs.",
      oursHeading: "AI4Kanban",
      theirsHeading: "Linear",
      ours: {
        roughToReady: {
          title: "Turns rough asks into ready work",
          body: "The agent questions, researches, splits, and resolves a card in a loop instead of treating the first issue description as the spec.",
        },
        repoMemory: {
          title: "Planning memory beside the code",
          body: "Decisions, rejected ideas, dependencies, and cards are plain, diffable files the next agent run reads by default.",
        },
        anyHarness: {
          title: "Bring your own harness",
          body: "The board is not tied to Linear Agent or one coding integration. Claude Code and Codex work today; the file format stays open to any harness.",
        },
        noSaas: {
          title: "No board SaaS to administer",
          body: "No workspace, seats, auth, database, or sync layer for the planning surface itself. The board is part of the repo.",
        },
      },
      theirs: {
        teamSystem: {
          title: "A real system for a human team",
          body: "Concurrent editing, ownership, permissions, comments, private teams, guests, notifications, and a polished interface.",
        },
        agentPlatform: {
          title: "Agents and execution built in",
          body: "Linear Agent, app users, MCP, delegated issues, Coding Sessions, diffs, and pull-request review share the same workspace context.",
        },
        planningDepth: {
          title: "Deep product planning",
          body: "Projects, cycles, initiatives, milestones, timelines, triage, insights, and customer requests go far beyond a small repo board.",
        },
        integrations: {
          title: "Integrations and searchable context",
          body: "GitHub, GitLab, Slack, Teams, support tools, APIs, webhooks, and workspace search connect the rest of a company's work.",
        },
      },
    },
    decision: {
      heading: { eyebrow: "The call", title: "Which should you use?" },
      oursHeading: "Reach for ai4kanban when",
      theirsHeading: "Stay with Linear when",
      ours: [
        "A solo developer or small team drives work through a coding agent.",
        "Your input starts vague and the planning loop is the bottleneck.",
        "You want tasks and durable decisions in git beside the code.",
        "You want to choose the harness instead of adopting a board's agent runtime.",
      ],
      theirs: [
        "Multiple people create, assign, discuss, and update work at the same time.",
        "You rely on cycles, initiatives, timelines, triage, customer requests, or reporting.",
        "You want delegated cloud coding sessions and diff review inside the project tool.",
        "You need company-wide integrations, permissions, security controls, and support.",
      ],
      verdict:
        "Linear is the stronger **team system**. ai4kanban is the sharper **repo-local planning loop**. If coordination across people is the bottleneck, stay with Linear. If a coding agent keeps receiving fuzzy work and losing the decisions behind it, put the board in the repo and let the agent refine it there.",
      note: "This is a change of planning model, not a feature-for-feature Linear replacement.",
    },
  },
};

export default en;
