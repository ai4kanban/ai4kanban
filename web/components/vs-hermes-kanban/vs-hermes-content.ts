// Content for the /vs-hermes-kanban/ page — ai4kanban vs. Hermes Agent Kanban.
// Kept apart from the home page's content.ts and the GitHub comparison's
// vs-content.ts so each page evolves on its own.
//
// Framing (important): compare like for like — ai4kanban on a harness
// (e.g. Claude Code) vs. the Hermes Kanban feature on the Hermes runtime. Both
// harnesses already give you parallel subagents, worktree isolation, fan-out /
// pipeline / voting, human-in-the-loop, transcripts, and a dashboard, so those
// wash out. What's genuinely specific to Hermes Kanban is the durable, shared
// SQLite work queue (many named agents + humans claim tasks; crash recovery) and
// dispatcher-run auto-decomposition. What's specific to the skill is being plain
// diffable files, agent-agnostic (it even runs on Hermes), and zero infra.

export type HkEdge = "kanban" | "hermes" | "neutral";

// The side-by-side matrix. `edge` marks the winning cell with a check and the
// other with a cross; a "neutral" row is a deliberate trade-off — both sides get
// a dash, because it comes down to what you need rather than one being worse.
// Agent-runtime compatibility isn't a row here — it gets its own logo-bar
// section (HkHarness), which reads faster than prose in a table cell.
export const compareRows: {
  dimension: string;
  kanban: string;
  hermes: string;
  edge: HkEdge;
}[] = [
  {
    dimension: "What it is",
    kanban: "A file-based kanban layer — the board is plain Markdown in your repo.",
    hermes: "A kanban feature of the Hermes agent runtime — a durable SQLite board.",
    edge: "neutral",
  },
  {
    dimension: "Infrastructure",
    kanban: "None of its own — the board is just plain Markdown files in your repo.",
    hermes: "A running gateway, a SQLite database, and a dispatcher loop.",
    edge: "kanban",
  },
  {
    dimension: "Where the board lives",
    kanban: "In your repo, under version control — every task and plan change is a reviewable diff.",
    hermes: "In a SQLite DB at ~/.hermes/kanban.db; changes go to an event log, not diffs.",
    edge: "kanban",
  },
  {
    dimension: "Setup",
    kanban: "One prompt: a skill file and a small script.",
    hermes: "Install the Hermes runtime, configure profiles, run the gateway.",
    edge: "kanban",
  },
  {
    dimension: "Parallel & scheduled runs",
    kanban: "Your harness drives it — Claude Code spawns parallel subagents when you kick things off; scheduled jobs live in a recurring/ folder.",
    hermes: "The runtime drives it — the dispatcher picks up ready tasks on its own and spawns a worker process per task.",
    edge: "neutral",
  },
  {
    dimension: "Crash recovery",
    kanban: "No per-task queue — a run that dies mid-task just reruns on the next scheduled tick.",
    hermes: "A durable queue auto-recovers in-flight work — claim TTLs, heartbeats, stale-claim reclaim, retries.",
    edge: "hermes",
  },
  {
    dimension: "Task decomposition",
    kanban: "A card breaks into todos and a task graph — group, blocked-by, related — with deps worked out as it's written.",
    hermes: "The dispatcher auto-runs an LLM decomposer, fanning a task into a child-task graph routed to specialists.",
    edge: "neutral",
  },
  {
    dimension: "Review & memory",
    kanban: "Memory is pruned to why-rejected and what-shipped so the agent proposes forward — curated, not a full log.",
    hermes: "Keeps a full append-only event log and per-attempt run history for audit.",
    edge: "neutral",
  },
  {
    dimension: "Dashboard GUI",
    kanban: "A local web board where card actions — implement, review, archive — hand the work to an agent.",
    hermes: "A live web board with drag-drop and a side drawer, plus control from chat apps.",
    edge: "neutral",
  },
  {
    dimension: "Scale & reach",
    kanban: "A solo board; grep gets unwieldy as it grows.",
    hermes: "Scales to many agents across many boards — multi-tenant, with control from Discord / Slack / email / SMS.",
    edge: "hermes",
  },
];

// "Where each wins" cards. Titles are self-descriptive — the title alone should
// tell you what the card is about. Each side lists only what survives factoring
// out shared harness features.
export const kanbanWins: { icon: string; title: string; body: string }[] = [
  {
    icon: "⚡",
    title: "No infrastructure of its own",
    body: "No database, no gateway, no daemon. Beyond the agent you already run, the board is plain Markdown files — nothing extra to install or keep alive, works on a plane.",
  },
  {
    icon: "📦",
    title: "Files you can diff and version",
    body: "The board lives in the repo and travels with it, under whatever version control you use. Every task and plan change is a reviewable diff — no SQLite outside your project, no event log to query, no lock-in to one agent stack.",
  },
  {
    icon: "🧠",
    title: "Memory that self-prunes",
    body: "It records why an idea was rejected and what got shipped, so the agent proposes forward instead of re-floating dead work. It keeps only what steers the next task, not a full audit log.",
  },
  {
    icon: "🪶",
    title: "Installs in one prompt",
    body: "A skill file and a small script — no profiles to configure, no dispatcher to tune. It meets any file-reading agent where it already is, Hermes included.",
  },
];

export const hermesWins: { icon: string; title: string; body: string }[] = [
  {
    icon: "🤝",
    title: "One board, many named agents",
    body: "A single durable board that multiple named agents — and humans — claim tasks and hand off work on. The dispatcher polls ready tasks and spawns the assigned agent for each. The skill's board is driven by whatever single harness you're in.",
  },
  {
    icon: "🔁",
    title: "Self-healing task queue",
    body: "The queue tracks each task through crashes: claim TTLs, heartbeats, stale-claim reclaim, retries, and circuit breakers. A worker can die mid-task and the board reclaims and retries it — the skill's files are durable, but a dead run just waits for the next scheduled tick.",
  },
  {
    icon: "🧩",
    title: "Auto-decomposes tasks",
    body: "Drop in a rough task and the dispatcher's LLM decomposer fans it into a child-task graph, each child routed to a specialist agent — no manual breakdown. The skill splits a card into todos and a hand-tended task graph.",
  },
  {
    icon: "📡",
    title: "Fleet reach and scale",
    body: "Built for many agents across many boards, multi-tenant, with control from Discord, Telegram, Slack, email, and SMS. The skill is a lean solo board that stays in your repo and terminal.",
  },
];

// The two decision columns.
export const decisionKanban: string[] = [
  "You want a file-based board — every task and plan change is a reviewable diff.",
  "You want no infra of its own: plain files, offline, portable, no lock-in.",
  "You want it agent-agnostic — Claude Code, Cursor, even Hermes itself.",
  "You're solo and value a lean board over a bundled engine.",
];

export const decisionHermes: string[] = [
  "You already work deeply with Hermes — profiles, gateway, and chat control are set up.",
  "You want one durable board that many named agents — and people — share.",
  "You want a queue that auto-recovers in-flight tasks across crashes.",
  "You want the dispatcher to auto-decompose tasks and route them to specialists.",
  "You run fleet workloads across many boards and chat platforms.",
];
