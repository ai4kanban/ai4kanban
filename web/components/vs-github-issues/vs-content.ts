// Content for the /vs/ page — ai4kanban vs. GitHub Issues.
// Kept apart from the home page's content.ts so the two pages evolve
// independently.

export type Edge = "kanban" | "issues" | "neutral";

// The side-by-side matrix. `edge` marks the winning cell with a check and the
// other with a cross; a "neutral" row is a deliberate trade-off — both sides get
// a dash, because it comes down to what you need rather than one being worse.
export const compareRows: {
  dimension: string;
  kanban: string;
  issues: string;
  edge: Edge;
}[] = [
  {
    dimension: "Storage",
    kanban: "Plain Markdown in your repo, in git.",
    issues: "GitHub's database, behind an API.",
    edge: "kanban",
  },
  {
    dimension: "Works offline",
    kanban: "Yes — it's just files on disk.",
    issues: "No — needs network and auth.",
    edge: "kanban",
  },
  {
    dimension: "How an agent reads it",
    kanban: "Native fs tools: Read, Grep, Glob.",
    issues: "gh CLI or MCP round-trips.",
    edge: "kanban",
  },
  {
    dimension: "Token cost per lookup",
    kanban: "Low — grep returns only the matching lines.",
    issues: "High — JSON payloads and tool schemas.",
    edge: "kanban",
  },
  {
    dimension: "Latency",
    kanban: "Local disk, effectively instant.",
    issues: "A network round-trip per call.",
    edge: "kanban",
  },
  {
    dimension: "Setup",
    kanban: "One prompt: a skill file and a small script.",
    issues: "Account, auth token, MCP config.",
    edge: "kanban",
  },
  {
    dimension: "Vendor lock-in",
    kanban: "None — the board travels with the repo.",
    issues: "Lives on GitHub.",
    edge: "kanban",
  },
  {
    dimension: "Metadata",
    kanban: "Minimal by design: priority + effort — all a solo builder needs.",
    issues: "Labels, milestones, assignees, projects — for coordinating a team.",
    edge: "neutral",
  },
  {
    dimension: "Concurrency",
    kanban: "None — id clashes if two people add #1894.",
    issues: "Server-assigned ids, safe for teams.",
    edge: "issues",
  },
  {
    dimension: "Decision history",
    kanban:
      "Pruned to the decisions that steer the next task — why an idea was rejected, what shipped — so the agent proposes forward, never re-doing done or dead work.",
    issues: "Full comment history and edits kept, nothing dropped.",
    edge: "issues",
  },
  {
    dimension: "Closing out work",
    kanban: "Archive the task once its items are checked off.",
    issues: "Auto-closes issues from linked PRs and CI.",
    edge: "neutral",
  },
  {
    dimension: "Search at scale",
    kanban: "grep — quick on a small board, unwieldy as it grows.",
    issues: "Indexed full-text search and saved filters.",
    edge: "issues",
  },
  {
    dimension: "External contributors",
    kanban: "Possible, but only by committing to the Markdown — no lightweight filing.",
    issues: "Anyone can file, comment, and react without a commit.",
    edge: "issues",
  },
  {
    dimension: "Transparency",
    kanban: "Every card stays visible in the repo — only the memory hub is pruned to essentials.",
    issues: "Public and linkable — the open-source default.",
    edge: "neutral",
  },
];

// "Where each wins" cards.
export const kanbanWins: { icon: string; title: string; body: string }[] = [
  {
    icon: "⚡",
    title: "Token-light and instant",
    body: "No MCP, no network. The agent greps local Markdown instead of paging a remote API — fewer tokens, lower latency, no auth to refresh mid-task.",
  },
  {
    icon: "🧠",
    title: "Agents actually use it",
    body: "Agents are reluctant to search GitHub Issues; they reach for filesystem tools by default. A Markdown board meets them where they already are — less prompting, fewer hallucinated task states.",
  },
  {
    icon: "📦",
    title: "Offline and yours",
    body: "Plain files in git. Works on a plane, works when GitHub is down. No SaaS dependency, no vendor lock-in — clone the repo and the whole board comes with you.",
  },
  {
    icon: "🎯",
    title: "Memory tuned for proposing",
    body: "It records the decisions that steer the next task: why an idea was rejected, what got shipped, the gap to the goal. So the agent proposes forward — not re-doing done work or re-floating what you killed.",
  },
];

export const issuesWins: { icon: string; title: string; body: string }[] = [
  {
    icon: "👥",
    title: "Built for teams",
    body: "Server-assigned ids, safe concurrent edits, assignees. ai4kanban has no database — two people can both mint #1894 and conflict.",
  },
  {
    icon: "🌐",
    title: "Transparency and reach",
    body: "Public and linkable, with external contributors filing, commenting, and reacting. The right home when openness matters more than raw speed.",
  },
  {
    icon: "🗂️",
    title: "Full context, forever",
    body: "ai4kanban deliberately compresses — an archived card shrinks to a line. On GitHub every comment, edit, and cross-link stays intact.",
  },
  {
    icon: "🔗",
    title: "Deep integration",
    body: "Auto-closing from PRs, commit links, project boards, labels, milestones, and a whole ecosystem of third-party tools and indexed search at scale.",
  },
];

// The two decision columns.
export const decisionKanban: string[] = [
  "You work solo, or with a tight, trusted pair.",
  "You drive the work through an agent in the terminal.",
  "You care about moving forward more than a paper trail.",
  "You want the board in git — offline and portable.",
];

export const decisionIssues: string[] = [
  "You're building in the open and transparency matters.",
  "Multiple people manipulate the backlog at once.",
  "You lean on PR/CI links, project boards, and milestones.",
  "You need outside contributors to file and discuss.",
];

// The agent-ergonomics terminal comparison. Two transcripts of the same ask.
export const ergoIssues: { line: string; kind: "you" | "call" | "out" }[] = [
  { line: "find my high-priority open issues", kind: "you" },
  { line: "list_issues(state:open, labels:high)", kind: "call" },
  { line: "4.2 KB JSON — 18 issues, every field", kind: "out" },
  { line: "paginate, filter, summarize…", kind: "call" },
  { line: "auth refresh · rate-limit headers · retries", kind: "out" },
];

export const ergoKanban: { line: string; kind: "you" | "call" | "out" }[] = [
  { line: "find my high-priority open tasks", kind: "you" },
  { line: 'grep -rl "Priority: high" docs/kanban/todo', kind: "call" },
  { line: "three file paths", kind: "out" },
  { line: "done — one call, no network", kind: "out" },
];
