# AI4Kanban — a project board that plans itself

> AI4Kanban is an agent-led project board that brings project goals, code, and
> long-term memory together to manage work from planning through completion.
> Product direction and final approval remain human decisions.

- Download: https://ai4kanban.dev/download
- View on GitHub: https://github.com/ai4kanban/ai4kanban

## Keep work moving

Start with a goal or a rough idea. The agent reads the code and project memory,
determines what comes next, clarifies requirements, breaks down the work, orders
dependencies and priorities, and moves into execution.

- **Define tasks and dependencies** — The agent breaks large goals into bounded cards,
  automatically deciding what can run in parallel and what must wait, so each task can
  be completed within its own context window.
- **Clarify requirements** — The agent turns rough requirements into an actionable plan.
  It answers most questions from project memory and the codebase, leaving only taste,
  business direction, risk, and cost for human judgment.
- **Execute** — Run ready tasks in parallel across multiple agents. Each delivery uses
  its own Git worktree to isolate changes, and conflicts trigger a dedicated resolution
  pass before landing.
- **Settle key decisions before implementation** — Create custom Spec Agents or use the
  built-ins: a technology-selection agent compares technical options, while a UI-design
  agent provides one working mockup by default and alternatives when requested.
- **Request approval only when necessary** — AI4Kanban keeps work moving in the background
  and reports back only for product decisions and delivery approval. Like a project manager,
  it keeps demands on human attention to a minimum.

## Learns as you build

Chat sessions end; product decisions remain. AI4Kanban saves the project goal and
keeps a module-by-module record of shipped features, product decisions, reasons
behind rejected ideas, and design lessons. It brings that context back when
planning and clarifying new work.

- **No need to repeat established decisions** — Preferences and constraints carry
  into planning for the next task.
- **Avoid the same dead ends** — Rejected directions and known design problems are
  not proposed again.
- **Plan from the current state** — Before planning new work, the agent reads what
  has already shipped and checks the current code.

```
docs/kanban/memory/
├─ goal.md            # the project goal
├─ local-ui/          # one folder per module
│  ├─ readme.md       # shipped features
│  ├─ decisions.md    # product decisions
│  ├─ rejected.md     # reasons for rejection
│  └─ redesign.md     # design lessons
└─ site/
```

## Drive continuous product iteration

Turn external signals into requirements that keep the product and each release
moving forward.

External inputs:

- User feedback
- Competitor research
- Industry reports
- Reddit discussions

Internal inputs:

- Product roadmap

AI4Kanban works with the board and its project data: tasks that are ready to
build, tasks that are not yet ready, and the project memory that informs both.
Other agents can work from the same data.

Iteration outcomes:

- Product improvements
- Release iterations

## Start with the desktop app

Download the app, open it, and select a project. It asks three questions, one per
screen, then reads the codebase, establishes the project goal and module memory,
and creates the first tasks.

- Autonomous planning
- Local-first
- Agent-agnostic

Builds are unsigned, so macOS blocks the first open: drag the app in from the
`.dmg`, then click through the warning. The download page has the full steps for
macOS, Windows, and Linux.

The app includes the `akb` CLI and adds the coding-agent skills when a project is
opened. Neither is meant to be installed on its own.

Download the app: https://ai4kanban.dev/download

---

AI4Kanban · https://github.com/ai4kanban/ai4kanban
