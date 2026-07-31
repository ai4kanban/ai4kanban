# AI4Kanban vs. Hermes Agent Kanban

> Two agent-facing kanban boards with a lot of overlap. The difference is where
> the board sits in the stack: ai4kanban is a lean *board layer* you run
> any agent on top of; Hermes Agent Kanban fuses that board into its own runtime.

- **AI4Kanban** — A plain-Markdown board in your repo. The runtime, execution,
  and even maintenance layer on top — swap the agent, keep the board.
- **Hermes Agent Kanban** — The board, dispatcher, and named agents are one
  integrated runtime — durable and bundled, but the board doesn't detach from
  Hermes.

## 01 · The short version — So why not just use Hermes Kanban?

Fair question — the two overlap a lot. Both are kanban boards agents plan and work
from, so think of ai4kanban as **a lightweight alternative to Hermes
Kanban**: the same board idea, minus the bundled runtime. The difference is
what's underneath.

**AI4Kanban — a board made of files**

- Plain Markdown in your repo — every task and plan change is a reviewable diff.
- No infrastructure: nothing to install, nothing to keep running.
- Execution comes from whatever harness you already use — Claude Code, Codex,
  Cursor, even Hermes.

**Hermes Kanban — a board inside a runtime**

- A durable SQLite queue at ~/.hermes/kanban.db, shared by many named agents and
  humans.
- A dispatcher hands ready tasks to agents and recovers crashed runs.
- Tied to the Hermes / Nous stack and its kanban_* tools.

**When to use ai4kanban.** Pick the skill when you want the board
**versioned with your code**, when you're staying in a harness you already run,
or when you don't want to operate a runtime just to get a task board. Reach for
Hermes Kanban when **you already work deeply with Hermes** — its board plugs
straight into the dispatcher, named profiles, and chat control you've set up.
Both are durable queues in the end; the skill's is files in git, Hermes's is rows
in SQLite.

## 02 · Harness support — Which agents can run the board?

The clearest single difference. The skill's board is plain files, so **any agent
that can read a repo can run it** — including Hermes itself. Hermes Kanban's board
sits behind the runtime's `kanban_*` tools, so only Hermes can.

| Board | Claude Code | Codex | Cursor | OpenClaw | Hermes |
| --- | --- | --- | --- | --- | --- |
| AI4Kanban (any file-reading agent) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Hermes Kanban (Hermes only) | ❌ | ❌ | ❌ | ❌ | ✅ |

…and the skill's row keeps going — Windsurf, OpenCode, Gemini CLI, anything that
reads files. Hermes Kanban has no way in for other agents.

## 03 · Head to head — AI4Kanban vs. Hermes Kanban

A check is a clear win; a dash is a trade-off. The skill wins on simplicity and
portability, Hermes on the durable shared queue and scale — the rest is a draw.

| Dimension | AI4Kanban | Hermes Kanban | Edge |
| --- | --- | --- | --- |
| What it is | A file-based kanban layer — the board is plain Markdown in your repo. | A kanban feature of the Hermes agent runtime — a durable SQLite board. | Trade-off |
| Infrastructure | None of its own — the board is just plain Markdown files in your repo. | A running gateway, a SQLite database, and a dispatcher loop. | AI4Kanban |
| Where the board lives | In your repo, under version control — every task and plan change is a reviewable diff. | In a SQLite DB at ~/.hermes/kanban.db; changes go to an event log, not diffs. | AI4Kanban |
| Setup | One prompt: a skill file and a small script. | Install the Hermes runtime, configure profiles, run the gateway. | AI4Kanban |
| Parallel & scheduled runs | Your harness drives it — Claude Code spawns parallel subagents when you kick things off; scheduled jobs live in a recurring/ folder. | The runtime drives it — the dispatcher picks up ready tasks on its own and spawns a worker process per task. | Trade-off |
| Crash recovery | No per-task queue — a run that dies mid-task just reruns on the next scheduled tick. | A durable queue auto-recovers in-flight work — claim TTLs, heartbeats, stale-claim reclaim, retries. | Hermes |
| Task decomposition | A card breaks into todos and a task graph — group, blocked-by, related — with deps worked out as it's written. | The dispatcher auto-runs an LLM decomposer, fanning a task into a child-task graph routed to specialists. | Trade-off |
| Review & memory | Memory is pruned to why-rejected and what-shipped so the agent proposes forward — curated, not a full log. | Keeps a full append-only event log and per-attempt run history for audit. | Trade-off |
| Dashboard GUI | A local web board where card actions — implement, review, archive — hand the work to an agent. | A live web board with drag-drop and a side drawer, plus control from chat apps. | Trade-off |
| Scale & reach | A solo board; grep gets unwieldy as it grows. | Scales to many agents across many boards — multi-tenant, with control from Discord / Slack / email / SMS. | Hermes |

## 04 · Memory vs. audit — What each board remembers

The essential difference: the skill's memory is an **input to planning** — it
exists so the next proposal is smarter. Hermes's log is an **output of
execution** — it exists so the past can be replayed.

**AI4Kanban — remembers conclusions, forgets the rest.** Four small files,
pruned on purpose: `archive.md` (what shipped), `rejected.md` (what we turned
down, and why), `redesign.md` (design mistakes not to repeat), `memory.md` (what
past scans learned). The agent reads them all before proposing or writing a card;
the full history is git's job.

> "Why isn't idea X on the board?" — One line in `rejected.md`: the idea and why
> it was turned down. Dead ideas stay dead.

**Hermes Kanban — remembers every event, summarizes nothing.** Every state
transition lands in an append-only log; every attempt keeps its exit code and
full worker output. Built for audit and crash recovery, not for steering the next
idea.

> "What happened to task 42 overnight?" — `claimed → crashed → reclaimed →
> completed`, with per-attempt logs to read.

Curated memory makes the agent smarter next time; the audit log makes the past
reconstructable. Neither substitutes for the other.

## 05 · Autonomy level — How much autonomy does the agent get?

Hermes Kanban promises **"drop a one-liner, walk away"** — full autonomy.
ai4kanban is **agent-assisted**, and it starts earlier than plan mode: you
save a half-formed idea to the board, `refine` turns it into concrete
requirements, and you approve before any code is written.

The spectrum, from "you plan everything" to "agent plans everything":

- **No autonomy · Human-driven — Traditional kanban.** You think of every task
  and break it down — Trello or Jira just records it.
- **Semi autonomy · Agent-assisted — AI4Kanban.** Each `refine` digs into the
  missing pieces and fills in requirements. You review before anything is built.
- **Full autonomy · Fire-and-forget — Hermes Kanban.** One line in, a task tree
  out — decomposed and worked unattended until done. Claude Code's `/goal` makes
  the same bet.

Worst case, per level:

- **Fire-and-forget:** a small early misunderstanding grows into a whole tree of
  wrong tasks — built, tokens spent.
- **Agent-assisted:** a wrong Markdown card — caught when you review it, before
  anything is built.

One refine fills in missing steps, splits side ideas into their own cards, ticks
off todos that already landed, and leaves the taste calls to you as questions.
When none are left, the card flips to **ready** — read it, then build it.

## 06 · The dashboards — Kanban Board GUI

Both ship a web board, but they play different roles. The skill's board is a
**control surface for your agent** — card actions kick off runs. Hermes's board is
a **live window onto the dispatcher** — it shows what the fleet is doing right now.

- **AI4Kanban — local board.** A local web board over the Markdown files. Card
  actions — *implement, review, archive* — hand the work to an agent, and you
  watch its log stream back with human-in-the-loop prompts.
- **Hermes Kanban — live dispatcher view.** A live board that tails the event
  log — drag-drop between columns, a side drawer with run history and exit-status
  badges, and the same board steerable from Discord, Slack, or SMS.

## 07 · Trade-offs — Where each one wins

Neither is strictly better. ai4kanban optimizes for a lean, file-based
board with no infra of its own; Hermes Kanban optimizes for a durable, shared
work queue that many agents run against, unattended. Harness features — parallel
runs, orchestration, a dashboard — are on both sides, so they aren't listed here.

### AI4Kanban

- **No infrastructure of its own** — No database, no gateway, no daemon. Beyond
  the agent you already run, the board is plain Markdown files — nothing extra to
  install or keep alive, works on a plane.
- **Files you can diff and version** — The board lives in the repo and travels
  with it, under whatever version control you use. Every task and plan change is a
  reviewable diff — no SQLite outside your project, no event log to query, no
  lock-in to one agent stack.
- **Memory that self-prunes** — It records why an idea was rejected and what got
  shipped, so the agent proposes forward instead of re-floating dead work. It
  keeps only what steers the next task, not a full audit log.
- **Installs in one prompt** — A skill file and a small script — no profiles to
  configure, no dispatcher to tune. It meets any file-reading agent where it
  already is, Hermes included.

### Hermes Kanban

- **One board, many named agents** — A single durable board that multiple named
  agents — and humans — claim tasks and hand off work on. The dispatcher polls
  ready tasks and spawns the assigned agent for each. The skill's board is driven
  by whatever single harness you're in.
- **Self-healing task queue** — The queue tracks each task through crashes: claim
  TTLs, heartbeats, stale-claim reclaim, retries, and circuit breakers. A worker
  can die mid-task and the board reclaims and retries it — the skill's files are
  durable, but a dead run just waits for the next scheduled tick.
- **Auto-decomposes tasks** — Drop in a rough task and the dispatcher's LLM
  decomposer fans it into a child-task graph, each child routed to a specialist
  agent — no manual breakdown. The skill splits a card into todos and a
  hand-tended task graph.
- **Fleet reach and scale** — Built for many agents across many boards,
  multi-tenant, with control from Discord, Telegram, Slack, email, and SMS. The
  skill is a lean solo board that stays in your repo and terminal.

## 08 · The call — Which should you use?

**Reach for ai4kanban when**

- You want a file-based board — every task and plan change is a reviewable diff.
- You want no infra of its own: plain files, offline, portable, no lock-in.
- You want it agent-agnostic — Claude Code, Cursor, even Hermes itself.
- You're solo and value a lean board over a bundled engine.

**Reach for Hermes Kanban when**

- You already work deeply with Hermes — profiles, gateway, and chat control are
  set up.
- You want one durable board that many named agents — and people — share.
- You want a queue that auto-recovers in-flight tasks across crashes.
- You want the dispatcher to auto-decompose tasks and route them to specialists.
- You run fleet workloads across many boards and chat platforms.

### Bottom line

They overlap more than the names suggest — both are agent kanban boards. The split
is what's bundled: ai4kanban is a **file-based board with automation left
to your harness**; Hermes Agent Kanban is that board **wrapped in a durable,
shared work queue**. If you want one board many agents share, surviving crashes,
use Hermes. If you want a lean board in your repo you extend only when you need
to, use ai4kanban.

They can even sit side by side — the skill as the lightweight place you plan and
prune in git, Hermes as the durable queue that runs the heavy, shared work once
you've decided what it is.

---

Install ai4kanban · https://github.com/ai4kanban/ai4kanban
