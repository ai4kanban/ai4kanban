# Kanban skill vs. Vibe Kanban

> Two different tools for two different bottlenecks. Vibe Kanban is a cockpit for
> running many coding agents in parallel — and the company behind it, Bloop, shut
> down in April 2026. The kanban skill is a planning board your agent edits as
> plain files in your repo. Here's the honest difference, and what carries over.

- **Kanban skill** — Plain Markdown in your repo. A planning board your agent
  edits.
- **Vibe Kanban** — A local web app. A cockpit that runs many agents in parallel.

## 01 · The short version — Vibe Kanban shut down, where to now?

Bloop, the company behind Vibe Kanban, wound down in April 2026. Paid plans were
cancelled and refunded, the cloud features were retired, and the project went
fully local. It was left open source under Apache-2.0 — but the original repo has
had no new commits since late April 2026, so its future now rides on community
forks rather than the team that built it.

If what you valued in Vibe Kanban was the **board** — a calm place to line up and
sharpen work for your coding agent — the kanban skill gives you that as plain
files in git, with no company that can shut down and no server to keep alive. If
what you valued was the **engine that runs many agents in parallel**, be warned:
the kanban skill is not that, and we'd rather tell you now than lose you three
sections in.

## 02 · Head to head — Kanban skill vs. Vibe Kanban

Ten dimensions. A check is a clear win; a dash is a deliberate trade-off that
comes down to what you need. The kanban skill takes the lightness and planning
rows; Vibe Kanban takes the parallel-agent and review ones — its real strengths,
stated plainly.

| Dimension | Kanban skill | Vibe Kanban | Edge |
| --- | --- | --- | --- |
| What it's for | A planning board your agent edits in the repo — line up and sharpen the work. | A cockpit to run many coding agents in parallel and review what they produce. | Trade-off |
| Parallel-agent orchestration | None — you drive one agent; the board doesn't run agents. | Its core strength — many agents at once, each in an isolated git worktree. | Vibe Kanban |
| Review of agent output | Not its job — your harness shows the diffs. | Built in — inline diff review, live preview, and pull-request handling. | Vibe Kanban |
| Planning & refinement | A refine loop turns a rough idea into a ready, concrete task. | Minimal — the board mostly queues and tracks agent runs. | Kanban skill |
| What it is on disk | Plain Markdown in your repo, in git. | A local SQLite database in a config directory. | Kanban skill |
| Runs as | Just files — no server, nothing to keep alive. | A local web app (Rust backend + web UI) you start and keep running. | Kanban skill |
| Setup | One prompt: a skill file and a small script. | npx vibe-kanban, plus each agent CLI installed and signed in. | Kanban skill |
| Which agents run it | Any agent that can read files — Claude Code, Codex, Cursor, more. | The agent CLIs it wires up — Claude Code, Codex, Gemini, and others. | Trade-off |
| Vendor lock-in | None — the board is files that travel with the repo. | Apache-2.0 and self-hosted, and a data export shipped before shutdown. | Kanban skill |
| Who maintains it | Actively maintained. | Bloop shut down in April 2026; the original repo has since stalled. | Kanban skill |

## 03 · The real difference — Planning board vs. orchestration cockpit

The two tools sit at different points in the loop. One is where you decide **what
to build**; the other is where you **run the agents that build it**. Mistaking one
for the other is how you end up disappointed — so here it is straight.

**Kanban skill — the plan.** A board your agent reads and edits as plain Markdown
in your repo. You save a rough idea, a refine loop sharpens it into a ready task,
and you approve before code is written. The work lives in git, next to the code it
changes. It does not run agents, spin up worktrees, or diff their output — your
harness does that. It's the map, not the engine.

**Vibe Kanban — the engine.** A local web app that runs many coding agents at
once, each isolated in its own git worktree, then lets you review their diffs and
preview the app in one place. Its value is throughput across parallel agent runs.
It isn't built to sharpen a half-formed idea into a plan — the board mostly queues
and tracks runs. Refinement is minimal.

Plenty of people ran Vibe Kanban for its board alone. If that was you, the kanban
skill is a lighter home for it — files in git, nothing to keep running. If you ran
it to drive agents in parallel, keep an eye on the community forks; the kanban
skill won't replace that engine.

## 04 · Trade-offs — Where each one wins

Neither is strictly better. The kanban skill optimizes for a lean, file-based
board that outlives any tool; Vibe Kanban optimizes for running and reviewing many
agents at once.

### Kanban skill

- **Nothing to keep running** — The board is plain Markdown in your repo — no web
  app, no database, no server. Nothing to install past the agent you already run,
  and nothing that can go offline.
- **Planning, not just queuing** — A refine loop digs into the missing pieces and
  turns a rough idea into a ready, concrete card you approve before any code is
  written. Vibe Kanban's board mostly queues agent runs.
- **Outlives any company** — No SaaS, no bundled runtime, no repo that can stall.
  The board is files in git — clone the repo and it comes with you. Bloop shutting
  down is exactly the risk this avoids.
- **Any agent, any time** — It's just files, so any file-reading agent can drive
  it — Claude Code, Codex, Cursor, whatever you switch to next. You're not tied to
  one tool's list of supported CLIs.

### Vibe Kanban

- **Runs many agents at once** — Its whole reason to exist: fan work out to
  several coding agents in parallel, each isolated in its own git branch and
  worktree so they never collide. The kanban skill doesn't run agents at all.
- **Execute-and-review in one place** — Inline diff review, a built-in browser to
  preview the app, and pull-request handling — all in the cockpit. You watch and
  steer agent output without leaving the board.
- **A real board UI** — A web board built to drive agent runs — spin up a task,
  watch it work, switch between workspaces. Purpose-built for orchestration, not a
  plain file you grep.
- **Broad agent support** — First to market on multi-agent orchestration, with
  many agent CLIs wired up out of the box — Claude Code, Codex, Gemini, and more.

## 05 · The call — Which should you use?

**Reach for the kanban skill when**

- You want a planning board your agent edits right in the repo.
- You want zero infrastructure — files in git, nothing to run or keep alive.
- You'd rather not tie your board to a product that can shut down.
- You drive one agent at a time and value a clear plan over parallelism.

**Reach for Vibe Kanban when**

- You want to run many coding agents in parallel, each isolated.
- You want inline diff review and live preview in one cockpit.
- Orchestrating and reviewing agent runs is your real bottleneck.
- You're fine depending on a community fork now that Bloop has shut down.

### Bottom line

They fix different bottlenecks. Vibe Kanban is an **orchestration cockpit** for
running many agents; the kanban skill is a **planning board** one agent edits in
your repo. If you loved Vibe Kanban's board for lining up work, the skill gives
you that as plain files that outlast any company. If you loved its parallel-agent
engine, the skill isn't that — and we'd rather say so.

Since Bloop shut down, the board is the part worth carrying forward with no
company attached — and that's exactly what the kanban skill is.

---

Install the kanban skill · https://github.com/dist0com/ai4kanban
